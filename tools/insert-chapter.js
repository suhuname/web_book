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
 *   1. 更新 novel.json — 插入新章节条目，后续章节重编号
 *   2. 重命名 data/chapters/<id>.json 文件并更新内部 id/title
 *   3. 写入新章节的 JSON 文件
 *   4. 自动更新 data/outline.md — 插入新章节行、重编号后续标题、更新幕范围
 *   5. novel.js 无需手动更新（运行时从 novel.json 动态加载）
 *   6. 验证所有文件完整性 + novel.json 与 chapters/ 一致性检查
 *   7. 输出操作概要
 */

const fs = require('fs');
const path = require('path');

// ========== 配置 ==========
const NOVEL_JSON = path.join(__dirname, '..', 'data', 'novel.json');
const NOVEL_JS = path.join(__dirname, '..', 'data', 'novel.js');
const CHAPTERS_DIR = path.join(__dirname, '..', 'data', 'chapters');
const OUTLINE_MD = path.join(__dirname, '..', 'data', 'outline.md');

// ========== 中文数字工具 ==========
const CN_MAP = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,
  '十一':11,'十二':12,'十三':13,'十四':14,'十五':15,'十六':16,'十七':17,'十八':18,'十九':19,'二十':20};
const CN_REV = ['零','一','二','三','四','五','六','七','八','九','十',
  '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十'];

function cn2num(s) { return CN_MAP[s] || parseInt(s, 10) || 0; }
function num2cn(n) { return CN_REV[n] || String(n); }

// ========== 辅助函数 ==========

/** 获取当前章节编号（从标题如 "第八章" 或 "第8章" 或 "第十一章" 中提取） */
function parseChapterNumber(title) {
    const m1 = title.match(/^第(\d+)章/);
    if (m1) return parseInt(m1[1], 10);
    const m2 = title.match(/^第([一二三四五六七八九十]+)章/);
    if (m2) return cn2num(m2[1]) || null;
    return null;
}

/** 生成章节 ID：ch_1, ch_2, ... */
function makeChapterId(num) { return `ch_${num}`; }

/** 生成章节标题：第X章 YYY */
function makeChapterTitle(num, subtitle) {
    return subtitle ? `第${num2cn(num)}章 ${subtitle}` : `第${num2cn(num)}章`;
}

/** 获取章节副标题（从 "第八章 心墙渐融" 或 "第8章 心墙渐融" 中提取 "心墙渐融"） */
function parseSubtitle(title) {
    const m = title.match(/^第\S+章[:：\s]\s*(.+)$/);
    return m ? m[1].trim() : '';
}

/** 验证 JSON 文件 */
function validateJson(filePath) {
    try { JSON.parse(fs.readFileSync(filePath, 'utf8')); return true; }
    catch (e) { return false; }
}

// ========== 主逻辑 ==========

