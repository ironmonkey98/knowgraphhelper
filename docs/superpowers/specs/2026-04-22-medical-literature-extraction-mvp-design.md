# 雷总专属文献解析提取引擎 — MVP 设计文档

> **版本**: v1.0.0
> **日期**: 2026-04-22
> **阶段**: Brainstorming → Design（已完成，待进入 Writing-plans）
> **作者**: Boss + Claude（Opus 4.7）
> **状态**: 设计已通过 5 章验收，待写执行计划

---

## 0. 项目定位

**MVP 目标**：将医学文献（临床研究论文 + 卫健委指南）的 PDF 文件，端到端转化为可审核、可导出的结构化知识（14 字段 JSON + Excel）。

**本 MVP 的边界**：
- 是 PRD V3.0 全量平台的 **最小可用闭环**，不是完整版
- 定位为给雷总的 **演示级 Demo**，单机单用户、纯本地运行
- 作为 V1/V2 继续演进的**地基**，架构预留扩展点

**关键约束**（已在 brainstorming 中确认）：
- 仅处理电子版 PDF（**无扫描件**，不需要 OCR）
- 数据不外传，LLM 调用采用用户自带 Key（BYOK）模式
- 单机单用户，无协作层
- 极简风 UI，无动效

---

## 1. 最终决策快照

| 决策点 | 锁定值 |
|---|---|
| MVP 闭环 | 单文件上传 → 解析 → LLM 提取 → 审核 → Excel 导出 |
| 文献类型 | 论文 80% + 卫健委指南 20%（手动路由，双管线 Prompt） |
| 字段集 | **14 字段**（L1 标签 8 + L2 事实 6），一次 LLM 调用全量输出 |
| 字段溯源 | 每字段都带 `source_snippet`，悬停显示原文、点击跳转 Markdown 段落 |
| PDF 解析 | PyMuPDF4LLM（可插拔 `PDFParser` 接口） |
| LLM | **Qwen-Max 为调优基准**，OpenAI 兼容协议，BYOK + localStorage 配置 |
| LLM 网关 | 后端 `/api/llm/chat` 代理（无状态，解决 CORS） |
| 架构 | **路径 C**：极简 Python 后端 + React 前端 + localStorage（+ IndexedDB 放 PDF Blob） |
| UI 风格 | 极简，**无动效**，后续 plan 阶段用 `frontend-design` skill 出稿 |
| 部署 | 单机单用户，`./dev.sh` 一条命令 |

---

## 2. 架构总览

### 2.1 架构图

