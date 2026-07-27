# Vercel 云端部署指南

## 前置条件（一次性）

1. **Node.js** — 已安装（当前环境已有 npm 10.9.4）
2. **Vercel CLI** — 已全局安装（当前 v57.0.0）
3. **Vercel 账号** — 访问 [vercel.com](https://vercel.com)，用 GitHub 账号登录

## 首次部署

双击运行 `publish.bat`：

- 首次运行会弹出浏览器要求登录授权（选择 GitHub 登录即可）
- 授权后自动执行 `vercel --prod` 生产部署
- 成功后自动把 `https://xxx.vercel.app/reader.html` 复制到剪贴板

## 后续发布

每次修改小说内容后：

1. 在编辑器中点击 **💾 保存到文件**（确保 `data/novel.json` 是最新）
2. 双击 `publish.bat`
3. 脚本自动部署并把最新链接复制到剪贴板，直接粘贴发给朋友即可

## 生成的网址

- **阅读页**：`https://<项目名>.vercel.app/reader.html`（对外分享用这个）
- **编辑器**：`https://<项目名>.vercel.app/index.html`（自己用）

> 免费版 Vercel 域名自带 HTTPS，全球 CDN 加速，无需自己维护服务器。

## 常见问题

| 问题 | 解决 |
|------|------|
| 提示未登录 | 运行 `vercel login`，浏览器授权后重试 |
| 想换绑域名 | 在 Vercel 控制台 → Project → Settings → Domains 添加自定义域名 |
| 部署后内容没更新 | 强制刷新浏览器（Ctrl+F5），或检查 `data/novel.json` 是否已保存 |
| 国内访问慢 | 可在 Vercel 控制台绑定自定义域名 + DNS 加速 |

## 文件说明

- `vercel.json` — Vercel 路由/缓存配置（`/read` 短链重定向到 `reader.html`）
- `.vercelignore` — 部署时排除 `.roo/`、临时脚本等非必要文件
- `publish.bat` — 一键发布脚本（自动登录检测、部署、复制链接）
