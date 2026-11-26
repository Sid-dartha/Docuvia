import json
import re
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.models.ask import AskRequest
from app.models.search import SearchRequest
from app.services.embedding_service import create_embeddings
from app.services.ollama_service import (
    NO_SUITABLE_ANSWER,
    generate_answer,
    generate_tool_result,
)
from app.services.pdf_service import extract_pages_from_pdf
from app.services.text_chunker import split_text_into_chunks
from app.services.vector_store import UPLOADS_FOLDER, vector_store

router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)

UPLOADS_FOLDER.mkdir(exist_ok=True)

OPTION_PREFIX = re.compile(r"^[A-Da-d][).:]\s*")


def _is_pdf(file: UploadFile) -> bool:
    # Some browsers send PDFs as application/octet-stream, so also check the name.
    filename = (file.filename or "").lower()
    return file.content_type == "application/pdf" or filename.endswith(".pdf")


def _safe_filename(filename: str | None) -> str:
    # Drop any directory parts (e.g. "../../evil.pdf") and unusual characters.
    name = Path((filename or "").replace("\\", "/")).name
    name = re.sub(r"[^\w.\- ()]", "_", name).strip()
    return name or "document.pdf"


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if not _is_pdf(file):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed."
        )

    unique_filename = f"{uuid4()}_{_safe_filename(file.filename)}"
    file_path = UPLOADS_FOLDER / unique_filename

    with open(file_path, "wb") as saved_file:
        content = await file.read()
        saved_file.write(content)

    try:
        pages = extract_pages_from_pdf(file_path)
    except ValueError as error:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(error)) from error

    extracted_text = "\n".join(pages).strip()
    page_chunks = [
        (chunk, page_number)
        for page_number, page_text in enumerate(pages, start=1)
        for chunk in split_text_into_chunks(page_text)
    ]
    chunks = [chunk for chunk, _ in page_chunks]
    page_numbers = [page_number for _, page_number in page_chunks]

    if not chunks:
        file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=422,
            detail="No readable text found in this PDF (it may be a scanned image).",
        )

    embeddings = create_embeddings(chunks)

    try:
        vector_store.add_chunks(
            document_name=unique_filename,
            chunks=chunks,
            embeddings=embeddings,
            page_numbers=page_numbers,
        )
    except ValueError as error:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(error)) from error

    return {
        "message": "PDF processed and stored in the vector index successfully.",
        "original_filename": file.filename,
        "saved_filename": unique_filename,
        "characters_extracted": len(extracted_text),
        "total_chunks": len(chunks),
        "embedding_dimensions": len(embeddings[0]) if embeddings else 0,
        "total_vectors_in_index": vector_store.total_vectors(),
    }


def _clean_question(question: str) -> str:
    question = question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Please enter a question.")
    return question


@router.post("/search")
def search_documents(search_request: SearchRequest):
    question = _clean_question(search_request.question)
    query_embedding = create_embeddings([question])[0]

    results = vector_store.search(
        query_embedding=query_embedding,
        top_k=search_request.top_k,
    )

    return {
        "question": question,
        "results_found": len(results),
        "results": results,
    }


@router.post("/ask")
def ask_documents(ask_request: AskRequest):
    question = _clean_question(ask_request.question)
    query_embedding = create_embeddings([question])[0]

    search_results = vector_store.search(
        query_embedding=query_embedding,
        top_k=ask_request.top_k,
    )

    if not search_results:
        return {
            "question": question,
            "answer": NO_SUITABLE_ANSWER,
            "sources": [],
        }

    answer_document_name = search_results[0]["document_name"]
    answer_results = [
        result
        for result in search_results
        if result["document_name"] == answer_document_name
    ]

    try:
        answer = generate_answer(
            question=question,
            search_results=answer_results,
        )

    except RuntimeError as error:
        raise HTTPException(
            status_code=503,
            detail=str(error)
        ) from error

    sources = []
    if answer != NO_SUITABLE_ANSWER:
        sources = [
            {
                "document_name": result["document_name"],
                "chunk_number": result["chunk_number"],
                "page_number": result.get("page_number"),
                "snippet": result["text"][:240],
                "similarity_score": result["similarity_score"],
            }
            for result in answer_results
        ]

    return {
        "question": question,
        "answer": answer,
        "sources": sources,
    }


