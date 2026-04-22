#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cleanup() {
  [ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null
  [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null
  echo "已停止所有服务"
}
trap cleanup EXIT INT TERM

echo "=== KnowGraphHelper MVP 开发启动 ==="

# 启动后端
echo "[1/2] 启动后端 (FastAPI :8000)..."
cd "$ROOT_DIR/backend"
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

# 启动前端
echo "[2/2] 启动前端 (Vite :5173)..."
cd "$ROOT_DIR/frontend"
pnpm dev &
FRONTEND_PID=$!

sleep 2

echo ""
echo "后端地址: http://127.0.0.1:8000"
echo "API 文档: http://127.0.0.1:8000/docs"
echo "前端地址: http://localhost:5173"
echo ""
echo "按 Ctrl+C 停止所有服务"

wait
