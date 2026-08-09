# 星落之城 · 小说写作与阅读工具 (web_book)

一个**小说创作 + 在线阅读**一体化工具，配套《星落之城》连载使用：

- ✍️ **写作端**（`index.html`）：章节管理、大纲、Markdown 预览、一键保存/导出
- 📖 **阅读端**（`reader.html`）：清爽阅读页，目录导航、上一章/下一章、Markdown 渲染
- 🚀 **双端发布**：本地 Python 服务器局域网分享 + Vercel 云端一键部署（`/read` 短链分享）

## 功能特性

### 写作端（编辑器）

- 📑 章节列表：新增 / 重命名 / 删除章节（删除有二次确认）
- ✏️ Markdown 编辑 + 实时预览
- 💾 多级保存：自动存 `localStorage` → 一键保存到文件（`data/novel.json` + `data/chapters/<id>.json`）→ 服务器 API 保存
- 📥 导出：当前数据导出为 JSON 文件；服务器不可用时自动降级为下载
- 🔄 刷新：从文件重新拉取最新内容
- 📋 大纲文件 `data/outline.md`：人物设定、剧情规划随项目管理

### 阅读端

- 📖 章节目录（浮动按钮）、上一章 / 下一章导航
- 📝 Markdown 全渲染：标题、加粗、引用、代码块、表格
- 🌙 移动端适配，适合手机阅读分享

### 服务与部署

- 🐍 **本地服务器**（`server.py`）：纯标准库 `http.server`，零依赖
  - 静态文件 + API（`/api/novel` 读写、`/api/chapter` 单章保存、`/api/info`）
  - 自动生成 `data/novel.js`（书籍元信息 + 章节清单数据加载器）
  - 启动自动提示本机/局域网访问地址，手机同 Wi-Fi 直接看
- ▲ **Vercel 云端部署**：`publish.bat` 一键发布，自动登录检测、部署、复制阅读链接到剪贴板
  - `/read` 短链重定向到 `reader.html`，方便分享

## 快速开始

```bash
# 本地写作 + 局域网分享
python server.py
# → 本机:   http://127.0.0.1:8000
# → 局域网: http://<本机IP>:8000（手机浏览器打开）

# 云端发布（Vercel）
# 前置：npm install -g vercel && vercel login（一次即可）
publish.bat
# → 自动部署并复制 https://<项目名>.vercel.app/reader.html 到剪贴板
```

## 使用流程

1. **写作**：打开 `index.html` → 选章节 → 编辑 → 点「💾 保存」写入 `data/novel.json`
2. **本地预览**：`python server.py`，手机/朋友访问 `http://<IP>:8000/reader.html`
3. **云端分享**：改完内容保存 → 双击 `publish.bat` → 把复制好的链接发出去

## 数据与存储

```
web_book/
├── server.py              # 本地服务器（静态 + API + novel.js 生成）
├── config.py              # 后端配置（端口 / 防火墙规则名）
├── publish.bat            # Vercel 一键发布脚本（含版本号 + 契约校验）
├── vercel.json            # Vercel 路由/缓存配置（/read → reader.html）
├── _redirects             # 根路径重定向到阅读页
├── TOOL_CONTRACT.md       # API 契约（前后端唯一权威）
├── index.html             # 写作端（编辑器）
├── reader.html            # 阅读端
├── js/
│   ├── config.js          # 前端共享配置（存储 key / API 端点）
│   ├── markdown.js        # 共享 Markdown 渲染器（写作/阅读双端复用）
│   ├── app.js             # 编辑器逻辑（localStorage + 保存/导出）
│   └── reader.js          # 阅读器逻辑（目录/章节加载）
├── css/style.css          # 样式
├── data/
│   ├── novel.json         # 书籍元信息 + 章节清单（编辑保存的目标）
│   ├── novel.js           # 数据加载器（server.py 自动生成，勿手改）
│   ├── outline.md         # 小说大纲（人物/剧情规划）
│   └── chapters/
│       └── ch_*.json      # 各章节正文（Markdown 内容）
├── scripts/               # 契约校验 / 版本号脚本
├── tools/                 # 辅助脚本
└── .obsidian/             # Obsidian 仓库配置（可用 Obsidian 直接编辑大纲）
```

> 章节正文是**分文件存储**（`chapters/ch_1.json` …），`novel.json` 只存元信息 + 章节清单，编辑保存时同步更新两者。

## API 一览（本地服务器）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/novel` | 获取完整小说数据（从章节文件重建） |
| POST | `/api/novel` | 全量保存小说数据 |
| POST | `/api/chapter` | 保存单个章节到 `data/chapters/<id>.json` |
| GET | `/api/info` | 本机 IP / 端口 / 阅读与编辑地址 |
| GET | `/read` | 302 重定向到 `reader.html` |

## 技术要点

- **零依赖本地服务**：`ThreadingHTTPServer` + `SimpleHTTPRequestHandler`，HTTP/1.1 keep-alive + socket 超时保证 Ctrl+C 可立即退出
- **章节分文件 + 清单重建**：`_load_novel()` 优先读 `chapters/ch_*.json` 完整内容，缺失时回退清单里的 summary，保证数据不丢
- **保存降级链**：服务器 API 不可用时，编辑器自动降级为「下载 JSON 文件」，配合 `localStorage` 自动备份
- **防缓存**：本地服务器所有响应 `Cache-Control: no-store`，每次刷新都是最新内容
- **Vercel 静态化**：纯前端可部署，`data/novel.js` 内联数据加载器让静态托管也能读章节

### 工程化（对齐 Reasonix 设计模式）

- **共享渲染器**（§5/§6）：Markdown 渲染收敛到 [`js/markdown.js`](js/markdown.js)（`window.MarkdownRenderer`），写作端/阅读端复用，一处修双端生效
- **配置驱动**（§4）：后端端口/规则名收敛到 [`config.py`](config.py)，前端存储 key/API 收敛到 [`js/config.js`](js/config.js)，消除散落硬编码
- **API 契约**（§3）：前后端路由唯一权威见 [`TOOL_CONTRACT.md`](TOOL_CONTRACT.md)；`node scripts/contract-check.mjs` 自动校验前后端一致
- **版本号自动化**（§1）：`node scripts/bump-version.mjs` 部署前自动打时间戳版本号，[`publish.bat`](publish.bat) 已接入

## 常见问题

**Q: 本地保存和服务器保存有什么区别？**
「保存」会同时写 `novel.json` 和章节文件到磁盘（有服务器时）；导出则下载一份 JSON 到浏览器。内容都存本地 `data/` 目录，随 git 管理。

**Q: 部署后阅读页内容没更新？**
编辑器里点「💾 保存」确保 `data/novel.json` 是最新，再运行 `publish.bat`；浏览器强刷（Ctrl+F5）避开 CDN 缓存。

**Q: 手机上打开 `http://<IP>:8000` 打不开？**
确认手机和电脑在同一 Wi-Fi，且 Windows 防火墙放行了 8000 端口。

**Q: 章节文件能直接手写吗？**
可以——按 `ch_*.json` 格式（`{id, title, summary, content}`）新建文件，重启服务器或在编辑器点「刷新」即可载入。
