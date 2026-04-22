import asyncio
import uuid

from fastapi import APIRouter, UploadFile, File

from app.core.config import settings
from app.core.errors import not_pdf_error, file_too_large_error, parse_failed_error
from app.parsers.pymupdf4llm_parser import PyMuPDF4LLMParser
from app.schemas.parse import ParseResponse

router = APIRouter(tags=["parse"])

_parser = PyMuPDF4LLMParser()


@router.post("/parse-pdf", response_model=ParseResponse)
async def parse_pdf(file: UploadFile = File(...)):
    # 校验文件类型
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise not_pdf_error()

    content = await file.read()

    # 校验文件大小
    if len(content) > settings.max_file_size_bytes:
        raise file_too_large_error()

    try:
        # run_in_executor 避免阻塞事件循环
        loop = asyncio.get_event_loop()
        parsed = await loop.run_in_executor(None, _parser.parse, content)
    except Exception as e:
        raise parse_failed_error(str(e))

    return ParseResponse(
        document_id=str(uuid.uuid4()),
        markdown=parsed.markdown,
        page_count=parsed.page_count,
        size_bytes=parsed.size_bytes,
        parse_time_ms=parsed.parse_time_ms,
    )
