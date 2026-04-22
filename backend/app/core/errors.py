from fastapi import HTTPException


class AppError(HTTPException):
    """统一错误响应基类"""
    def __init__(self, status_code: int, detail: str):
        super().__init__(status_code=status_code, detail=detail)


def not_pdf_error() -> AppError:
    return AppError(400, "仅支持 PDF 文件")


def file_too_large_error() -> AppError:
    return AppError(413, "文件超过 50MB 限制")


def parse_failed_error(reason: str = "PDF 解析失败") -> AppError:
    return AppError(422, reason)


def llm_proxy_error(status_code: int, detail: str) -> AppError:
    return AppError(status_code, detail)
