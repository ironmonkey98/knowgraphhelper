from pydantic import BaseModel


class ParseResponse(BaseModel):
    document_id: str
    markdown: str
    page_count: int
    size_bytes: int
    parse_time_ms: int
