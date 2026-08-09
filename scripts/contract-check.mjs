#!/usr/bin/env node
/**
 * web_book 前后端 API 契约校验（§3 工具契约文档化）
 *
 * 校验：
 *  (a) js/config.js 中声明的每个 API 端点，在 server.py 中都有对应路由处理；
 *  (b) server.py 中每个 /api 路由，都在 TOOL_CONTRACT.md 契约表中有文档行。
 *
 * 用法：node scripts/contract-check.mjs
 * 任一不匹配 → 退出码非 0，并列出差异。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf-8');

function serverEndpoints() {
    const src = read('server.py');
    const eps = new Set();
    // 匹配 do_GET / do_POST 中的路由判断
    const re = /if path (?:==|startswith\()["'](\/api\/[^"'\)]+)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        eps.add(m[1].replace(/\//g, '').replace(/"/g, ''));
        // 保留原始 /api/xxx 形态
    }
    // 重新用更宽松方式抓原始路径片段
    const eps2 = new Set();
    const re2 = /["'](\/api\/[\w\/]+)["']/g;
    let m2;
    while ((m2 = re2.exec(src)) !== null) eps2.add(m2[1]);
    return { eps2 };
}

function configEndpoints() {
    const src = read('js/config.js');
    const eps = new Set();
    const re = /['"`](\/api\/[\w\/]+)['"`]/g;
    let m;
    while ((m = re.exec(src)) !== null) eps.add(m[1]);
    return eps;
}

function contractEndpoints() {
    const src = read('TOOL_CONTRACT.md');
    const eps = new Set();
    const re = /`(\/api\/[\w\/]+)`/g;
    let m;
    while ((m = re.exec(src)) !== null) eps.add(m[1]);
    return eps;
}

const server = serverEndpoints().eps2;
const config = configEndpoints();
const contract = contractEndpoints();

let failed = false;

// (a) config 端点必须存在于 server.py
for (const ep of config) {
    if (!server.has(ep)) {
        console.error(`❌ [config→server] ${ep} 在 server.py 中不存在路由`);
        failed = true;
    }
}

// (b) server 的 /api 端点必须在契约表中有文档行
for (const ep of server) {
    if (!contract.has(ep)) {
        console.error(`❌ [server→contract] ${ep} 未在 TOOL_CONTRACT.md 中登记`);
        failed = true;
    }
}

// (c) 契约表中的端点必须真实存在（防悬空文档）
for (const ep of contract) {
    if (!server.has(ep)) {
        console.error(`❌ [contract→server] ${ep} 在 server.py 中已不存在`);
        failed = true;
    }
}

if (failed) {
    console.error('\n✗ 契约不一致，请按 TOOL_CONTRACT.md 修正后重试。');
    process.exit(1);
}
console.log(`✓ 契约一致（server: ${[...server].join(', ') || '无 /api 路由'}）`);
