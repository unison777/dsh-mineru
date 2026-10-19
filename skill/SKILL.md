---
name: mineru
description: 用 MinerU 云解析读文档：mcp__mineru__* 工具把 PDF、扫描件、图片、Office 文件转成 Markdown（含表格/公式/OCR），支持 URL 与本地文件批量、超 200 页切片合并，并把结果落盘供后续引用。
---

# MinerU 文档解析（云 API）

MinerU 是这个环境里首选的中文/复杂版式文档解析工具。它通过
`@deepseek-ai/dsh-mcp-client` 启动的 `mineru-mcp` 暴露工具，名字形如
`mcp__mineru__parse`。

## 何时用

- 用户给出 PDF / 扫描件 / 图片 / DOC·DOCX / PPT·PPTX 的链接或本地路径，要求读内容、总结、翻译、抽表格、识别公式、OCR。
- 需要在回答里给出页码级引用。
- 需要把一批文档批量转成 Markdown 存到工作区。

不要用它读纯文本（`.md` / `.txt` / `.csv` / 源码），直接用 `read`。用户明确拒绝上传、或文档属于敏感资料时，先问再传（见「隐私」）。

## 前置检查（每次先做一次）

1. 确认工具存在：工具列表里有 `mcp__mineru__parse`。没有就说明 MCP 未连接——告诉用户在「设置 → MinerU 文档解析」查看插件状态，或重启 DeepSeek Harness；**不要**编造解析结果。
2. 报 `401` / `Unauthorized` / `invalid api key`：密钥失效，让用户更新 `MINERU_API_KEY`（位置见设置页）。
3. 报 `429` / 配额相关：当天 1000 页高优先级额度用尽，高优先级会降级而不是拒绝；告知用户并考虑只解析需要的页。

## 隐私

云解析会把文件上传到 mineru.net。涉及身份证件、合同、医疗、财务、未公开手稿等敏感内容时，先说明会上传并等用户同意；用户不同意就不要调用。

## 工具表

| 工具 | 用途 |
|---|---|
| `mcp__mineru__batch` | 一批 URL（≤200）提交解析，**取内容的首选入口** |
| `mcp__mineru__batch_status` | 分页查看批次进度/结果 |
| `mcp__mineru__download_results` | 下载批次结果，落成 `{name}.md`、`{name}_content.json`、`images/` |
| `mcp__mineru__upload_batch` | 上传本地文件（`files` 或 `directory`）批量解析 |
| `mcp__mineru__parse` | 单个 URL，可带 `pages` 页范围；只返回 `task_id` |
| `mcp__mineru__status` | 查单个任务；完成后给 zip 下载地址（不自动解包） |
| `mcp__mineru__parse_long` | 超过 200 页的文档按 ≤200 页切片提交，需要 `total_pages` |
| `mcp__mineru__merge_slices` | 把切片批次拼回一份完整 Markdown（`page_idx` 已重排） |

## 三个标准流程

### A. URL → 取正文（默认）

```
mcp__mineru__batch { urls: ["https://.../paper.pdf"], model: "vlm" }
mcp__mineru__batch_status { batch_id: "...", limit: 10 }
mcp__mineru__download_results { batch_id: "...", output_dir: "<工作区绝对路径>/papers" }
read <output_dir>/<name>.md
```

- 只有 1 个 URL 也走 batch：`download_results` 才会自动解包并命名。
- 轮询间隔 20–30 秒即可，别连续刷；大文件通常 1–5 分钟。
- `output_dir` 用绝对路径，放在当前工作区内，例如 `D:\dsh\papers`（换成自己的工作区路径）。

### B. 本地文件

```
mcp__mineru__upload_batch { files: ["C:\\...\\a.pdf", "C:\\...\\b.docx"], model: "vlm", table: true }
mcp__mineru__batch_status { batch_id: "...", limit: 10 }
mcp__mineru__download_results { batch_id: "...", output_dir: "D:\\dsh\\papers" }
```

- 上传可能慢（大文件几分钟），超时会报 `TIMEOUT`；同一文件若有公开 URL，优先用流程 A。
- 单文件 ≤200MB；支持 `.pdf .doc .docx .ppt .pptx .png .jpg .jpeg`。

### C. 超过 200 页的长文档

```
mcp__mineru__parse_long { url: "https://.../book.pdf", total_pages: 520, name: "book", model: "vlm" }
mcp__mineru__batch_status { batch_id: "..." }
mcp__mineru__merge_slices { batch_id: "...", output_dir: "D:\\dsh\\books" }
```

- `total_pages` 必填（Windows 上没有自动探测）：用 `pdfinfo`、阅读器页码或用户提供。
- 切片数超过 200 时加大 `slice_size`；单文件仍需 ≤200MB。

## 参数要点

- `model`: `pipeline` 快而省，`vlm` 对复杂版面/公式更准（默认 `pipeline`）。论文、双栏、公式多 → `vlm`。
- `pages`: 仅 `mineru_parse` 支持，如 `"1-10,15"`；单文件 ≤200 页。
- `ocr`: 扫描件打开（仅 pipeline）；`formula` / `table`: 公式、表格识别，默认建议开。
- `language`: `ch`、`en` 等 109 种；混合语言用 `ch`。
- `formats`: 额外导出 `docx` / `html` / `latex`。

## 结果处理

- `download_results` 每个文档落一个文件夹：`{name}.md`、`{name}_content.json`、`images/`。
- 先读 md；需要定位/引用时读 `_content.json` 里的 `page_idx`、`bbox`，按页引用（如「第 7 页」）。
- 长文档不要整篇塞进上下文：按小节读 md，必要时用 `read` 的 offset/limit。
- 解析失败（`state: failed`）时读取错误信息，不要静默重试同样参数；换 `model` 或 `pages` 前先和用户确认。

## 限制

- 单文件 ≤200MB、≤200 页；批次 ≤200 个文件。
- 高优先级额度 1000 页/天，超出部分降级处理而非拒绝。
- 云端解析 = 上传文件，遵守上面的隐私规则。
- 任务完成后 zip 有保留期限；解析完尽快 `download_results` 落盘，别只记 `task_id`。

## 失败兜底

- 工具全部不可用：报告插件/MCP 未连接，让用户看设置页或重启，不要改用其他解析器假装是 MinerU 结果。
- CLI 孪生：同一台机器上有 `mineru-mcp` 的 `mineru-cloud` CLI（`node <mineru-mcp>/dist/cli.js`），可用 `list` 查看命令；仅在 MCP 工具不可用且用户同意时作为兜底，参数与工具一一对应。
