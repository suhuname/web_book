#!/usr/bin/env node
/**
 * 章节插入脚本 — 在任意两章之间插入新章节，自动重编号后续章节
 *
 * 用法：
 *   node tools/insert-chapter.js <插入位置ID> <新章节标题> [新章节内容文件路径]
 *
 * 参数说明：
 *   <插入位置ID>       在哪个章节之后插入，例如 ch_7
 *   <新章节标题>        新章节的展示标题，例如 "第八章 心墙渐融"
 *   [新章节内容文件路径]  可选，包含章节正文的文本文件路径。不传则创建空章节。
 *
 * 示例：
 *   node tools/insert-chapter.js ch_7 "第八章 心墙渐融" ./data/chapters/new-ch8-content.txt
 *   node tools/insert-chapter.js ch_7 "第八章 心墙渐融"
 *
 * 功能：
 *   1. 在 novel.json 的指定位置插入新章节
 *   2. 后续章节的 id 和 title 自动递增重编号（ch_8→ch_9→ch_10…）
 *   3. 重命名对应的 data/chapters/<id>.json 文件
 *   4. 更新每个 JSON 文件内部的 id 和 title 字段
 *   5. 重新生成 data/novel.js
 *   6. 输出操作概要
 */

const fs = require('fs');
const path = require('path');

// ========== 配置 ==========
const NOVEL_JSON = path.join(__dirname, '..', 'data', 'novel.json');
const NOVEL_JS = path.join(__dirname, '..', 'data', 'novel.js');
const CHAPTERS_DIR = path.join(__dirname, '..', 'data', 'chapters');

// ========== 辅助函数 ==========

/** 获取当前章节编号（从标题如 "第八章" 或 "第8章" 中提取） */
function parseChapterNumber(title) {
    const cn = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10};
    const m1 = title.match(/^第(\d+)章/);
    if (m1) return parseInt(m1[1], 10);
    const m2 = title.match(/^第([一二三四五六七八九十])章/);
    if (m2) return cn[m2[1]];
    return null;
}

/** 生成章节 ID：ch_1, ch_2, ... */
function makeChapterId(num) {
    return `ch_${num}`;
}

/** 阿拉伯数字转中文数字 */
function toChineseNum(n) {
    const cn = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
    return cn[n] || String(n);
}

/** 生成章节标题：第X章 YYY */
function makeChapterTitle(num, subtitle) {
    const cn = toChineseNum(num);
    return subtitle ? `第${cn}章 ${subtitle}` : `第${cn}章`;
}

/** 获取章节副标题（从 "第八章 心墙渐融" 中提取 "心墙渐融"） */
function parseSubtitle(title) {
    const m = title.match(/^第\d+章\s+(.+)$/);
    return m ? m[1].trim() : '';
}

/** 验证 JSON 文件 */
function validateJson(filePath) {
    try {
        JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return true;
    } catch (e) {
        return false;
    }
}

// ========== 主逻辑 ==========

