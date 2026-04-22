# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**KnowGraphHelper** — 医学文献解析提取引擎 MVP。将医学文献（临床研究论文 + 卫健委指南）PDF 端到端转化为可审核、可导出的结构化知识（14 字段 JSON + Excel）。

**关键约束**：仅电子版 PDF（无扫描件/OCR）、单机单用户、BYOK（用户自带 LLM API Key）、数据纯本地存储。

## 架构

```
前端 React SPA (localhost:5173)
  ├─ 3 页面：UploadPage → ReviewPage → RecordsPage
  ├─ 状态：Zustand（persist 中间件）
  ├─ 持久：localStorage + IndexedDB（PDF Blob）
  └─ 服务层：parse / llm / export / storage

后端 FastAPI (localhost:8000) — 无状态，仅 2 接口
  ├─ POST /api/parse-pdf      → PyMuPDF4LLM → Markdown
  └─ POST /api/llm/chat        → OpenAI 兼容代理，透传 LLM 请求
```

- **前端**：Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui + Zustand + react-hook-form + Zod + xlsx + idb
- **后端**：Python 3.11+ / FastAPI / PyMuPDF4LLM / httpx / uvicorn（用 uv 管理依赖）
- **LLM**：Qwen-Max 为基准，OpenAI 兼容协议，后端无状态代理

## 开发命令

```bash
# 后端
cd backend && uv sync && uv run uvicorn app.main:app --port 8000

# 前端
cd frontend && pnpm install && pnpm dev

# 同时启动（MVP 方式）
./dev.sh        # Mac/Linux
./dev.bat       # Windows

# 后端测试
cd backend && uv run pytest

# 前端测试
cd frontend && pnpm test
```

## 核心设计决策

| 决策 | 锁定值 |
|---|---|
| 文献类型 | 论文 80% + 卫健委指南 20%（手动路由，双管线 Prompt） |
| 字段集 | 14 字段（L1 标签 8 + L2 事实 6），一次 LLM 调用全量输出 |
| 字段溯源 | 每字段带 source_snippet，悬停显示原文、点击跳转 Markdown |
| PDF 解析 | PyMuPDF4LLM（可插拔 PDFParser 接口） |
| 数据存储 | localStorage（2 key）+ IndexedDB（PDF Blob），无后端数据库 |
| LLM 代理 | 后端 `/api/llm/chat` 无状态转发，凭证不落盘 |

## 项目结构

```
knowgraphhelper/
├── backend/           # FastAPI 后端
│   └── app/
│       ├── main.py              # FastAPI 入口 + CORS
│       ├── api/                 # parse.py, llm.py
│       ├── parsers/             # base.py(接口), pymupdf4llm_parser.py(实现)
│       ├── schemas/             # parse.py, llm.py
│       └── core/                # config.py, errors.py
├── frontend/          # React SPA
│   └── src/
│       ├── pages/               # Upload/Review/Records
│       ├── components/          # layout, upload, review, settings, ui(shadcn)
│       ├── stores/              # Zustand: llmConfig, documents, ui
│       ├── services/            # parse, llm, export, storage
│       ├── prompts/             # paperPrompt, guidelinePrompt
│       ├── schemas/             # fields.ts(Zod), llmResponse.ts
│       └── types/
├── fixtures/          # 测试 PDF
├── docs/              # 设计文档
└── plan.md            # 进度断点索引
```

## 数据流

上传 PDF → 选择类型（论文/指南）→ 后端解析为 Markdown → 前端选 Prompt 调 LLM → Zod 校验（失败重试 1 次）→ 审核页 2 列（左 Markdown + 右表单）→ 保存/导出 Excel

## LLM 响应校验

Zod schema 定义在 `frontend/src/schemas/llmResponse.ts`。校验失败自动重试 1 次，反馈 Prompt 包含 Zod flatten 错误信息。全 null 响应（confidence < 0.3）仍进审核页，显示红色警告横幅。

## 编码规范

- UTF-8 编码，中文注释（解释设计意图）
- 保持项目既有风格
- SOLID/KISS/DRY/YAGNI 原则
- 每次修改前查看 `plan.md` 记录断点

## 设计文档

完整 MVP 设计规格：`docs/superpowers/specs/2026-04-22-medical-literature-extraction-mvp-design.md`
