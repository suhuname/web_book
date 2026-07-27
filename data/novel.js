/**
 * 小说数据加载器（由 server.py 自动生成）
 * - 书籍元信息 + 章节清单内联定义
 * - 各章节正文存放在 data/chapters/<id>.json 中
 */
(function(){
var BOOK={"title": "星落之城", "author": "未命名", "genre": "都市言情", "description": "广州梅雨季，一段关于相遇与重逢的故事。", "createdAt": "2026-07-26"};
var CHAPTER_MANIFEST=[{"id": "ch_1", "title": "第一章 雨夜邂逅", "summary": ""}, {"id": "ch_2", "title": "第二章 星光不散", "summary": ""}, {"id": "ch_3", "title": "第三章 初入星澜", "summary": ""}, {"id": "ch_4", "title": "第四章 并肩作战", "summary": "林晚和顾深为设计方案加班讨论，在专业碰撞中擦出创意火花。深夜，顾深送林晚回家，雨中的广州城见证了两颗心悄然靠近。"}, {"id": "ch_5", "title": "第五章 暗生情愫", "summary": "项目进入关键阶段，林晚和顾深相处时间越来越多。苏漫鼓励林晚主动，但林晚顾虑上下级关系。公司团建活动中的意外亲密接触，让两颗心的距离悄然拉近。"}, {"id": "ch_6", "title": "第六章 风波骤起", "summary": "程昱以大赛评委身份来访，向顾深暗示林晚作品有抄袭嫌疑。公司内部议论纷纷，沈瑶却在关键时刻为林晚挺身辩护，顾深公开力挺。信任与友情在风波中悄然生长。"}, {"id": "ch_7", "title": "第七章 误会重重", "summary": "林晚无意中发现顾深手机里三年前偷拍她的照片，误以为顾深别有用心。激烈争吵后，顾深终于坦白三年来的寻找与等待。真相浮出水面，一切开始变得不一样。"}, {"id": "ch_8", "title": "第八章 心墙渐融", "summary": "坦白之后的第一个工作日，林晚和顾深在办公室里尴尬相遇。两人都在小心翼翼地试探对方的边界，表面装作若无其事，内心却波涛暗涌。苏漫的一番话让林晚开始正视自己的心意，而顾深的一个决定让那道心墙悄然融化。"}, {"id": "ch_9", "title": "第九章 患难与共", "summary": "大赛截稿前夜，林晚的电脑突然崩溃，设计文件全部受损。顾深赶来陪她通宵重做。在困境中，两人放下所有顾虑彼此依靠，窗外的雨声和键盘声交织成属于他们的夜晚。"}, {"id": "ch_10", "title": "第十章 星澜绽放", "summary": "国际设计大赛结果揭晓，星澜文化凭借「星落之城」获得银奖。庆功宴上，顾深在所有人面前向林晚表白。广州的夜空下，星光终于落在了两个人身上。"}, {"id": "ch_11", "title": "第十一章 风雨考验", "summary": ""}, {"id": "ch_12", "title": "第十二章 坚定选择", "summary": ""}, {"id": "ch_13", "title": "第十三章 山雨欲来", "summary": ""}];
window.__NOVEL_DATA__=null;
window.__NOVEL_READY__=(function(){
var base='data/chapters/';
function load(m){
return fetch(base+m.id+'.json').then(function(r){
if(!r.ok)throw Error('HTTP '+r.status);
return r.json();
}).then(function(d){
return{id:m.id,title:m.title,summary:m.summary,content:d.content||''};
}).catch(function(e){
console.warn('[novel] 加载'+m.id+'失败:',e);
return{id:m.id,title:m.title,summary:m.summary,content:''};
});
}
return Promise.all(CHAPTER_MANIFEST.map(load)).then(function(chs){
var d={book:BOOK,chapters:chs};
window.__NOVEL_DATA__=d;
return d;
});
})();
})();
