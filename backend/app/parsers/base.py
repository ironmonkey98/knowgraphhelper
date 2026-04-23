from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal


@dataclass
class ParsedDocument:
    """PDF 解析结果"""
    markdown: str
    page_count: int
    size_bytes: int
    parse_time_ms: int


DocType = Literal["single_col", "double_col"]


class PDFParser(ABC):
    """可插拔的 PDF 解析器接口，FastAPI 路由中通过 run_in_executor 调用"""
    @abstractmethod
    def parse(self, pdf_bytes: bytes, doc_type: DocType = "single_col") -> ParsedDocument: ...
