# Task Plan: UploadPage 批量上传功能

## Goal
在 UploadPage.tsx 中支持批量上传最多 10 个 PDF，统一布局，一键并行提交。

## Phases
- [ ] Phase 1: 状态改造 — `File | null` → `File[]`，input 加 multiple
- [ ] Phase 2: 文件管理逻辑 — 去重、上限、过滤、删除
- [ ] Phase 3: UI 改造 — 文件列表展示 + 拖拽区适配
- [ ] Phase 4: 提交逻辑 — Promise.all 并行提交 + 进度显示
- [ ] Phase 5: 验证 — 本地测试批量上传流程

## Key Decisions
- 统一布局（所有文件共用单栏/双栏设置）
- 并行提交（Promise.all）
- 仅改 1 个文件：UploadPage.tsx
- 后端零改动

## Status
**Currently in Phase 1** — 开始状态改造
