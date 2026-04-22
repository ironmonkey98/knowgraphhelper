from typing import Any

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    messages: list[dict[str, Any]]
    temperature: float = Field(default=0.0, ge=0.0, le=2.0)
    response_format: dict[str, Any] | None = None
    max_tokens: int | None = None
