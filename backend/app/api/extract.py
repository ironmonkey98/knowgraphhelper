import asyncio
import json
import logging
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, BackgroundTasks, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.errors import file_too_large_error, not_pdf_error
from app.parsers.pymupdf4llm_parser import PyMuPDF4LLMParser
from app.schemas.extract import LlmExtractionResult, TaskResponse, TaskStatus

logger = logging.getLogger("kgh.extract")
router = APIRouter(tags=["extract"])

_parser = PyMuPDF4LLMParser()

# 内存任务表：task_id → 任务数据（单用户，进程内存即可）
_tasks: dict[str, dict[str, Any]] = {}


# ── 提交提取任务 ──────────────────────────────────────────────────────────────

@router.post("/extract")
async def start_extraction(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    doc_type: str = Form(default="single_col"),
    system_prompt: str = Form(...),
):
    base_url = request.headers.get("X-LLM-Base-URL", "")
    api_key = request.headers.get("X-LLM-Api-Key", "")
    model = request.headers.get("X-LLM-Model", "")
    temperature = float(request.headers.get("X-LLM-Temperature", "0.0"))

    if not all([base_url, api_key, model]):
        return JSONResponse(status_code=400, content={"detail": "缺少 LLM 配置 Header（X-LLM-Base-URL / X-LLM-Api-Key / X-LLM-Model）"})

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise not_pdf_error()

    content = await file.read()
    if len(content) > settings.max_file_size_bytes:
        raise file_too_large_error()

    task_id = str(uuid.uuid4())
    _tasks[task_id] = {
        "task_id": task_id,
        "status": TaskStatus.parsing,
        "filename": file.filename,
        "markdown": None,
        "page_count": None,
        "parse_time_ms": None,
        "result": None,
        "error": None,
    }

    background_tasks.add_task(
        _run_pipeline,
        task_id=task_id,
        content=content,
        doc_type=doc_type,
        system_prompt=system_prompt,
        base_url=base_url,
        api_key=api_key,
        model=model,
        temperature=temperature,
    )

    logger.info(f"提取任务已创建 task_id={task_id} file={file.filename}")
    return {"task_id": task_id}


# ── 轮询任务状态 ──────────────────────────────────────────────────────────────

@router.get("/tasks/{task_id}")
async def get_task(task_id: str):
    task = _tasks.get(task_id)
    if task is None:
        return JSONResponse(status_code=404, content={"detail": "任务不存在（服务可能已重启）"})
    return task


# ── 后台流水线 ────────────────────────────────────────────────────────────────

async def _run_pipeline(
    task_id: str,
    content: bytes,
    doc_type: str,
    system_prompt: str,
    base_url: str,
    api_key: str,
    model: str,
    temperature: float,
) -> None:
    try:
        # 1. PDF 解析 → Markdown（双栏使用列感知解析）
        loop = asyncio.get_event_loop()
        parsed = await loop.run_in_executor(None, _parser.parse, content, doc_type)
        _tasks[task_id].update({
            "status": TaskStatus.extracting,
            "markdown": parsed.markdown,
            "page_count": parsed.page_count,
            "parse_time_ms": parsed.parse_time_ms,
        })
        logger.info(f"[{task_id}] PDF 解析完成，pages={parsed.page_count}")

        # 2. 构造 Prompt
        layout_hint = (
            "（注意：此 PDF 为双栏排版，内容可能存在跨栏拼接，请仔细识别段落归属）"
            if doc_type == "double_col" else ""
        )
        user_prompt = f"请从以下医学文献 Markdown 中提取字段{layout_hint}\n\n[Markdown]\n{parsed.markdown}"

        # 3. 首次 LLM 调用
        raw = await _call_llm(base_url, api_key, model, temperature, system_prompt, user_prompt)

        # 4. Pydantic 校验（失败重试 1 次）
        validated = _validate(raw)
        if validated is None:
            logger.warning(f"[{task_id}] 首次校验失败，开始重试")
            errors = _extract_errors(raw)
            retry_messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
                {"role": "assistant", "content": json.dumps(raw, ensure_ascii=False)},
                {
                    "role": "user",
                    "content": (
                        f"你上次输出不符合 schema，错误：{errors}\n"
                        "请严格按照 JSON Schema 重新输出（不含解释文字）。原输入不变。"
                    ),
                },
            ]
            raw = await _call_llm_with_messages(base_url, api_key, model, temperature, retry_messages)
            validated = _validate(raw)
            if validated is None:
                raise ValueError(f"LLM 响应校验失败（已重试 1 次）：{_extract_errors(raw)}")

        _tasks[task_id].update({
            "status": TaskStatus.done,
            "result": validated.model_dump(),
        })
        logger.info(f"[{task_id}] 提取完成，置信度={validated.extraction_confidence}")

    except Exception as exc:
        msg = str(exc)
        logger.error(f"[{task_id}] 流水线失败: {msg}")
        _tasks[task_id].update({"status": TaskStatus.error, "error": msg})


# ── LLM 调用工具函数 ──────────────────────────────────────────────────────────

async def _call_llm(
    base_url: str, api_key: str, model: str, temperature: float,
    system_prompt: str, user_prompt: str,
) -> Any:
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    return await _call_llm_with_messages(base_url, api_key, model, temperature, messages)


async def _call_llm_with_messages(
    base_url: str, api_key: str, model: str, temperature: float,
    messages: list[dict],
) -> Any:
    url = f"{base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "response_format": {"type": "json_object"},
    }
    async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
        resp = await client.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        )
    if resp.status_code >= 400:
        raise ValueError(f"LLM 服务返回错误 [{resp.status_code}]: {resp.text[:300]}")

    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    # content 可能是字符串（JSON 文本）或已被解析的 dict
    if isinstance(content, str):
        return json.loads(content)
    return content


def _validate(raw: Any) -> LlmExtractionResult | None:
    try:
        return LlmExtractionResult.model_validate(raw)
    except Exception:
        return None


def _extract_errors(raw: Any) -> str:
    try:
        LlmExtractionResult.model_validate(raw)
        return ""
    except Exception as e:
        return str(e)[:500]
