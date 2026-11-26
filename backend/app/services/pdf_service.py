from pathlib import Path
import fitz


def extract_pages_from_pdf(pdf_path: Path) -> list[str]:
    try:
        with fitz.open(pdf_path) as pdf_document:
            return [page.get_text().strip() for page in pdf_document]

    except Exception as error:
        raise ValueError("Could not extract text from this PDF.") from error


def extract_text_from_pdf(pdf_path: Path) -> str:
    return "\n".join(extract_pages_from_pdf(pdf_path)).strip()