```
┌──────────────────────────────────────────────────────────────┐
│                  浏览器（React SPA，localhost:5173）           │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  页面层（3 页）                                           │ │
│  │   UploadPage   →  ReviewPage   →  RecordsPage            │ │
│  │   拖拽+选类型    2列审核+溯源    列表+Excel导出            │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │  状态层（Zustand）                                        │ │
│  │   documentsStore / llmConfigStore / uiStore              │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │  数据持久层                                                │ │
│  │   localStorage:                                           │ │
│  │     kgh:llm_config / kgh:documents[]                     │ │
│  │   IndexedDB:                                              │ │
│  │     kgh-files.pdf_blobs (PDF Blob)                        │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │  服务层                                                    │ │
│  │   parseService / llmService / exportService / storage   │ │
│  └──────────────────────┬──────────────────────────────────┘ │
└─────────────────────────┼─────────────────────────────────────┘
                          │ HTTP（本地 127.0.0.1:8000）
┌─────────────────────────▼─────────────────────────────────────┐
│              FastAPI 后端（极简，仅 2 个接口）                  │
│                                                                │
│   POST /api/parse-pdf                                          │
│   └─ multipart 上传 → PyMuPDF4LLM → 返回 { markdown, meta }    │
│                                                                │
│   POST /api/llm/chat（OpenAI 兼容代理）                        │
│   ├─ Header: X-LLM-Base-URL / X-LLM-Api-Key / X-LLM-Model      │
│   ├─ Body:   { messages, temperature, response_format }        │
│   └─ 无状态转发，凭证只在单次请求内存                            │
│                                                                │
│   ※ 没有数据库、没有用户系统、没有文件存储                       │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 职责边界

| 层 | 单一职责 | 绝不做 |
|---|------|-----|
| **前端** | UI + 业务流程编排 + 数据持久化 + Excel 生成 | 不存 PDF 原文件到 localStorage，不做 PDF 解析 |
| **后端** | PDF→Markdown + LLM 代理 | 不存任何数据，完全无状态 |
| **LLM** | 接收 Markdown + Prompt → 输出 14 字段 JSON（带 source_snippet） | 不做文献类型判断（路由由前端手动选择） |

### 2.3 SOLID 体现

- **S（单一职责）**：每层只做一件事
- **O（开闭原则）**：`PDFParser` 接口可替换，`LLMClient` 走 OpenAI 兼容协议可换任意模型
- **L（里氏替换）**：任何新 Parser 实现类都能无缝替代默认实现
- **I（接口隔离）**：前后端 API 只暴露两个端点，极简
- **D（依赖倒置）**：前端依赖"一个 chat 接口"，不依赖具体 LLM 厂商

---

## 3. 后端组件设计

### 3.1 项目结构

```
backend/
├── app/
│   ├── main.py                        # FastAPI 入口 + CORS
│   ├── api/
│   │   ├── parse.py                   # POST /api/parse-pdf
│   │   └── llm.py                     # POST /api/llm/chat
│   ├── parsers/
│   │   ├── base.py                    # PDFParser 抽象接口
│   │   └── pymupdf4llm_parser.py      # 默认实现
│   ├── schemas/
│   │   ├── parse.py                   # ParseResponse
│   │   └── llm.py                     # ChatRequest/Response
│   └── core/
│       ├── config.py                  # 端口/CORS/文件大小上限
│       └── errors.py                  # 统一错误响应
├── pyproject.toml
├── .env.example
└── README.md
```

### 3.2 接口规格

#### 🟢 POST /api/parse-pdf

| 项 | 规格 |
|---|----|
| Content-Type | `multipart/form-data` |
| 字段 | `file: UploadFile`（PDF）+ `doc_type: str`（`paper` / `guideline`） |
| 大小限制 | 50 MB（>50MB 返 413） |
| 响应 | `{ document_id, markdown, page_count, size_bytes, parse_time_ms }` |
| 主要错误 | 400 非 PDF / 413 过大 / 422 解析失败 / 500 内部错误 |

#### 🟢 POST /api/llm/chat（LLM 代理）

| 项 | 规格 |
|---|----|
| Content-Type | `application/json` |
| Headers | `X-LLM-Base-URL` / `X-LLM-Api-Key` / `X-LLM-Model`（三者必需） |
| Body | OpenAI 兼容：`{ messages, temperature, response_format?, max_tokens? }` |
| 超时 | 60 秒 |
| 流式 | MVP 不启用，未来扩展留 SSE 口 |
| 响应 | 原样透传上游 JSON |
| 主要错误 | 400/401/429/502/504 原样映射 |

**安全**：API Key 只在 Header，不写日志、不落盘、单请求内存；每请求 new `httpx.AsyncClient`。

### 3.3 PDFParser 可插拔接口

```python
# app/parsers/base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class ParsedDocument:
    markdown: str
    page_count: int
    size_bytes: int
    parse_time_ms: int

class PDFParser(ABC):
    @abstractmethod
    def parse(self, pdf_bytes: bytes) -> ParsedDocument: ...
    # 同步方法，FastAPI 路由中通过 run_in_executor 调用，避免阻塞事件循环
```

未来接入 MinerU / Marker / Mistral OCR 等只需新增实现类，上层零改动。

### 3.4 依赖清单

```toml
[project]
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
    "pymupdf4llm>=0.0.17",
    "httpx>=0.27",
    "python-multipart>=0.0.18",
]
```

### 3.5 启动

```bash
cd backend && uv sync && uv run uvicorn app.main:app --port 8000
```

CORS 允许 `http://localhost:5173`；绑定 127.0.0.1 不暴露到局域网。

