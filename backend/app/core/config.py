from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    host: str = "127.0.0.1"
    port: int = 8000
    cors_origins: list[str] | None = None
    max_file_size_bytes: int = 50 * 1024 * 1024  # 50 MB
    llm_timeout_seconds: int = 180

    def __post_init__(self):
        if self.cors_origins is None:
            # 同时支持 Vite 默认端口和端口被占用时的备选端口
            object.__setattr__(self, "cors_origins", [
                "http://localhost:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5173",
                "http://127.0.0.1:5174",
            ])


settings = Settings()
