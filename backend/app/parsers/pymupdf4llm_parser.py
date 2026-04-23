import time

import fitz
import pymupdf4llm

from app.parsers.base import DocType, PDFParser, ParsedDocument


class PyMuPDF4LLMParser(PDFParser):
    """
    基于 PyMuPDF4LLM 的默认实现。
    - single_col：直接调用 to_markdown，保留富文本（表格、标题等）
    - double_col：逐页提取文本块并按列排序（左栏→右栏），避免跨栏乱序
    """

    def parse(self, pdf_bytes: bytes, doc_type: DocType = "single_col") -> ParsedDocument:
        start = time.monotonic()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_count = doc.page_count

        if doc_type == "double_col":
            markdown = self._parse_double_col(doc)
        else:
            md = pymupdf4llm.to_markdown(doc)
            markdown = md if isinstance(md, str) else "\n".join(md)

        doc.close()
        elapsed_ms = int((time.monotonic() - start) * 1000)

        return ParsedDocument(
            markdown=markdown,
            page_count=page_count,
            size_bytes=len(pdf_bytes),
            parse_time_ms=elapsed_ms,
        )

    def _parse_double_col(self, doc: fitz.Document) -> str:
        """
        双栏列感知解析：
        1. 逐页获取文本块及其坐标
        2. 以页面中线为分界，分左右栏
        3. 各栏按 y 轴从上到下排序，左栏先右栏后合并
        4. 用页面分隔符拼接全文
        """
        pages_text: list[str] = []

        for page in doc:
            # 获取所有文本块：(x0, y0, x1, y1, text, block_no, block_type)
            raw_blocks = page.get_text("blocks", sort=False)
            # block_type == 0 为文本块，过滤图片/表格等非文本内容
            text_blocks = [
                (b[0], b[1], b[2], b[3], b[4])
                for b in raw_blocks
                if b[6] == 0 and b[4].strip()
            ]

            if not text_blocks:
                continue

            page_width = page.rect.width
            mid_x = page_width / 2

            # 以块中心 x 判断左右栏
            left_col = [b for b in text_blocks if (b[0] + b[2]) / 2 < mid_x]
            right_col = [b for b in text_blocks if (b[0] + b[2]) / 2 >= mid_x]

            # 各栏内部按顶部 y 坐标从小到大排序
            left_col.sort(key=lambda b: b[1])
            right_col.sort(key=lambda b: b[1])

            # 左栏 + 右栏合并，段落间空行分隔
            ordered_text = "\n\n".join(
                b[4].strip() for b in (left_col + right_col) if b[4].strip()
            )
            pages_text.append(ordered_text)

        # 页面间用水平分隔线区隔
        return "\n\n---\n\n".join(pages_text)