---

## 4. 前端组件设计

### 4.1 项目结构

```
frontend/
├── src/
│   ├── pages/
│   │   ├── UploadPage.tsx
│   │   ├── ReviewPage.tsx
│   │   └── RecordsPage.tsx
│   ├── components/
│   │   ├── layout/AppShell.tsx
│   │   ├── upload/Dropzone.tsx
│   │   ├── review/
│   │   │   ├── MarkdownPanel.tsx
│   │   │   ├── FieldForm.tsx
│   │   │   ├── FieldRow.tsx
│   │   │   └── PdfPreviewModal.tsx
│   │   ├── settings/LlmConfigDialog.tsx
│   │   └── ui/*                       # shadcn/ui
│   ├── stores/
│   │   ├── llmConfigStore.ts
│   │   ├── documentsStore.ts
│   │   └── uiStore.ts
│   ├── services/
│   │   ├── parseService.ts
│   │   ├── llmService.ts
│   │   ├── exportService.ts
│   │   └── storageService.ts
│   ├── prompts/
│   │   ├── paperPrompt.ts
│   │   ├── guidelinePrompt.ts
│   │   └── version.ts
│   ├── schemas/
│   │   ├── fields.ts
│   │   └── llmResponse.ts
│   ├── types/index.ts
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

### 4.2 页面拆解

#### 🅰️ UploadPage

- 拖拽区 + 文件选择（≤50MB）
- 文献类型 radio（论文 / 卫健委指南）
- 未配置 LLM 时强制弹 `LlmConfigDialog`
- 点击"开始解析与提取"：
  1. 生成 document_id（uuid）
  2. Document status=`parsing` 写入 localStorage
  3. PDF Blob 存 IndexedDB
  4. 调 `/api/parse-pdf`
  5. 拿到 Markdown → status=`extracting`
  6. 根据 doc_type 选 Prompt → 调 `/api/llm/chat`
  7. Zod 校验 → status=`pending_review`
  8. 跳 ReviewPage

#### 🅱️ ReviewPage（核心）

2 列布局：
- 左：`MarkdownPanel` 渲染（react-markdown + remark-gfm）
- 右：`FieldForm` 14 字段分组表单（元数据 / 研究设计 / PICO / 统计结果 / 结论 / 标签），可折叠
- 顶部：文档信息条 + "查看原文 PDF" 按钮（打开 Modal）
- 底部：取消 / 保存并完成

保存策略：一次点击全量保存，status=`reviewed`，reviewed_at 记时间戳。

#### 🅲 RecordsPage

- 表格：文件名 / 类型 / 状态 / 置信度 / 时间 / 操作
- 筛选：全部 / 待审核 / 已入库
- 多选 + 批量导出 Excel
- 删除：同时清理 localStorage 和 IndexedDB

#### 🎛️ LlmConfigDialog

- Base URL（默认：`https://dashscope.aliyuncs.com/compatible-mode/v1`）
- API Key
- Model（默认：`qwen-max`）
- Temperature（默认：`0.0`）
- "测试连接"按钮（发一次 ping messages）
- 保存到 `localStorage.kgh:llm_config`

### 4.3 字段溯源交互

| 交互 | 效果 |
|---|---|
| 悬停字段 | 悬浮卡片显示 source_snippet（≤120 字） |
| 点击 🔍 | Markdown 区滚动到对应段落 + 黄色高亮 2 秒 |
| 定位失败 | ⚠️ 角标提示"无法精确定位" |

**实现**：LLM 输出的 `source_snippets[fieldName]` → 前端 `String.indexOf` 在 Markdown 里找 → 计算段落 → ref 滚动 → className 高亮。

### 4.4 状态管理（Zustand）

