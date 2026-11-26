from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    question: str = Field(
        min_length=1,
        description="Question to answer using the uploaded documents.",
    )
    top_k: int = Field(
        default=3,
        ge=1,
        le=5,
        description="Number of relevant document chunks to use.",
    )
    