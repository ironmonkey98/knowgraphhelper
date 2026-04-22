import time

import fitz
import pymupdf4llm

from app.parsers.base import PDFParser, ParsedDocument


class PyMuPDF4LLMParser(PDFParser):
    """基于 PyMuPDF4LLM 的默认实现"""

    def parse(self, pdf_bytes: bytes) -> ParsedDocument:
        start = time.monotonic()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_count = doc.page_count

        md_text = pymupdf4llm.to_markdown(doc)
        doc.close()

        markdown = md_text if isinstance(md_text, str) else "\n".join(md_text)
        elapsed_ms = int((time.monotonic() - start) * 1000)

        return ParsedDocument(
            markdown=markdown,
            page_count=page_count,
            size_bytes=len(pdf_bytes),
            parse_time_ms=elapsed_ms,
        )