```typescript
// llmConfigStore.ts - 持久化
{ config: LlmConfig | null; setConfig; isConfigured }

// documentsStore.ts - 持久化
{ documents: Document[]; addDocument; updateDocument; removeDocument }

// uiStore.ts - 临时
{ currentDocumentId; highlightSpan; pdfPreviewOpen }
```

使用 Zustand 的 `persist` 中间件。

### 4.5 数据持久化

#### localStorage（2 个 key）

```typescript
kgh:llm_config   // LlmConfig 对象
kgh:documents    // Document[] 数组
```

每篇 Document 约 100-300 KB（含 Markdown + 14 字段 + source_snippets），5-10 MB 容量可存 30-80 篇。

#### IndexedDB（PDF Blob）

```
DB: kgh-files
  ObjectStore: pdf_blobs
    key: document_id (string)
    value: Blob (PDF 原文件)
```

只在点"查看原文"时从 IDB 取；主流程不依赖 PDF 原文件。

#### Document Schema

```typescript
interface Document {
  id: string;
  filename: string;
  doc_type: 'paper' | 'guideline';
  status: 'parsing' | 'extracting' | 'pending_review' | 'reviewed' | 'error';
  uploaded_at: number;
  markdown: string;
  fields: ExtractedFields;              // 14 字段
  source_snippets: Record<string, string>;
  extraction_confidence: number;        // 0-1
  page_count?: number;                  // 来自 parse-pdf 响应
  parse_time_ms?: number;               // 来自 parse-pdf 响应
  error_message?: string;
  reviewed_at?: number;
  prompt_version?: string;
}
```

### 4.6 依赖清单

```json
{
  "dependencies": {
    "react": "^18", "react-dom": "^18", "react-router-dom": "^7",
    "zustand": "^5",
    "react-markdown": "^9", "remark-gfm": "^4",
    "react-hook-form": "^7", "@hookform/resolvers": "^3", "zod": "^3",
    "xlsx": "^0.18",
    "idb": "^8",
    "clsx": "^2", "tailwind-merge": "^2"
  },
  "devDependencies": {
    "vite": "^6", "typescript": "^5", "tailwindcss": "^3", "@vitejs/plugin-react": "^4"
  }
}
```

shadcn/ui 按需复制组件到 `components/ui/`。MVP 预计需要：Button, Input, Textarea, Select, RadioGroup, Dialog, Table, Checkbox, Card, Collapsible, Toast, Tooltip, Badge。

---

## 5. 数据流 + LLM Prompt 设计

### 5.1 端到端时序

```
用户 → 前端 → localStorage/IndexedDB → 后端 → Qwen
  拖入 + 选类型
  检查 LLM 配置
  创建 Document(status=parsing)
  PDF → IndexedDB
  POST /api/parse-pdf → PyMuPDF4LLM → Markdown
  status=extracting
  根据 doc_type 选 Prompt
  POST /api/llm/chat → httpx 透传 Qwen
  Zod 校验（失败重试 1 次）
  status=pending_review → 跳 ReviewPage
  审核修改字段
  保存并完成 → status=reviewed → 跳 Records
  勾选导出 Excel（xlsx.writeFile）
```

### 5.2 LLM Prompt（基于 Boss 原提示词 + L2 扩展融合）

#### 共同 System Prompt

