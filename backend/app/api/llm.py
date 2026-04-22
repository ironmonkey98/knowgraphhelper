from fastapi import APIRouter, Request

import httpx

from app.core.config import settings
from app.core.errors import llm_proxy_error
from app.schemas.llm import ChatRequest

router = APIRouter(tags=["llm"])

# 错误码映射：上游 → 本代理
_STATUS_MAP = {
    400: 400,
    401: 401,
    403: 403,
    429: 429,
    500: 502,
    502: 502,
    503: 504,
}


@router.post("/llm/chat")
async def llm_chat(body: ChatRequest, request: Request):
    base_url = request.headers.get("X-LLM-Base-URL")
    api_key = request.headers.get("X-LLM-Api-Key")
    model = request.headers.get("X-LLM-Model")

    if not all([base_url, api_key, model]):
        raise llm_proxy_error(400, "缺少必要 Header：X-LLM-Base-URL / X-LLM-Api-Key / X-LLM-Model")

    # 构建转发请求
    url = f"{base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload: dict = {
        "model": model,
        "messages": body.messages,
        "temperature": body.temperature,
    }
    if body.response_format is not None:
        payload["response_format"] = body.response_format
    if body.max_tokens is not None:
        payload["max_tokens"] = body.max_tokens

    # 每请求新建 client，凭证不落盘
    async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
        except httpx.TimeoutException:
            raise llm_proxy_error(504, "LLM 请求超时")
        except httpx.ConnectError:
            raise llm_proxy_error(502, "无法连接 LLM 服务")

    # 映射上游错误码
    if resp.status_code >= 400:
        mapped = _STATUS_MAP.get(resp.status_code, 502)
        try:
            detail = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            detail = resp.text
        raise llm_proxy_error(mapped, detail)

    return resp.json()
