import threading
import time
import webbrowser

import uvicorn

from app.core.config import settings


def open_browser() -> None:
    time.sleep(1.5)
    webbrowser.open(f"http://{settings.host}:{settings.port}")


if __name__ == "__main__":
    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=False)