```
你是一个专业的医学文献结构化提取助手，负责从医学文献 Markdown 中提取 14 个核心字段及其原文证据。

# 核心职责
1. 精准提取每个字段值（找不到则为 null，不要编造）
2. 每个字段必须配一段原文 snippet（≤150 字）作为证据
3. 对整体提取质量自评 extraction_confidence（0.0-1.0）

# 输出格式（严格 JSON，不含 markdown 代码块标记）
{
  "fields": {
    "title": string | null,
    "authors": string | null,
    "journal": string | null,
    "doi": string | null,
    "doc_category": "指南" | "共识" | "系统综述" | "论文集" | "国家标准" | "教材" | "职业健康" | "其他",
    "received_date": string | null,       // "收稿年月YYYY年M月"，推测时加 "[推测]"
    "keywords": string[],                  // ≤10 个
    "departments": string[],               // 1-3 个
    "authority_level": "权威" | "高" | "一般" | "待评估",
    "authority_basis": string | null,
    "classification": string[],
    "sample_size": { "total": number|null, "experimental": number|null, "control": number|null } | null,
    "effect_size": { "type": "OR"|"HR"|"RR"|"MD"|"SMD"|"other"|null, "point": number|null, "ci_lower": number|null, "ci_upper": number|null } | null,
    "p_value": string | null               // 保留原文 "<0.001" / "0.023"
  },
  "source_snippets": {
    "<field_name>": "<原文片段，≤150 字>"
  },
  "extraction_confidence": 0.0-1.0
}

# 置信度判定规则
- 权威：中华医学会系列、NEJM/Lancet/BMJ/JAMA、Cochrane、国家卫健委/药监局、WHO/ESC/AHA/ACC/ADA
- 高：SCI 核心库、北大核心/科技核心、国际专业学会指南、中国医学科学院院刊
- 一般：省级期刊、会议论文集、机构白皮书
- 待评估：预印本、网络资料、非同行评审

# 关键词生成规则
主关键词(3-5个)→次关键词(2-3个)→扩展词(1-2个)→原文【关键词】段
全局去重后合并，总数 ≤ 10，优先保留原文关键词。

# 就诊科室白名单（前端表单用此列表做下拉选择，LLM 输出必须从中选取 1-3 个）
心血管内科；内分泌科；全科医学；呼吸内科；消化内科；肾内科；神经内科；肿瘤科；感染科；急诊科；影像科；检验科；妇产科；儿科；心血管外科

# 规则（强制）
- 严格 JSON，无解释文字、无 markdown 代码块标记
- 找不到的字段用 null（numbers/objects）或 []（arrays）
- source_snippet 必须是原文真实出现的字符串
- 术语优先使用 ICD-10 / MeSH 主题词标准
```

#### 管线差异（User Prompt）

```
# 论文管线
这是一篇医学临床研究论文，请按规则提取 14 字段。

[Markdown]
{{markdown}}

# 指南管线
这是一份中国卫健委发布的医学临床指南。

⚠️ 指南场景特殊规则：
- sample_size、effect_size、p_value 通常为 null
- doc_category 必为 "指南"
- authority_level 默认 "权威"
- classification 侧重"诊断标准与分型"、"治疗策略与方案"、"临床指南"

[Markdown]
{{markdown}}
```

两管线复用同一 Schema，前端表单单一实现。

### 5.3 Zod 校验

```typescript
// schemas/llmResponse.ts
import { z } from 'zod';

const EffectSize = z.object({
  type: z.enum(['OR','HR','RR','MD','SMD','other']).nullable(),
  point: z.number().nullable(),
  ci_lower: z.number().nullable(),
  ci_upper: z.number().nullable(),
}).nullable();

const SampleSize = z.object({
  total: z.number().int().nullable(),
  experimental: z.number().int().nullable(),
  control: z.number().int().nullable(),
}).nullable();

export const ExtractedFields = z.object({
  title: z.string().nullable(),
  authors: z.string().nullable(),
  journal: z.string().nullable(),
  doi: z.string().nullable(),
  doc_category: z.enum(['指南','共识','系统综述','论文集','国家标准','教材','职业健康','其他']),
  received_date: z.string().nullable(),
  keywords: z.array(z.string()).max(10),
  departments: z.array(z.string()).min(1).max(3),
  authority_level: z.enum(['权威','高','一般','待评估']),
  authority_basis: z.string().nullable(),
  classification: z.array(z.string()),
  sample_size: SampleSize,
  effect_size: EffectSize,
  p_value: z.string().nullable(),
});

export const LlmResponse = z.object({
  fields: ExtractedFields,
  source_snippets: z.record(z.string()),
  extraction_confidence: z.number().min(0).max(1),
});
```

