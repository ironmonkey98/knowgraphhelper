import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.parse import router as parse_router
from app.api.llm import router as llm_router
from app.api.extract import router as extract_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("kgh")

app = FastAPI(title="KnowGraphHelper", version="0.1.0")


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    try:
        response = await call_next(request)
    except Exception as e:
        logger.error(f"UNHANDLED {request.method} {request.url.path}: {e}")
        raise
    elapsed = (time.time() - start) * 1000
    logger.info(f"{request.method} {request.url.path} [{response.status_code}] {elapsed:.0f}ms")
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parse_router, prefix="/api")
app.include_router(llm_router, prefix="/api")
app.include_router(extract_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
