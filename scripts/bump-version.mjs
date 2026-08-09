#!/usr/bin/env node
/**
 * 前端静态资源版本号自动更新（§1 缓存版本号自动化）
 *
 * 把 index.html / reader.html 中所有 `?v=<旧值>` 的资源引用更新为
 * 当前时间戳版本（YYYYMMDD-HHmm），避免改文件后 CDN/浏览器缓存不刷新。
 *
 * 用法：node scripts/bump-version.mjs
 * 部署（publish.bat）前调用，替代手动改 `?v=`。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TARGETS = ['index.html', 'reader.html'];

function stamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

const ver = stamp();
let changed = false;

for (const file of TARGETS) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    const src = fs.readFileSync(full, 'utf-8');
    const next = src.replace(/(\?v=)[^\s"']*/g, (m, prefix) => {
        changed = true;
        return `${prefix}${ver}`;
    });
    if (next !== src) {
        fs.writeFileSync(full, next, 'utf-8');
        console.log(`✓ ${file} 版本号 → v=${ver}`);
    }
}

if (!changed) {
    console.log('（未发现 ?v= 引用，跳过）');
}
