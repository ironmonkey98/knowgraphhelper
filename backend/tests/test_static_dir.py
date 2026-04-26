import sys

from app.main import get_static_dir


def test_get_static_dir_prefers_pyinstaller_bundle(monkeypatch, tmp_path):
    bundled_static = tmp_path / "static"
    bundled_static.mkdir()
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path), raising=False)

    assert get_static_dir() == bundled_static
