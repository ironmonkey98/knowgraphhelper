from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class DocCategory(str, Enum):
    guideline = "指南"
    consensus = "共识"
    systematic_review = "系统综述"
    proceedings = "论文集"
    national_standard = "国家标准"
    textbook = "教材"
    occupational_health = "职业健康"
    other = "其他"


class AuthorityLevel(str, Enum):
    authoritative = "权威"
    high = "高"
    general = "一般"
    pending = "待评估"


class ExtractedFields(BaseModel):
    model_config = {"extra": "allow"}

    title: Optional[str] = None
    doc_category: Optional[DocCategory] = None
    received_date: Optional[str] = None
    keywords: Optional[list[str]] = Field(default=None)
    departments: Optional[list[str]] = Field(default=None)
    authority_level: Optional[AuthorityLevel] = None
    authority_basis: Optional[str] = None
    classification: Optional[list[str]] = None


class LlmExtractionResult(BaseModel):
    """与前端 LlmResponseSchema 对齐"""
    model_config = {"extra": "allow"}

    fields: ExtractedFields
    source_snippets: Optional[dict[str, str]] = None
    extraction_confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class TaskStatus(str, Enum):
    parsing = "parsing"
    extracting = "extracting"
    done = "done"
    error = "error"


class TaskResponse(BaseModel):
    task_id: str
    status: TaskStatus
    filename: str
    markdown: Optional[str] = None
    page_count: Optional[int] = None
    parse_time_ms: Optional[int] = None
    result: Optional[dict[str, Any]] = None
    error: Optional[str] = None
