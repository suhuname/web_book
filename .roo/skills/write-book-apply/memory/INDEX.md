<!--
记忆索引文件 — 每个记忆的摘要入口
每次新增记忆时，必须在本表末尾追加条目
-->

# 记忆索引

| 编号 | 标题 | 标签 | 模块 | 摘要 |
|------|------|------|------|------|
| exp-20260726-001 | 创建本技能 — write-book-apply 技能初始化 | `skill` `init` `write-book-apply` `INDEX.md` | `.roo/skills/write-book-apply/SKILL.md` `.roo/skills/write-book-apply/memory/INDEX.md` | 首次为 e:/Project/write_book 创建 write-book-apply 技能 |
| exp-20260726-002 | UI 主题切换与阅读体验优化 | `theme` `ui` `css` `localStorage` | `index.html` `css/style.css` `js/app.js` | 新增暗夜/护眼绿/纸墨三套主题，优化字体间距提升阅读体验 |
| exp-20260726-003 | 阅读页与分享链接 | `reader` `share` `base64url` `reader.html` | `reader.html` `js/reader.js` `index.html` `js/app.js` | 新增纯阅读界面与无后端分享功能，数据经 base64url 编码嵌入 URL hash |
| exp-20260727-004 | 第五章代码块标记修复 — 手机端宽度异常 | `bugfix` `markdown` `codeblock` | `data/chapters/ch_5.json` | 修复 ch_5 中 ``` 标记奇数(9个)导致登山叙事被错误纳入代码块，手机端出现水平滚动条 |
| exp-20260727-005 | server.py 修复 Ctrl+C 无法退出 + 手机无法访问 | `bugfix` `server` `http` `firewall` `keep-alive` | `server.py` | 改用 ThreadingHTTPServer + daemon_threads + socket 超时保证 Ctrl+C 立退；启动时自动添加 Windows 防火墙规则并列出所有网卡 IP |
| exp-20260727-006 | 添加刷新按钮 — 从 JSON 文件重新拉取章节内容 | `feature` `ui` `refresh` `fetch` `cache` | `index.html` `js/app.js` `css/style.css` | 工具栏新增「🔄 刷新」按钮，优先使用 /api/novel 接口降级直接 fetch 章节 JSON。同时为 app.js 和 style.css 添加缓存版本号参数 |
| exp-20260727-007 | server.py _load_novel 改为优先读取章节 JSON 文件 | `bugfix` `server` `api` `cache` | `server.py` | 修复 _load_novel 只读 content 不读 title/summary 的问题；添加 Cache-Control: no-store 防止浏览器缓存 |
| exp-20260727-008 | 初始加载优先使用 /api/novel 接口读取最新数据 | `bugfix` `api` `cache` `data-source` `js/app.js` | `js/app.js` `server.py` `data/novel.js` | 修复 `_loadNovelData()` 走 `__NOVEL_READY__` 而非 `/api/novel` 接口，导致初始加载显示陈旧数据需手动点击刷新才能获取最新内容的问题 |
| 2026-07-27-009 | 添加快捷到顶部/到底部按钮 | `feature` `ui` `navigation` `scroll` | `css/style.css` `index.html` `reader.html` | 编辑页和阅读页新增浮动 ↑↓ 按钮组。编辑页因 html/body 有 overflow:hidden，改用内部元素（textarea/preview-panel）滚动；阅读页直接用 window.scrollTo |
| 2026-07-29-010 | 文本中插入图片功能 | `feature` `image` `upload` `markdown` `editor` | `index.html` `js/app.js` `css/style.css` | 新增完整的图片插入功能：工具栏按钮、上传本地图片转 base64、URL 链接输入、剪贴板粘贴图片、拖拽图片到编辑器。复用现有 Markdown 渲染器 |

<!-- 新增记忆后，同步更新此表 -->
