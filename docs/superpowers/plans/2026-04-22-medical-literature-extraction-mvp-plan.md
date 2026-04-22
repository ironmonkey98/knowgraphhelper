# 执行计划：医学文献解析提取引擎 MVP

> **日期**: 2026-04-22
> **基于**: `docs/superpowers/specs/2026-04-22-medical-literature-extraction-mvp-design.md`
> **方法**: TDD（先后端 2 接口 → 前端 3 页面 → 集成联调 → UAT）

---

## Phase 1: 后端基础搭建（FastAPI + PDF 解析）

### Task 1.1: 项目骨架 + pyproject.toml
- [ ] 初始化 `backend/` 目录结构
- [ ] `pyproject.toml`（fastapi, uvicorn, pymupdf4llm, httpx, python-multipart）
- [ ] `app/main.py`：FastAPI 入口 + CORS（允许 localhost:5173）
- [ ] `app/core/config.py`：端口/文件大小/超时配置
- [ ] `app/core/errors.py`：统一错误响应格式

### Task 1.2: PDF 解析接口
- [ ] `app/parsers/base.py`：PDFParser 抽象接口 + ParsedDocument dataclass
- [ ] `app/parsers/pymupdf4llm_parser.py`：PyMuPDF4LLM 实现
- [ ] `app/schemas/parse.py`：ParseResponse schema
- [ ] `app/api/parse.py`：POST /api/parse-pdf 路由
- [ ] **测试**：`tests/test_parse.py`（3 fixture PDF：双栏/表格/指南）

### Task 1.3: LLM 代理接口
- [ ] `app/schemas/llm.py`：ChatRequest/ChatResponse
- [ ] `app/api/llm.py`：POST /api/llm/chat（无状态转发，60s 超时）
- [ ] **测试**：`tests/test_llm.py`（mock httpx，验证 header 透传 + 错误码映射）

### Task 1.4: dev.sh 启动脚本
- [ ] 根目录 `dev.sh`（启动后端）

---

## Phase 2: 前端基础搭建（React + Vite + shadcn）

### Task 2.1: 项目骨架
- [ ] `pnpm create vite frontend --template react-ts`
- [ ] 安装依赖：zustand, react-router-dom, react-markdown, remark-gfm, react-hook-form, @hookform/resolvers, zod, xlsx, idb, clsx, tailwind-merge
- [ ] 配置 Tailwind CSS + shadcn/ui（13 组件）
- [ ] `vite.config.ts` 代理 `/api` → `localhost:8000`

### Task 2.2: 类型 + Schema + Store
- [ ] `src/types/index.ts`：Document 接口定义
- [ ] `src/schemas/fields.ts`：ExtractedFields Zod schema
- [ ] `src/schemas/llmResponse.ts`：LlmResponse Zod schema
- [ ] `src/stores/llmConfigStore.ts`：Zustand + persist
- [ ] `src/stores/documentsStore.ts`：Zustand + persist
- [ ] `src/stores/uiStore.ts`：临时状态
- [ ] **测试**：`src/schemas/__tests__/llmResponse.test.ts`（合法/非法 JSON）

### Task 2.3: 服务层
- [ ] `src/services/storageService.ts`：localStorage + IndexedDB
- [ ] `src/services/parseService.ts`：调 /api/parse-pdf
- [ ] `src/services/llmService.ts`：调 /api/llm/chat + 重试逻辑
- [ ] `src/services/exportService.ts`：Excel 导出（xlsx.writeFile）
- [ ] **测试**：`src/services/__tests__/storageService.test.ts`

### Task 2.4: Prompts
- [ ] `src/prompts/paperPrompt.ts`：论文管线 system + user prompt
- [ ] `src/prompts/guidelinePrompt.ts`：指南管线 system + user prompt
- [ ] `src/prompts/version.ts`：版本号

---

## Phase 3: 前端页面实现

### Task 3.1: AppShell + 路由
- [ ] `src/App.tsx`：React Router 路由配置
- [ ] `src/components/layout/AppShell.tsx`：顶部导航 + Outlet

### Task 3.2: UploadPage
- [ ] `src/components/upload/Dropzone.tsx`：拖拽上传 + 文件选择
- [ ] `src/pages/UploadPage.tsx`：文献类型选择 + 解析触发 + 状态流转
- [ ] `src/components/settings/LlmConfigDialog.tsx`：LLM 配置弹窗 + 测试连接

### Task 3.3: ReviewPage（核心）
- [ ] `src/components/review/MarkdownPanel.tsx`：react-markdown + 溯源高亮
- [ ] `src/components/review/FieldRow.tsx`：单字段行 + 溯源悬浮卡
- [ ] `src/components/review/FieldForm.tsx`：14 字段分组折叠表单
- [ ] `src/components/review/PdfPreviewModal.tsx`：PDF 预览弹窗
- [ ] `src/pages/ReviewPage.tsx`：2 列布局 + 保存逻辑

### Task 3.4: RecordsPage
- [ ] `src/pages/RecordsPage.tsx`：表格 + 筛选 + 批量导出 + 删除

---

## Phase 4: 集成 + 收尾

### Task 4.1: 端到端联调
- [ ] 完整流程测试：上传 → 解析 → LLM 提取 → 审核 → 导出
- [ ] 错误处理验证（401/429/502/422）
- [ ] 刷新浏览器数据持久化验证

### Task 4.2: dev.sh 完整版
- [ ] 同时启动前后端
- [ ] 根目录 README.md

### Task 4.3: 手动 UAT（10 条验收清单）
- [ ] 拖拽上传 PDF（≤50MB）+ 类型选择
- [ ] PyMuPDF4LLM 解析 Markdown
- [ ] 14 字段 + source_snippets + confidence 输出
- [ ] Zod 校验失败重试
- [ ] 审核页 2 列布局
- [ ] 字段溯源跳转高亮
- [ ] 保存状态流转
- [ ] 批量导出 Excel
- [ ] LlmConfigDialog 首次强制弹窗
- [ ] 关键路径自动化测试全绿

---

## 执行顺序

```
Phase 1（后端） → Phase 2（前端基础） → Phase 3（前端页面） → Phase 4（集成）
         ↓                ↓                      ↓                  ↓
     Task 1.1-1.4     Task 2.1-2.4          Task 3.1-3.4        Task 4.1-4.3
```

## 预估时间（CC+gstack）

| Phase | 预估 |
|-------|------|
| Phase 1 | ~45 min |
| Phase 2 | ~30 min |
| Phase 3 | ~60 min |
| Phase 4 | ~30 min |
| **总计** | **~2.5 小时** |