function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('用法: node tools/insert-chapter.js <插入位置ID> <新章节标题> [内容文件]');
        console.error('示例: node tools/insert-chapter.js ch_7 "第八章 心墙渐融"');
        process.exit(1);
    }

    const insertAfterId = args[0];
    const newTitle = args[1];
    const contentFile = args[2] || null;

    // ---- 1. 读取当前数据 ----
    if (!fs.existsSync(NOVEL_JSON)) {
        console.error('❌ 找不到 novel.json，请确认在项目根目录运行');
        process.exit(1);
    }

    // 读取 novel.json 中的 book 元信息
    const novelData = JSON.parse(fs.readFileSync(NOVEL_JSON, 'utf8'));
    const book = novelData.book || { title: '星落之城', author: '未命名', genre: '都市言情' };

    // 从 chapters/ 目录读取所有章节并按 id 数值排序
    const chapterFiles = fs.readdirSync(CHAPTERS_DIR)
        .filter(f => f.endsWith('.json'))
        .sort((a, b) => {
            const na = parseInt(a.match(/\d+/), 10);
            const nb = parseInt(b.match(/\d+/), 10);
            return na - nb;
        });

    const chapters = chapterFiles.map(f => {
        return JSON.parse(fs.readFileSync(path.join(CHAPTERS_DIR, f), 'utf8'));
    });

    // ---- 2. 查找插入位置 ----
    const insertIdx = chapters.findIndex(c => c.id === insertAfterId);
    if (insertIdx === -1) {
        console.error(`❌ 找不到章节 ID: ${insertAfterId}`);
        process.exit(1);
    }

    // 获取插入点章节的编号（用于幕范围更新判断）
    const insertAfterNum = parseChapterNumber(chapters[insertIdx].title) || 0;

    // ---- 3. 解析新章节信息 ----
    const newNum = parseChapterNumber(newTitle);
    if (!newNum) {
        console.error(`❌ 无法从标题解析章节编号: ${newTitle} （应为"第X章 YYY"格式）`);
        process.exit(1);
    }

    const newSubtitle = parseSubtitle(newTitle);
    const newId = makeChapterId(newNum);

    // 检查新 ID 是否与插入点之前的章节冲突
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
    // 注意：toUpdate 包含插入点之后的所有章节
    const toUpdate = chapters.slice(insertIdx + 1);
    const renumberList = [];

    toUpdate.forEach((ch, i) => {
        const oldNum = parseChapterNumber(ch.title);
        if (oldNum === null) {
            console.warn(`⚠️  无法解析章节编号，跳过: ${ch.title} (${ch.id})`);
            return;
        }

        const newNumForCh = newNum + 1 + i;
        const subtitle = parseSubtitle(ch.title);
        const newIdForCh = makeChapterId(newNumForCh);
        const newTitleForCh = makeChapterTitle(newNumForCh, subtitle);

        renumberList.push({
            oldId: ch.id,
            newId: newIdForCh,
            oldTitle: ch.title,
            newTitle: newTitleForCh,
            subtitle: subtitle,
            summary: ch.summary || ''
        });
    });

    // ---- 7. 执行文件重命名 ----
    // ⚠️ 逆序遍历（从最后章节往前处理），防止级联覆盖
    const renameLog = [];
    const errors = [];

    for (let ri = renumberList.length - 1; ri >= 0; ri--) {
        const info = renumberList[ri];
        const oldFile = path.join(CHAPTERS_DIR, `${info.oldId}.json`);
        const newFile = path.join(CHAPTERS_DIR, `${info.newId}.json`);

        if (!fs.existsSync(oldFile)) {
            errors.push(`⚠️  文件不存在: ${oldFile}（跳过）`);
            continue;
        }

        let fileData;
        try {
            fileData = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
        } catch (e) {
            errors.push(`❌ 解析失败: ${oldFile} - ${e.message}`);
            continue;
        }

        fileData.id = info.newId;
        fileData.title = info.newTitle;

        try {
            fs.writeFileSync(newFile, JSON.stringify(fileData, null, 4), 'utf8');
        } catch (e) {
            errors.push(`❌ 写入失败: ${newFile} - ${e.message}`);
            continue;
        }

        try {
            if (oldFile !== newFile) {
                fs.unlinkSync(oldFile);
            }
        } catch (e) {
            errors.push(`⚠️  删除旧文件失败: ${oldFile} - ${e.message}`);
        }

        renameLog.push(`  ${info.oldTitle} (${info.oldId}) → ${info.newTitle} (${info.newId})`);

        // 更新 chapters 数组中的对应条目
        const chIdx = chapters.findIndex(c => c.id === info.oldId);
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

    // ---- 10. 更新 novel.json ----
    const updatedNovel = {
        book: book,
        chapters: chapters.map(ch => ({
            id: ch.id,
            title: ch.title,
            summary: ch.summary || ''
        }))
    };
    fs.writeFileSync(NOVEL_JSON, JSON.stringify(updatedNovel, null, 4), 'utf8');
    console.log('  ✅ novel.json 已更新');

    // ---- 11. 更新 outline.md（大纲编号和幕范围） ----
    try {
        if (fs.existsSync(OUTLINE_MD)) {
            let outline = fs.readFileSync(OUTLINE_MD, 'utf8');
            const lines = outline.split('\n');
            const newLines = [];
            let inserted = false;

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];

                // 匹配章节标题：#### 第X章：标题 或 #### 第X章 标题
                const chMatch = line.match(/^(#{1,6}\s*)第([一二三四五六七八九十\d]+)章[:：\s]*(.*)$/);
                if (chMatch) {
                    const prefix = chMatch[1];
                    const chNum = cn2num(chMatch[2]);
                    const rest = chMatch[3];

                    if (!inserted && chNum === newNum) {
                        // 编号刚好等于新章编号，说明大纲中已有此编号的章节
                        // 什么都不做，继续
                    }

                    if (chNum >= newNum && !inserted) {
                        // 在第一个编号>=新章编号的章节之前插入新行
                        const subtitle = parseSubtitle(newTitle);
                        newLines.push('');
                        newLines.push(`${prefix}第${num2cn(newNum)}章：${subtitle || '（新章节）'}`);
                        newLines.push('> **字数目标：2000-3000 字**');
                        newLines.push('');
                        newLines.push('> *（请在此补充新章节的剧情描述）*');
                        newLines.push('');
                        // 当前行编号+1
                        line = `${prefix}第${num2cn(chNum + 1)}章：${rest}`;
                        inserted = true;
                    } else if (inserted && chNum > newNum - 1) {
                        // 已插入过，后续章节编号+1
                        line = `${prefix}第${num2cn(chNum + 1)}章：${rest}`;
                    }
                    // 注意：chNum < newNum 的章节保持原样（插入点之前的章节）
                }

                // 匹配幕标题：### 第X幕：标题（第 X-Y 章）
                // 支持格式：第 5-7 章、第五-七章、第5-7章、第 5 ~ 7 章
                const actMatch = line.match(
                    /^(#{1,6}\s*)第([一二三四五六七八九十\d]+)幕[:：].*?[（\(]第\s*([一二三四五六七八九十\d]+)\s*[-~—〜]\s*([一二三四五六七八九十\d]+)\s*章[）\)]/
                );
                if (actMatch) {
                    const prefix = actMatch[1];
                    const actNum = cn2num(actMatch[2]);
                    const rangeStartRaw = actMatch[3]; // 原始字符串（如 "5" 或 "五"）
                    const rangeEndRaw = actMatch[4];   // 原始字符串
                    const rangeStart = cn2num(rangeStartRaw);
                    const rangeEnd = cn2num(rangeEndRaw);

                    // 判断原始格式：使用阿拉伯数字还是中文数字
                    const useDigit = /^\d+$/.test(rangeStartRaw);

                    // 如果幕的结束编号 >= 插入点章节编号（即这一幕包含了插入点及其之后的章节）
                    // 则范围的结束编号 +1
                    // 如果幕的起始编号 > 插入点章节编号，则起始编号也 +1
                    if (rangeEnd >= insertAfterNum) {
                        const newStart = rangeStart > insertAfterNum ? rangeStart + 1 : rangeStart;
                        const newEnd = rangeEnd + 1;
                        const sep = line.match(/[-~—〜]/) ? line.match(/[-~—〜]/)[0] : '-';
                        const fmtStart = useDigit ? String(newStart) : num2cn(newStart);
                        const fmtEnd = useDigit ? String(newEnd) : num2cn(newEnd);
                        // 保留原始格式：捕获起始空格、数字、分隔符周围空格、结束数字、结尾空格
                        line = line.replace(
                            /([（\(]第)(\s*)([一二三四五六七八九十\d]+)(\s*)([-~—〜])(\s*)([一二三四五六七八九十\d]+)(\s*)(章[）\)])/,
                            `$1$2${fmtStart}$4$5$6${fmtEnd}$8$9`
                        );
                    }
                }

                newLines.push(line);
            }

            if (!inserted) {
                // 没有找到匹配的章节标题，在文件末尾追加
                newLines.push('');
                newLines.push(`#### 第${num2cn(newNum)}章：${newSubtitle || '（新章节）'}`);
                newLines.push('> **字数目标：2000-3000 字**');
                newLines.push('');
                newLines.push('> *（请在此补充新章节的剧情描述）*');
            }

            fs.writeFileSync(OUTLINE_MD, newLines.join('\n'), 'utf8');
            console.log('  ✅ outline.md 已更新 — 插入新章节并重编号');
        }
    } catch (e) {
        console.log(`  ⚠️  outline.md 更新失败: ${e.message}（可手动更新）`);
    }

    // ---- 12. novel.js 无需重新生成（从 novel.json 动态读取） ----
    console.log('  ✅ novel.js 无需更新（运行时从 novel.json 动态加载）');

    // ---- 13. 输出操作概要和验证 ----
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

    // ---- 14. 最终文件验证 ----
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

    // 字数统计（从文件读取实际内容）
    console.log('\n📝 字数统计:');
    chapters.forEach(c => {
        const filePath = path.join(CHAPTERS_DIR, `${c.id}.json`);
        let content = '';
        if (fs.existsSync(filePath)) {
            try {
                content = JSON.parse(fs.readFileSync(filePath, 'utf8')).content || '';
            } catch (e) { /* ignore */ }
        }
        const cn = (content || '').match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || [];
        const flag = cn.length >= 2000 && cn.length <= 3000 ? '✅' : cn.length === 0 ? '⬜' : '⚠️';
        console.log(`  ${c.title}: ${cn.length}字 ${flag}`);
    });

    // 检查 novel.json 与 chapters/ 的一致性
    console.log('\n🔍 一致性检查:');
    let consistent = true;
    const novelChs = JSON.parse(fs.readFileSync(NOVEL_JSON, 'utf8')).chapters;
    novelChs.forEach(nc => {
        const filePath = path.join(CHAPTERS_DIR, `${nc.id}.json`);
        if (!fs.existsSync(filePath)) {
            console.log(`  ❌ novel.json 中有 ${nc.id} (${nc.title})，但 chapters/ 中无对应文件`);
            consistent = false;
        } else {
            const fc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (fc.id !== nc.id || fc.title !== nc.title) {
                console.log(`  ⚠️  ${nc.id}: novel.json 标题="${nc.title}"，文件标题="${fc.title}"`);
                consistent = false;
            }
        }
    });
    if (consistent) console.log('  ✅ novel.json 与 chapters/ 完全一致');
}

main();
