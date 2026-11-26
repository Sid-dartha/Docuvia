import json
import urllib.error
import urllib.request

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3.2:3b"
NO_SUITABLE_ANSWER = "No suitable answer found from the PDFs."


def generate_answer(
    question: str,
    search_results: list[dict],
) -> str:
    sources = []

    for result in search_results:
        sources.append(
            f"PDF: {result['document_name']}\n"
            f"Source {result['chunk_number']} (page {result.get('page_number', 'unknown')}):\n"
            f"{result['text']}"
        )

    context = "\n\n---\n\n".join(sources)

    prompt = f"""
You are a document question-answering assistant.

Answer the QUESTION using only the SOURCES below.
Do not use outside knowledge.
If the QUESTION is unrelated to the SOURCES, or the SOURCES do not contain
enough information to answer it, reply with exactly:
"{NO_SUITABLE_ANSWER}"
Do not use outside knowledge. Do not guess or combine unrelated facts.

SOURCES:
{context}

QUESTION:
{question}

Give a clear, direct answer.
"""

    request_data = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.2,
        },
    }

    request = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(request_data).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            response_data = json.loads(
                response.read().decode("utf-8")
            )

        answer = response_data["response"].strip()
        if NO_SUITABLE_ANSWER.lower() in answer.lower():
            return NO_SUITABLE_ANSWER
        return answer

    except TimeoutError as error:
        raise RuntimeError(
            "The local Ollama model took too long to answer. Please try again."
        ) from error
    except (OSError, json.JSONDecodeError, KeyError) as error:
        # OSError covers urllib.error.URLError and connection resets.
        raise RuntimeError(
            "Could not get an answer from the local Ollama model. Is Ollama running?"
        ) from error


def generate_tool_result(
    prompt: str,
    num_ctx: int = 8192,
    num_predict: int = 1200,
    timeout: int = 600,
    json_mode: bool = False,
) -> str:
    request_data = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.2,
            # Ollama's default context window is small and silently drops the
            # start of long prompts, so size it for the document + instructions.
            "num_ctx": num_ctx,
            "num_predict": num_predict,
        },
    }
    if json_mode:
        # Ask Ollama to constrain the output to valid JSON.
        request_data["format"] = "json"
    request = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(request_data).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            response_data = json.loads(response.read().decode("utf-8"))
        return response_data["response"].strip()
    except TimeoutError as error:
        raise RuntimeError(
            "The local Ollama model took too long to respond. Try a shorter PDF."
        ) from error
    except (OSError, json.JSONDecodeError, KeyError) as error:
        # OSError covers urllib.error.URLError and connection resets.
        raise RuntimeError(
            "Could not get a result from the local Ollama model. Is Ollama running?"
        ) from error