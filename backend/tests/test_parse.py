import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

FIXTURES = "/Users/yehong/knowgraphhelper/fixtures"


@pytest.fixture
def simple_pdf() -> bytes:
    with open(f"{FIXTURES}/simple_paper.pdf", "rb") as f:
        return f.read()


@pytest.fixture
def empty_pdf() -> bytes:
    with open(f"{FIXTURES}/empty_page.pdf", "rb") as f:
        return f.read()


@pytest.fixture
def guideline_pdf() -> bytes:
    with open(f"{FIXTURES}/guideline.pdf", "rb") as f:
        return f.read()


@pytest.mark.asyncio
async def test_parse_simple_paper(simple_pdf: bytes):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/parse-pdf",
            files={"file": ("simple_paper.pdf", simple_pdf, "application/pdf")},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["document_id"]
    assert len(data["markdown"]) > 0
    assert data["page_count"] >= 1
    assert data["size_bytes"] > 0
    assert data["parse_time_ms"] >= 0


@pytest.mark.asyncio
async def test_parse_guideline(guideline_pdf: bytes):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/parse-pdf",
            files={"file": ("guideline.pdf", guideline_pdf, "application/pdf")},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "Guideline" in data["markdown"] or "guideline" in data["markdown"]


@pytest.mark.asyncio
async def test_parse_empty_pdf(empty_pdf: bytes):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/parse-pdf",
            files={"file": ("empty.pdf", empty_pdf, "application/pdf")},
        )
    assert resp.status_code == 200
    data = resp.json()
    # 空 PDF 解析出空 markdown 是合理的
    assert data["page_count"] >= 1


@pytest.mark.asyncio
async def test_reject_non_pdf():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/parse-pdf",
            files={"file": ("test.txt", b"hello", "text/plain")},
        )
    assert resp.status_code == 400
