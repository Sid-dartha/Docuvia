from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    question: str = Field(
        min_length=1,
        description="The question to search for in uploaded documents.",
    )
    top_k: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Number of relevant chunks to return.",
    )