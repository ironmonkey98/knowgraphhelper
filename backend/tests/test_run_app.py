import run_app


def test_run_app_imports_fastapi_app():
    assert run_app.app.title == "KnowGraphHelper"
