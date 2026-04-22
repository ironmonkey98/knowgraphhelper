# plan.md — 雷总专属文献解析提取引擎 进度断点

## 2026-04-22 Brainstorming 设计阶段

### 断点记录
- **阶段**: Brainstorming → Design（已完成 5 章节 PASS）
- **产出**: `docs/superpowers/specs/2026-04-22-medical-literature-extraction-mvp-design.md`
- **核心决策**:
  - MVP 闭环：单文件上传 → 解析 → LLM 提取 → 审核 → Excel 导出
  - 文献类型：论文 80% + 卫健委指南 20%（手动路由双管线）
  - 14 字段（L1 标签 8 + L2 事实 6），一次 LLM 调用全量输出
  - 字段溯源：每字段带 source_snippet
  - PDF 解析：PyMuPDF4LLM（可插拔接口）
  - LLM：Qwen-Max 基准，OpenAI 兼容，BYOK
  - 架构：极简 Python 后端（2 接口）+ React 前端 + localStorage + IndexedDB
  - UI：极简风，无动效，后续 frontend-design skill 出稿
- **下一步**: Spec Review → Writing-plans → TDD 执行

### Spec Review（已完成）
- **结果**: PASS（5 minor issues 全部修复）
- **修复项**:
  1. localStorage key 计数 3→2
  2. Zod 重试 error_details 格式已定义
  3. 就诊科室白名单用途明确为下拉校验
  4. LLM 全 null 响应加低置信度警告横幅
  5. 验收清单计数 8→10
- **补充项**:
  - Document schema 加 page_count / parse_time_ms
  - PDFParser 签名注明 run_in_executor 调用
  - shadcn 组件清单预列 13 个
- **下一步**: Boss 审阅 spec → Writing-plans

### 决策链路回顾
1. 范围 → MVP 闭环 + 前端
2. 类型 → 论文主 + 指南兼容
3. 路由 → 手动选择双管线
4. 字段 → L1+L2 共 14 字段
5. 效应量 → 结构化（方案α）
6. PDF 引擎 → PyMuPDF4LLM（无扫描件）
7. 架构 → 路径 C（极简后端 + localStorage）
8. MVP 范围 → 无动效 / 2列 / PDF预览 / 单用户
9. LLM → Qwen-Max
10. 溯源 → 全字段 source_snippet
11. CORS → 后端 LLM 代理
12. 节奏 → 一次调用 14 字段

## 2026-04-22 Writing-plans 阶段

### 断点记录
- **阶段**: Writing-plans（已完成）
- **产出**: `docs/superpowers/plans/2026-04-22-medical-literature-extraction-mvp-plan.md`
- **任务拆分**: 4 Phase / 13 Task / ~2.5h（CC 预估）
  - Phase 1: 后端基础（FastAPI + PDF 解析 + LLM 代理）
  - Phase 2: 前端基础（React + Schema + Store + Service）
  - Phase 3: 前端页面（Upload / Review / Records）
  - Phase 4: 集成联调 + UAT
- **下一步**: 开始执行 Phase 1（后端基础搭建）

## 2026-04-22 编码执行阶段

### Phase 1 完成（后端）
- **Task 1.1**: 后端骨架（pyproject.toml + FastAPI + CORS + config + errors）✅
- **Task 1.2**: PDF 解析接口（PDFParser 接口 + PyMuPDF4LLM 实现 + POST /api/parse-pdf）✅
  - 4 测试全绿（simple_paper / guideline / empty_pdf / reject_non_pdf）
- **Task 1.3**: LLM 代理接口（POST /api/llm/chat + 无状态转发）✅
  - 7 测试全绿（success / missing_headers / 401 / 429 / 500→502 / timeout / optional_fields）
- **Task 1.4**: dev.sh 启动脚本 ✅

### Phase 2 完成（前端基础）
- **Task 2.1**: 前端骨架（Vite + React + TS + Tailwind + shadcn/ui 13 组件）✅
- **Task 2.2**: 类型 + Schema + Store（Document 接口 + Zod v3 schema + 3 Zustand store）✅
  - 6 测试全绿（valid / minimal / invalid_category / out_of_range / missing / max_keywords）
- **Task 2.3**: 服务层（storageService + parseService + llmService + exportService）✅
- **Task 2.4**: Prompts（论文 + 指南双管线 system/user prompt）✅

### Phase 3 完成（前端页面）
- **Task 3.1**: AppShell + 路由 ✅
- **Task 3.2**: UploadPage（拖拽上传 + 类型选择 + LlmConfigDialog）✅
- **Task 3.3**: ReviewPage（2 列布局 + Markdown 面板 + 字段分组表单 + 溯源 tooltip）✅
- **Task 3.4**: RecordsPage（表格 + 筛选 + 批量导出 + 删除）✅

### 后端测试: 11/11 ✅ | 前端测试: 6/6 ✅ | 构建: ✅

### 2026-04-22 设计调整
- **路由分类**: 论文/指南 → 单栏/双栏（按 PDF 布局分）
- **提取字段精简**: 去掉 authors/journal/doi/sample_size/effect_size/p_value，保留 8 字段
  - title / doc_category / received_date / keywords / departments / authority_level / authority_basis / classification
- **Prompt 全面更新**: 按用户提供的完整提示词重写，含关键词四类组合规则、分类体系、置信度判定
- **新增功能**: 提示词设置弹窗（可编辑/保存/恢复默认，localStorage 持久化）
- **LLM 超时**: 60s → 180s
