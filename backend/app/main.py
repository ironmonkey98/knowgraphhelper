from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.parse import router as parse_router
from app.api.llm import router as llm_router

app = FastAPI(title="KnowGraphHelper", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parse_router, prefix="/api")
app.include_router(llm_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
