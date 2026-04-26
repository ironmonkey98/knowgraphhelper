import logging
import sys
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

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


# ── 生产模式：托管前端静态文件（SPA） ──────────────────────────────────────────
# 源码运行时读取 backend/static；PyInstaller 运行时读取打包资源目录中的 static。
def get_static_dir() -> Path:
    bundle_dir = getattr(sys, "_MEIPASS", None)
    if bundle_dir:
        return Path(bundle_dir) / "static"
    return Path(__file__).parent.parent / "static"


_STATIC_DIR = get_static_dir()

if _STATIC_DIR.exists():
    # 挂载静态资源（JS/CSS/图片等）
    assets_dir = _STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # SPA 兜底：所有非 /api 路由返回 index.html，由前端路由接管
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        index = _STATIC_DIR / "index.html"
        return FileResponse(index)
