#!/usr/bin/env node
/**
 * 章节版本备份工具 — 保存章节最终定稿到 temp/ 目录
 *
 * 用法：
 *   node tools/backup-chapter.js <章节文件路径> [备注]
 *
 * 示例：
 *   node tools/backup-chapter.js data/chapters/ch_2.json "闺蜜夜话-最终版"
 *   node tools/backup-chapter.js data/chapters/ch_2.json
 *
 * 功能：
 *   1. 将章节文件复制到 temp/ 目录，文件名带时间戳
 *   2. 保留上限 100 个备份，超出时删除最旧的
 *   3. 自动跳过 temp/ 目录内的文件（防止递归备份）
 */

const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '..', 'temp');
const MAX_BACKUPS = 100;

function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error('用法: node tools/backup-chapter.js <章节文件路径> [备注]');
        process.exit(1);
    }

    const srcFile = path.resolve(args[0]);
    const note = args[1] || '';

    // 检查源文件是否存在
    if (!fs.existsSync(srcFile)) {
        console.error(`❌ 文件不存在: ${srcFile}`);
        process.exit(1);
    }

    // 防止备份 temp 目录内的文件
    if (srcFile.startsWith(path.resolve(TEMP_DIR))) {
        console.error('⚠️  跳过：temp 目录内的文件无需再次备份');
        process.exit(0);
    }

    // 确保 temp 目录存在
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    // 读取源文件内容
    const content = fs.readFileSync(srcFile, 'utf8');

    // 生成备份文件名：YYYYMMDD_HHmmss_章节ID_备注.json
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timestamp = [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate()),
        '_',
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds())
    ].join('');

    const baseName = path.basename(srcFile, '.json');
    const noteSuffix = note ? `_${note}` : '';
    const backupName = `${timestamp}_${baseName}${noteSuffix}.json`;
    const backupPath = path.join(TEMP_DIR, backupName);

    // 写入备份
    fs.writeFileSync(backupPath, content, 'utf8');
    console.log(`✅ 已备份: ${backupName}`);

    // 清理超出上限的旧备份
    const backups = fs.readdirSync(TEMP_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => ({
            name: f,
            path: path.join(TEMP_DIR, f),
            time: fs.statSync(path.join(TEMP_DIR, f)).mtimeMs
        }))
        .sort((a, b) => a.time - b.time); // 最旧的在前

    if (backups.length > MAX_BACKUPS) {
        const toDelete = backups.length - MAX_BACKUPS;
        const deleted = backups.slice(0, toDelete);
        deleted.forEach(f => {
            fs.unlinkSync(f.path);
            console.log(`  🗑️  删除旧备份: ${f.name}`);
        });
        console.log(`  已清理 ${toDelete} 个旧备份（上限 ${MAX_BACKUPS}）`);
    }

    console.log(`  当前备份数: ${Math.min(backups.length, MAX_BACKUPS)}`);
}

main();