async def _read_pdf(file: UploadFile, max_chars: int = 16000) -> tuple[str, str]:
    filename = _safe_filename(file.filename)
    if not _is_pdf(file):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")
    content = await file.read()
    temporary_path = UPLOADS_FOLDER / f"tool_{uuid4()}.pdf"
    temporary_path.write_bytes(content)
    try:
        pages = extract_pages_from_pdf(temporary_path)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    finally:
        temporary_path.unlink(missing_ok=True)

    text = "\n\n".join(page for page in pages if page).strip()
    if not text:
        raise HTTPException(
            status_code=422,
            detail=f"No readable text found in {filename} (it may be a scanned PDF).",
        )
    return filename, text[:max_chars]


@router.post("/compare")
async def compare_documents(
    first_file: UploadFile = File(...),
    second_file: UploadFile = File(...),
):
    first_name, first_text = await _read_pdf(first_file)
    second_name, second_text = await _read_pdf(second_file)
    # Instructions go after the text so they are never pushed out of the context.
    prompt = f"""DOCUMENT A: {first_name}
{first_text}

DOCUMENT B: {second_name}
{second_text}

---
Compare DOCUMENT A and DOCUMENT B above using only their text. Do not invent details.
Format the answer in Markdown using exactly these four headings, each followed by
3 to 6 short bullet points that start with "- ". Use **bold** for key terms.
Do not add any introduction or closing remarks.

## New or changed content
## Removed content
## Shared content
## Practical impact
"""
    try:
        result = generate_tool_result(prompt)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return {"first_document": first_name, "second_document": second_name, "result": result}


def _clean_text(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _load_json_object(raw: str) -> dict | None:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            return None
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return data if isinstance(data, dict) else None


def _answer_index(answer, options: list[str]) -> int | None:
    if isinstance(answer, bool):
        return None
    if isinstance(answer, int):
        return answer if 0 <= answer < len(options) else None
    if isinstance(answer, str):
        stripped = answer.strip()
        if len(stripped) == 1 and stripped.upper() in "ABCD":
            index = ord(stripped.upper()) - ord("A")
            return index if index < len(options) else None
        cleaned = OPTION_PREFIX.sub("", _clean_text(stripped))
        if cleaned in options:
            return options.index(cleaned)
    return None


def _parse_study_pack(raw: str) -> dict | None:
    """Validate the model's JSON study pack. Returns None if it is unusable."""
    data = _load_json_object(raw)
    if data is None:
        return None

    key_ideas = [_clean_text(idea) for idea in data.get("key_ideas") or []]
    key_ideas = [idea for idea in key_ideas if idea]

    flashcards = []
    for card in data.get("flashcards") or []:
        if not isinstance(card, dict):
            continue
        question = _clean_text(card.get("question"))
        answer = _clean_text(card.get("answer"))
        if question and answer:
            flashcards.append({"question": question, "answer": answer})

    quiz = []
    for item in data.get("quiz") or []:
        if not isinstance(item, dict):
            continue
        question = _clean_text(item.get("question"))
        options = [OPTION_PREFIX.sub("", _clean_text(option)) for option in item.get("options") or []]
        options = [option for option in options if option]
        answer = _answer_index(item.get("answer"), options)
        if question and len(options) >= 2 and answer is not None:
            quiz.append({
                "question": question,
                "options": options,
                "answer": answer,
                "explanation": _clean_text(item.get("explanation")),
            })

    if not (key_ideas or flashcards or quiz):
        return None
    return {"key_ideas": key_ideas, "flashcards": flashcards, "quiz": quiz}


@router.post("/study")
async def study_document(file: UploadFile = File(...)):
    # Keep the excerpt small enough for a 3B model on CPU to finish in time.
    document_name, text = await _read_pdf(file, max_chars=8000)
    # Instructions go after the text so they are never pushed out of the context.
    prompt = f"""PDF: {document_name}
{text}

---
Create a study pack from the PDF text above only. Keep every fact grounded in the text.
Reply with ONLY a JSON object in exactly this shape:
{{
  "key_ideas": ["one short sentence per key idea"],
  "flashcards": [{{"question": "...", "answer": "short answer"}}],
  "quiz": [{{
    "question": "...",
    "options": ["first option", "second option", "third option", "fourth option"],
    "answer": 0,
    "explanation": "one sentence on why that option is correct"
  }}]
}}
Give 5 key_ideas, 8 flashcards and 5 quiz questions.
"answer" is the 0-based position of the correct option in "options".
"""
    try:
        raw_result = generate_tool_result(
            prompt,
            num_ctx=6144,
            num_predict=1600,
            json_mode=True,
        )
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    # If the model's JSON is unusable, study_pack is None and the frontend
    # falls back to showing the raw text.
    return {
        "document": document_name,
        "study_pack": _parse_study_pack(raw_result),
        "result": raw_result,
    }
