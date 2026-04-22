import json

import httpx
import pytest
import respx
from httpx import ASGITransport, AsyncClient

from app.main import app

LLM_HEADERS = {
    "X-LLM-Base-URL": "https://fake-llm.example.com/v1",
    "X-LLM-Api-Key": "test-key-123",
    "X-LLM-Model": "test-model",
}

MOCK_LLM_RESPONSE = {
    "id": "chatcmpl-123",
    "choices": [{"message": {"content": '{"fields": {}}'}, "index": 0}],
}


def _http_response(status_code: int, json_body=None, text_body=None) -> httpx.Response:
    return httpx.Response(status_code, json=json_body, text=text_body)


@pytest.mark.asyncio
async def test_llm_chat_success():
    with respx.mock:
        respx.post("https://fake-llm.example.com/v1/chat/completions").mock(
            return_value=_http_response(200, json_body=MOCK_LLM_RESPONSE)
        )

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/llm/chat",
                json={"messages": [{"role": "user", "content": "test"}]},
                headers=LLM_HEADERS,
            )

    assert resp.status_code == 200
    data = resp.json()
    assert "choices" in data


@pytest.mark.asyncio
async def test_llm_chat_missing_headers():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/llm/chat",
            json={"messages": [{"role": "user", "content": "test"}]},
        )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_llm_chat_upstream_401():
    with respx.mock:
        respx.post("https://fake-llm.example.com/v1/chat/completions").mock(
            return_value=_http_response(401, json_body={"error": {"message": "Invalid API key"}})
        )

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/llm/chat",
                json={"messages": [{"role": "user", "content": "test"}]},
                headers=LLM_HEADERS,
            )

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_llm_chat_upstream_429():
    with respx.mock:
        respx.post("https://fake-llm.example.com/v1/chat/completions").mock(
            return_value=_http_response(429, json_body={"error": {"message": "Rate limit"}})
        )

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/llm/chat",
                json={"messages": [{"role": "user", "content": "test"}]},
                headers=LLM_HEADERS,
            )

    assert resp.status_code == 429


@pytest.mark.asyncio
async def test_llm_chat_upstream_500_maps_to_502():
    with respx.mock:
        respx.post("https://fake-llm.example.com/v1/chat/completions").mock(
            return_value=_http_response(500, text_body="Internal Server Error")
        )

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/llm/chat",
                json={"messages": [{"role": "user", "content": "test"}]},
                headers=LLM_HEADERS,
            )

    assert resp.status_code == 502


@pytest.mark.asyncio
async def test_llm_chat_timeout():
    with respx.mock:
        respx.post("https://fake-llm.example.com/v1/chat/completions").mock(
            side_effect=httpx.ReadTimeout("timeout")
        )

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/llm/chat",
                json={"messages": [{"role": "user", "content": "test"}]},
                headers=LLM_HEADERS,
            )

    assert resp.status_code == 504


@pytest.mark.asyncio
async def test_llm_chat_passes_optional_fields():
    """验证 response_format 和 max_tokens 被正确透传"""
    with respx.mock:
        route = respx.post("https://fake-llm.example.com/v1/chat/completions").mock(
            return_value=_http_response(200, json_body=MOCK_LLM_RESPONSE)
        )

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/llm/chat",
                json={
                    "messages": [{"role": "user", "content": "test"}],
                    "temperature": 0.5,
                    "response_format": {"type": "json_object"},
                    "max_tokens": 4096,
                },
                headers=LLM_HEADERS,
            )

    assert resp.status_code == 200
    received = route.calls[0].request
    body = json.loads(received.content)
    assert body["temperature"] == 0.5
    assert body["response_format"] == {"type": "json_object"}
    assert body["max_tokens"] == 4096
