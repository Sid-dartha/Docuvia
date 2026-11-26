def split_text_into_chunks(
    text: str,
    chunk_size: int = 1000,
    overlap: int = 200,
) -> list[str]:
    text = text.strip()

    if not text:
        return []

    chunks = []
    start = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))

        # End at a space when possible, so a word is not cut in half.
        if end < len(text):
            last_space = text.rfind(" ", start, end)

            if last_space > start:
                end = last_space

        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end == len(text):
            break

        # Repeat the last 200 characters in the next chunk.
        start = end - overlap

    return chunks