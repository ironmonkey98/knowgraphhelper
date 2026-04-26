import asyncio
import json
from pathlib import Path

import httpx
import pytest
import respx
from httpx import ASGITransport, AsyncClient

from app.main import app

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures"

LLM_HEADERS = {
    "X-LLM-Base-URL": "https://fake-llm.example.com/v1",
    "X-LLM-Api-Key": "test-key-123",
    "X-LLM-Model": "test-model",
}

# 符合 LlmExtractionResult schema 的最小合法响应
VALID_LLM_RESULT = {
    "fields": {
        "title": "测试文献标题",
        "doc_category": "指南",
        "received_date": "2024年1月",
        "keywords": ["关键词A", "关键词B"],
        "departments": ["肿瘤科"],
        "authority_level": "高",
        "authority_basis": "国家卫健委发布",
        "classification": ["肿瘤学"],
    },
    "source_snippets": {"title": "原文片段示例"},
    "extraction_confidence": 0.92,
}

MOCK_LLM_RESP = {
    "id": "chatcmpl-test",
    "choices": [{"message": {"content": json.dumps(VALID_LLM_RESULT, ensure_ascii=False)}, "index": 0}],
}


@pytest.fixture
def simple_pdf() -> bytes:
    with open(FIXTURES / "simple_paper.pdf", "rb") as f:
        return f.read()


@pytest.fixture
def guideline_pdf() -> bytes:
    with open(FIXTURES / "guideline.pdf", "rb") as f:
        return f.read()


# ── 提交任务接口 ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_extract_returns_task_id(simple_pdf: bytes):
    """提交成功后立即返回 task_id"""
    with respx.mock:
        respx.post("https://fake-llm.example.com/v1/chat/completions").mock(
            return_value=httpx.Response(200, json=MOCK_LLM_RESP)
        )
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/extract",
                files={"file": ("simple_paper.pdf", simple_pdf, "application/pdf")},
                data={"doc_type": "single_col", "system_prompt": "你是一个医学文献提取助手"},
                headers=LLM_HEADERS,
            )

    assert resp.status_code == 200
    data = resp.json()
    assert "task_id" in data
    assert len(data["task_id"]) > 0


@pytest.mark.asyncio
async def test_extract_missing_llm_headers(simple_pdf: bytes):
    """缺少 LLM Header 时返回 400"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/extract",
            files={"file": ("simple_paper.pdf", simple_pdf, "application/pdf")},
            data={"doc_type": "single_col", "system_prompt": "prompt"},
        )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_extract_rejects_non_pdf():
    """非 PDF 文件返回 400"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/extract",
            files={"file": ("doc.txt", b"not a pdf", "text/plain")},
            data={"doc_type": "single_col", "system_prompt": "prompt"},
            headers=LLM_HEADERS,
        )
    assert resp.status_code == 400


# ── 轮询接口 ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_task_not_found():
    """不存在的 task_id 返回 404"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/tasks/nonexistent-task-id-000")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_extract_full_pipeline_success(simple_pdf: bytes):
    """完整流水线：提交 → 等待后台任务 → 轮询到 done 状态"""
    with respx.mock:
        respx.post("https://fake-llm.example.com/v1/chat/completions").mock(
            return_value=httpx.Response(200, json=MOCK_LLM_RESP)
        )
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 提交任务
            post_resp = await client.post(
                "/api/extract",
                files={"file": ("simple_paper.pdf", simple_pdf, "application/pdf")},
                data={"doc_type": "single_col", "system_prompt": "你是医学文献提取助手"},
                headers=LLM_HEADERS,
            )
            assert post_resp.status_code == 200
            task_id = post_resp.json()["task_id"]

            # 等待后台异步任务完成（最多 30s）
            for _ in range(30):
                await asyncio.sleep(1)
                poll_resp = await client.get(f"/api/tasks/{task_id}")
                assert poll_resp.status_code == 200
                task = poll_resp.json()
                if task["status"] in ("done", "error"):
                    break

    assert task["status"] == "done", f"任务未完成，状态={task['status']}，错误={task.get('error')}"
    assert task["result"] is not None
    assert task["result"]["extraction_confidence"] == pytest.approx(0.92)
    assert task["result"]["fields"]["title"] == "测试文献标题"


@pytest.mark.asyncio
async def test_extract_llm_failure_sets_error_status(simple_pdf: bytes):
    """LLM 返回错误时任务状态应变为 error"""
    with respx.mock:
        respx.post("https://fake-llm.example.com/v1/chat/completions").mock(
            return_value=httpx.Response(401, json={"error": {"message": "Invalid API key"}})
        )
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            post_resp = await client.post(
                "/api/extract",
                files={"file": ("simple_paper.pdf", simple_pdf, "application/pdf")},
                data={"doc_type": "single_col", "system_prompt": "prompt"},
                headers=LLM_HEADERS,
            )
            task_id = post_resp.json()["task_id"]

            for _ in range(15):
                await asyncio.sleep(1)
                task = (await client.get(f"/api/tasks/{task_id}")).json()
                if task["status"] in ("done", "error"):
                    break

    assert task["status"] == "error"
    assert task["error"] is not None


# ── 双栏解析器单元测试 ────────────────────────────────────────────────────────

def test_double_col_parser_produces_output(simple_pdf: bytes):
    """双栏模式能正常解析并返回非空 markdown"""
    from app.parsers.pymupdf4llm_parser import PyMuPDF4LLMParser
    parser = PyMuPDF4LLMParser()
    result = parser.parse(simple_pdf, doc_type="double_col")
    assert len(result.markdown) > 0
    assert result.page_count >= 1
    assert result.parse_time_ms >= 0


def test_single_col_parser_produces_output(simple_pdf: bytes):
    """单栏模式行为不变"""
    from app.parsers.pymupdf4llm_parser import PyMuPDF4LLMParser
    parser = PyMuPDF4LLMParser()
    result = parser.parse(simple_pdf, doc_type="single_col")
    assert len(result.markdown) > 0


def test_double_col_guideline(guideline_pdf: bytes):
    """双栏模式解析指南 PDF"""
    from app.parsers.pymupdf4llm_parser import PyMuPDF4LLMParser
    parser = PyMuPDF4LLMParser()
    result = parser.parse(guideline_pdf, doc_type="double_col")
    assert len(result.markdown) > 0
    assert result.page_count >= 1
