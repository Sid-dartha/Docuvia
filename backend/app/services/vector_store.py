import json
import re
from pathlib import Path
from typing import Any

import faiss
import fitz
import numpy as np

EMBEDDING_DIMENSIONS = 384

BACKEND_FOLDER = Path(__file__).resolve().parents[2]
STORAGE_FOLDER = BACKEND_FOLDER / "storage"
UPLOADS_FOLDER = BACKEND_FOLDER / "uploads"
INDEX_FILE = STORAGE_FOLDER / "document_index.faiss"
METADATA_FILE = STORAGE_FOLDER / "document_metadata.json"

STORAGE_FOLDER.mkdir(exist_ok=True)


class VectorStore:
    def __init__(self):
        self.index = faiss.IndexFlatIP(EMBEDDING_DIMENSIONS)
        self.metadata: list[dict[str, Any]] = []

        self.load()

    def load(self) -> None:
        if not INDEX_FILE.exists() or not METADATA_FILE.exists():
            return

        self.index = faiss.read_index(str(INDEX_FILE))

        with open(METADATA_FILE, "r", encoding="utf-8") as metadata_file:
            self.metadata = json.load(metadata_file)

        if self._backfill_page_numbers():
            self.save()

    def _backfill_page_numbers(self) -> bool:
        changed = False
        page_cache: dict[str, list[str]] = {}

        for item in self.metadata:
            if item.get("page_number") is not None:
                continue

            document_name = item.get("document_name")
            chunk_text = item.get("text", "")
            if not document_name or not chunk_text:
                continue

            if document_name not in page_cache:
                document_path = UPLOADS_FOLDER / document_name
                if not document_path.exists():
                    page_cache[document_name] = []
                else:
                    with fitz.open(document_path) as document:
                        page_cache[document_name] = [
                            re.sub(r"\s+", " ", page.get_text()).strip().lower()
                            for page in document
                        ]

            normalized_chunk = re.sub(r"\s+", " ", chunk_text).strip().lower()
            search_text = normalized_chunk[:80]
            for page_number, page_text in enumerate(page_cache[document_name], start=1):
                if search_text and search_text in page_text:
                    item["page_number"] = page_number
                    changed = True
                    break

        return changed

    def save(self) -> None:
        faiss.write_index(self.index, str(INDEX_FILE))

        with open(METADATA_FILE, "w", encoding="utf-8") as metadata_file:
            json.dump(
                self.metadata,
                metadata_file,
                ensure_ascii=False,
                indent=2,
            )

    def add_chunks(
        self,
        document_name: str,
        chunks: list[str],
        embeddings: list[list[float]],
        page_numbers: list[int] | None = None,
    ) -> None:
        if len(chunks) != len(embeddings):
            raise ValueError("Chunks and embeddings must have the same length.")
        if page_numbers is not None and len(chunks) != len(page_numbers):
            raise ValueError("Chunks and page numbers must have the same length.")

        if not embeddings:
            return

        vectors = np.array(embeddings, dtype="float32")

        if vectors.shape[1] != EMBEDDING_DIMENSIONS:
            raise ValueError("Embedding dimensions do not match the FAISS index.")

        self.index.add(vectors)

        for chunk_number, chunk in enumerate(chunks, start=1):
            metadata = {
                "document_name": document_name,
                "chunk_number": chunk_number,
                "text": chunk,
            }
            if page_numbers is not None:
                metadata["page_number"] = page_numbers[chunk_number - 1]
            self.metadata.append(metadata)

        self.save()

    def search(
        self,
        query_embedding: list[float],
        top_k: int = 3,
    ) -> list[dict[str, Any]]:
        if self.index.ntotal == 0:
            return []

        query_vector = np.array([query_embedding], dtype="float32")
        number_of_results = min(top_k, self.index.ntotal)

        scores, indexes = self.index.search(query_vector, number_of_results)

        results = []

        for score, index in zip(scores[0], indexes[0]):
            if index == -1:
                continue

            result = self.metadata[index].copy()
            result["similarity_score"] = round(float(score), 4)
            results.append(result)

        return results

    def total_vectors(self) -> int:
        return self.index.ntotal


vector_store = VectorStore()