**校验失败**：自动重试 1 次，反馈 Prompt 格式：
```
你上次输出不符合 schema，错误：
{Zod flatten().fieldErrors 的 JSON 字符串，如 {"keywords":["预期数组，收到字符串"]}}
请严格按照 JSON Schema 重新输出（不含解释文字）。
原输入不变。
```

---

## 6. 错误处理矩阵

| 环节 | 错误类型 | 处理 | 用户可见 |
|---|---|---|---|
| PDF 上传 | 非 PDF / >50MB | 前端拦截 | Toast |
| 解析 | 加密/空 PDF | 后端 422 | 状态 error + 重试 |
| 解析 | 超时 | 60s | 状态 error |
| LLM | 401 认证失败 | 不重试 | 弹 LlmConfigDialog |
| LLM | 429 限流 | 等 1s 重试 1 次 | 静默 |
| LLM | 502/504 | 指数退避重试 2 次 | 静默 |
| LLM 响应 | Zod 失败 | 带错误反馈重试 1 次 | 静默 |
| LLM 响应 | JSON 解析失败 | 提取 {} 片段再校验 | 状态 error |
| React 崩溃 | — | ErrorBoundary | "应用异常 [刷新]" |
| localStorage 满 | QuotaExceededError | 捕获 | Toast"导出并清理" |
| IndexedDB 失败 | — | 降级：预览失效 | 主流程继续 |
| 浏览器刷新中断 | 状态 parsing/extracting | 恢复时标 error | 可重试 |
| source_snippet 幻觉 | indexOf 失败 | ⚠️ 角标 | "无法精确定位" |
| LLM 全 null 响应 | extraction_confidence < 0.3 | 仍进审核页，顶部加红色警告横幅"AI 提取置信度极低，建议人工逐字段核对" | 警告横幅 |

---

## 7. 测试策略

### 7.1 必须自动化

| 位置 | 工具 | 覆盖 |
|---|---|---|
| 后端 PyMuPDF4LLMParser | pytest | 3 fixture PDF（双栏/表格/指南）断言 Markdown 非空 + 关键词 |
| 后端 /api/llm/chat | pytest + respx | mock httpx，headers 透传 + 错误码映射 |
| 前端 Zod schema | vitest | 合法/非法 JSON 分别通过/拒绝 |
| 前端 storageService | vitest + fake-indexeddb | localStorage + IndexedDB 读写一致性 |

### 7.2 推荐有

- llmService 重试逻辑
- source_snippet 定位算法

### 7.3 MVP 不做

- E2E（Playwright）
- 视觉回归
- 性能基准

### 7.4 手动 UAT 清单

1. 上传真实 RCT 论文 → 14 字段命中率 ≥ 80%
2. 上传卫健委指南 → L1 标签为主，L2 多为 null
3. 表单修改 + 保存 → 状态正确流转
4. 刷新浏览器 → 数据仍在
5. 导出 Excel → 字段列齐

---

## 8. 交付形态

### 8.1 开发期

```bash
./dev.sh   # Mac/Linux
./dev.bat  # Windows
# 等价：backend (uv run uvicorn) + frontend (pnpm dev)
```

### 8.2 Demo 交付档位

| 档 | 形态 | MVP | V1 | V2 |
|---|---|---|---|---|
| 🅰️ 本地开发环境 | clone + dev.sh | ✅ | — | — |
| 🅱️ 后端 exe + 前端静态 | pyinstaller + pnpm build | — | ✅ | — |
| 🅲 Tauri 桌面 | Rust 壳 + Python sidecar | — | — | ✅ |

### 8.3 项目根目录

```
knowgraphhelper/
├── backend/
├── frontend/
├── docs/superpowers/specs/      # 本文档位置
├── fixtures/                     # 测试 PDF
├── dev.sh / dev.bat
├── plan.md                       # 进度断点索引
├── README.md
└── .gitignore
```

---

## 9. 已知风险与限制

