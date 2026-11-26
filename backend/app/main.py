from fastapi import FastAPI

from app.routers.documents import router as documents_router

app = FastAPI(
    title="AI Document Analyzer API",
    description="Backend API for uploading and analyzing documents.",
    version="1.0.0",
)

app.include_router(documents_router)


@app.get("/")
def home():
    return {
        "message": "AI Document Analyzer backend is running!"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }