# server.py _load_novel 改为优先读取章节 JSON 文件 — 保证返回最新数据

**日期**: 2026-07-27

## 修改摘要

修复 `server.py` 的 `_load_novel()` 方法：原来只从章节文件读取 `content`，`title` 和 `summary` 来自 `novel.js` 的 `CHAPTER_MANIFEST`（可能过期），导致 API 返回的数据不是最新的。

同时为所有 HTTP 响应添加 `Cache-Control: no-cache, no-store, must-revalidate` 头，防止浏览器缓存静态文件（novel.js / 章节 JSON）导致前端显示过时内容。

## 涉及文件

| 文件 | 修改 |
|------|------|
| `server.py` | `_load_novel()` 重写 + `end_headers()` 添加防缓存头 |

## 详细修改

### 1. `_load_novel()` — 从章节文件读取全部字段

**修改前**:
- `title` → 来自 `novel.js` manifest（可能过期）
- `summary` → 来自 `novel.js` manifest（可能过期）
- `content` → 来自 `data/chapters/<id>.json`（正确）

**修改后**:
- `id` → 优先从章节文件读取，回退到 manifest
- `title` → 优先从章节文件读取，回退到 manifest
- `summary` → 优先从章节文件读取，回退到 manifest
- `content` → 从章节文件读取
- 按 manifest 顺序排列（保证 ch_1, ch_2, ..., ch_13 顺序正确）
- 兜底路径按文件名数字后缀自然排序

### 2. `end_headers()` — 添加防缓存头

在所有 HTTP 响应中添加：
```
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```

防止浏览器缓存 `novel.js`、章节 JSON 文件等静态资源。

## 关键决策

- **保留 manifest 作为排序依据**：manifest 的章节顺序是明确的；直接用 `glob` 扫描目录需要按数字后缀自然排序（`ch_1`, `ch_2`, ..., `ch_13`），不如 manifest 可靠。
- **不依赖 regex 稳定性**：虽然 regex 解析 manifest 仍有脆弱性，但现在即使 manifest 匹配失败，也会走兜底路径直接从目录读取。
- **no-store 而非 no-cache**：使用 `no-store` 彻底禁止缓存，确保调试期每次刷新都读到最新文件。后续性能优化时可放宽为 `no-cache` + `ETag`。

## 注意事项

- 如果 `data/chapters/` 目录下存在 orphan 文件（不在 manifest 中的章节），它们不会被加载，除非 manifest 匹配失败走兜底路径
- 前端 `index.html` 和 `reader.html` 中 `novel.js?v=20260726-2` 的版本字符串仍为硬编码，建议未来改为根据文件修改时间自动生成