| 风险 | 影响 | 缓解 |
|---|---|---|
| PDF 复杂表格/跨页偏差 5-10% | 效应量数字可能错 | 审核人工修正 |
| LLM 幻觉（source_snippet 伪造） | 溯源失效 | indexOf 验证 + ⚠️ 角标 |
| localStorage 容量 ~30-80 篇 | 长期需清理 | Records 逐条删除；V1 批量清理 |
| 单机单用户 | 不支持协作 | 符合 MVP 定位，V2 做协作层 |
| 清浏览器缓存即丢数据 | 无灾备 | 提示及时导出；V1 做 JSON 备份 |
| Qwen API Key 错 | 无法提取 | "测试连接"按钮 |
| 网络不稳定 | 提取中断 | 60s 超时 + 重试 2 次 |

---

## 10. MVP 验收清单（10 条）

- [ ] 支持拖拽上传 PDF（≤50MB），能选"论文/指南"
- [ ] PyMuPDF4LLM 解析返回 Markdown，双栏阅读顺序正确
- [ ] 一次 LLM 调用输出 14 字段 + source_snippets + extraction_confidence
- [ ] Zod 校验失败能自动重试 1 次
- [ ] 审核页：左 Markdown + 右表单，字段分组折叠
- [ ] 字段 🔍 点击跳转 Markdown 对应段落并高亮
- [ ] 保存后状态为"已入库"，Records 列表可见
- [ ] 勾选多条 → 导出 Excel（14 字段列齐）
- [ ] LlmConfigDialog 首次强制弹窗，配置存 localStorage
- [ ] 关键路径自动化测试全绿

---

## 11. V1 功能预告（架构扩展口已留）

| V1 功能 | 扩展点 |
|---|---|
| 多模型 A/B 对比 | `/api/llm/chat` 并发调多 upstream |
| 批量上传 | Dropzone 支持多文件 + 队列 |
| 扫描 PDF | 新增 `MinerUParser(PDFParser)` |
| 提示词工作台 UI | `prompts/` 目录 + `promptVersion` 字段已就位 |
| RESTful API 对接文曲星 | 后端加 `/api/records` CRUD，localStorage 数据迁 SQLite |
| 审计日志 | Document 模型加 `audit_log: []` |
| 协作 / 质控 | 用户系统 + 任务流转状态机 |

---

## 12. Brainstorming 过程回顾（决策链路）

| 轮次 | 议题 | Boss 决策 |
|---|---|---|
| 1 | 项目范围 | MVP 闭环 + 前端界面 |
| 2 | 文献类型 | 论文主（80%）+ 卫健委指南兼容（20%） |
| 3 | 路由策略 | 方案①（手动选择 + 双管线） |
| 4 | 字段集 | 方案②（L1 标签 8 + L2 事实 6 = 14 字段） |
| 5 | 效应量结构 | 方案α（结构化） |
| 6 | PDF 解析 | PyMuPDF4LLM（因电子版无扫描件） |
| 7 | 架构 | 路径 C（极简后端 + 纯前端 localStorage） |
| 8 | MVP 范围砍功能 | 无动效 / 2 列布局 / PDF 预览 Modal / 单机单用户 |
| 9 | LLM 基准模型 | Qwen-Max |
| 10 | 字段溯源 | 方案 A（每字段带 source_snippet） |
| 11 | CORS 方案 | 后端加 LLM 代理 |
| 12 | 字段实现节奏 | 一次调用做完 14 字段 |

---

## 13. 下一步

按 brainstorming → writing-plans 流程：

1. ✅ **设计已定稿**（本文档）
2. ⏳ **Spec Review**（self-review / Boss 人工审 / 可选 subagent 审）
3. ⏳ **Writing-plans skill** 产出 `docs/superpowers/plans/2026-04-22-medical-literature-extraction-mvp-plan.md`，拆分为可执行任务列表
4. ⏳ **TDD 执行**：按 plan 逐步实现（先后端 2 接口 → 前端 3 页面 → 集成联调 → UAT）