function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('用法: node tools/insert-chapter.js <插入位置ID> <新章节标题> [内容文件]');
        console.error('示例: node tools/insert-chapter.js ch_7 "第八章 心墙渐融"');
        process.exit(1);
    }

    const insertAfterId = args[0];       // 例如 "ch_7"
    const newTitle = args[1];            // 例如 "第八章 心墙渐融"
    const contentFile = args[2] || null; // 可选的内容文件路径

    // ---- 1. 读取当前数据 ----
    if (!fs.existsSync(NOVEL_JSON)) {
        console.error('❌ 找不到 novel.json，请确认在项目根目录运行');
        process.exit(1);
    }

    // 从 chapters/ 目录读取所有章节并按 id 数值排序（ch_1, ch_2, ... ch_13）
    const chapterFiles = fs.readdirSync(CHAPTERS_DIR)
        .filter(f => f.endsWith('.json'))
        .sort((a, b) => {
            const na = parseInt(a.match(/\d+/), 10);
            const nb = parseInt(b.match(/\d+/), 10);
            return na - nb;
        });

    const chapters = chapterFiles.map(f => {
        const data = JSON.parse(fs.readFileSync(path.join(CHAPTERS_DIR, f), 'utf8'));
        return data;
    });

    const book = { title: '星落之城', author: '未命名', genre: '都市言情' };

    // ---- 2. 查找插入位置 ----
    const insertIdx = chapters.findIndex(c => c.id === insertAfterId);
    if (insertIdx === -1) {
        console.error(`❌ 找不到章节 ID: ${insertAfterId}`);
        process.exit(1);
    }

    // ---- 3. 解析新章节信息 ----
    const newNum = parseChapterNumber(newTitle);
    if (!newNum) {
        console.error(`❌ 无法从标题解析章节编号: ${newTitle} （应为"第X章 YYY"格式）`);
        process.exit(1);
    }

    const newSubtitle = parseSubtitle(newTitle);
    const newId = makeChapterId(newNum);

    // 检查新 ID 是否与"不会被重编号的章节"冲突
    // （后续章节会被重编号，所以只有插入位置之前的章节才算冲突）
    const chaptersBeforeInsert = chapters.slice(0, insertIdx + 1);
    if (chaptersBeforeInsert.some(c => c.id === newId)) {
        console.error(`❌ 章节 ID ${newId} 已存在（与插入点之前的章节冲突），请检查`);
        process.exit(1);
    }

    // ---- 4. 读取新章节内容 ----
    let newContent = '';
    if (contentFile) {
        const contentPath = path.resolve(contentFile);
        if (!fs.existsSync(contentPath)) {
            console.error(`❌ 找不到内容文件: ${contentFile}`);
            process.exit(1);
        }
        newContent = fs.readFileSync(contentPath, 'utf8');
    }

    // ---- 5. 创建新章节对象 ----
    const newChapter = {
        id: newId,
        title: newTitle,
        summary: '',
        content: newContent
    };

    // ---- 6. 重编号后续章节 ----
    const toUpdate = chapters.slice(insertIdx + 1); // 插入位置之后的所有章节
    const renumberMap = {}; // { oldId: { newId, newTitle } }

    toUpdate.forEach((ch, i) => {
        const oldNum = parseChapterNumber(ch.title);
        if (oldNum === null) return;

        const newNumForCh = newNum + 1 + i; // 后续章节编号 = 新章编号 + 1 + 偏移
        const subtitle = parseSubtitle(ch.title);
        const newIdForCh = makeChapterId(newNumForCh);
        const newTitleForCh = makeChapterTitle(newNumForCh, subtitle);

        renumberMap[ch.id] = {
            oldId: ch.id,
            newId: newIdForCh,
            oldTitle: ch.title,
            newTitle: newTitleForCh,
            subtitle: subtitle
        };
    });

    // ---- 7. 执行文件重命名和内容更新 ----
    const renameLog = [];
    const errors = [];

    for (const [oldId, info] of Object.entries(renumberMap)) {
        const oldFile = path.join(CHAPTERS_DIR, `${oldId}.json`);
        const newFile = path.join(CHAPTERS_DIR, `${info.newId}.json`);

        if (!fs.existsSync(oldFile)) {
            errors.push(`⚠️  文件不存在: ${oldFile}（跳过）`);
            continue;
        }

        // 读取旧文件内容
        let fileData;
        try {
            fileData = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
        } catch (e) {
            errors.push(`❌ 解析失败: ${oldFile} - ${e.message}`);
            continue;
        }

        // 更新文件内部的 id 和 title
        fileData.id = info.newId;
        fileData.title = info.newTitle;

        // 写入新文件
        try {
            fs.writeFileSync(newFile, JSON.stringify(fileData, null, 4), 'utf8');
        } catch (e) {
            errors.push(`❌ 写入失败: ${newFile} - ${e.message}`);
            continue;
        }

        // 删除旧文件
        try {
            if (oldFile !== newFile) {
                fs.unlinkSync(oldFile);
            }
        } catch (e) {
            errors.push(`⚠️  删除旧文件失败: ${oldFile} - ${e.message}`);
        }

        renameLog.push(`  ${info.oldTitle} (${oldId}) → ${info.newTitle} (${info.newId})`);

        // 更新 novel.chapters 中的对应条目
        const chIdx = chapters.findIndex(c => c.id === oldId);
        if (chIdx !== -1) {
            chapters[chIdx].id = info.newId;
            chapters[chIdx].title = info.newTitle;
        }
    }

    // ---- 8. 插入新章节到数组 ----
    chapters.splice(insertIdx + 1, 0, newChapter);

    // ---- 9. 写入新章节的 JSON 文件 ----
    const newChapterFile = path.join(CHAPTERS_DIR, `${newId}.json`);
    const newChapterData = {
        id: newId,
        title: newTitle,
        summary: '',
        content: newContent
    };
    fs.writeFileSync(newChapterFile, JSON.stringify(newChapterData, null, 4), 'utf8');
    renameLog.unshift(`  🆕 ${newTitle} (${newId}) [新建]`);

    // ---- 10. 重新生成 novel.js ----
    const manifest = chapters.map(ch => ({
        id: ch.id,
        title: ch.title,
        summary: ch.summary || ''
    }));

    const jsLines = [
        '/**',
        ' * 小说数据加载器（由 insert-chapter.js 自动生成）',
        ' * - 书籍元信息 + 章节清单内联定义',
        ' * - 各章节正文存放在 data/chapters/<id>.json 中',
        ' */',
        '(function(){',
        `var BOOK=${JSON.stringify(book, null, 4).split('\n').join('')};`,
        `var CHAPTER_MANIFEST=${JSON.stringify(manifest, null, 4).split('\n').join('')};`,
        'window.__NOVEL_DATA__=null;',
        'window.__NOVEL_READY__=(function(){',
        "var base='data/chapters/';",
        'function load(m){',
        "return fetch(base+m.id+'.json').then(function(r){",
        "if(!r.ok)throw Error('HTTP '+r.status);",
        'return r.json();',
        '}).then(function(d){',
        "return{id:m.id,title:m.title,summary:m.summary,content:d.content||''};",
        '}).catch(function(e){',
        "console.warn('[novel] 加载'+m.id+'失败:',e);",
        "return{id:m.id,title:m.title,summary:m.summary,content:''};",
        '});',
        '}',
        'return Promise.all(CHAPTER_MANIFEST.map(load)).then(function(chs){',
        'var d={book:BOOK,chapters:chs};',
        'window.__NOVEL_DATA__=d;',
        'return d;',
        '});',
        '})();',
        '})();',
        ''
    ];
    fs.writeFileSync(NOVEL_JS, jsLines.join('\n'), 'utf8');

    // ---- 12. 输出操作概要和验证 ----
    console.log('\n✅ 章节插入完成！');
    console.log('='.repeat(50));
    console.log(`  插入: ${newTitle} (${newId})`);
    console.log(`  位置: 在 "${chapters[insertIdx]?.title || insertAfterId}" 之后`);
    console.log(`  后续: ${renameLog.length - 1} 个章节已重编号`);
    console.log('='.repeat(50));
    console.log('\n📋 变更清单:');
    renameLog.forEach(line => console.log(line));

    if (errors.length > 0) {
        console.log('\n⚠️  警告:');
        errors.forEach(e => console.log(`  ${e}`));
    }

    // ---- 13. 最终文件验证 ----
    const allIds = chapters.map(c => c.id);
    const allFiles = fs.readdirSync(CHAPTERS_DIR).filter(f => f.endsWith('.json'));
    const missingFiles = allIds.filter(id => !allFiles.includes(`${id}.json`));
    const extraFiles = allFiles.filter(f => !allIds.includes(f.replace('.json', '')));

    console.log('\n📊 验证:');
    console.log(`  章节总数: ${chapters.length}`);
    console.log(`  chapter 文件数: ${allFiles.length}`);

    if (missingFiles.length > 0) {
        console.log(`  ❌ 缺少文件: ${missingFiles.join(', ')}`);
    } else {
        console.log('  ✅ 所有章节文件均存在');
    }

    if (extraFiles.length > 0) {
        console.log(`  ⚠️  多余文件: ${extraFiles.join(', ')}（建议手动清理）`);
    }

    // 验证所有 JSON 文件
    let validCount = 0;
    let invalidCount = 0;
    allFiles.forEach(f => {
        if (validateJson(path.join(CHAPTERS_DIR, f))) {
            validCount++;
        } else {
            console.log(`  ❌ 文件损坏: ${f}`);
            invalidCount++;
        }
    });
    console.log(`  JSON 验证: ${validCount} 个正常${invalidCount > 0 ? `, ${invalidCount} 个损坏` : ', 全部正常 ✅'}`);

    // 字数统计
    console.log('\n📝 字数统计:');
    chapters.forEach(c => {
        const cn = (c.content || '').match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || [];
        const flag = cn.length >= 2000 && cn.length <= 3000 ? '✅' : cn.length === 0 ? '⬜' : '⚠️';
        console.log(`  ${c.title}: ${cn.length}字 ${flag}`);
    });
}

main();
