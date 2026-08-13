import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve('output', '审美素材库');
const INDEX_PATH = path.join(ROOT, 'library-index.json');
const ELEMENTS_PATH = path.join(ROOT, 'element-library.json');
const RULES_PATH = path.join(ROOT, 'compatibility-rules.json');

const missingElements = [
  {
    id: 'mission-editorial',
    type: '排版结构',
    name: '使命叙事编辑布局',
    mood: ['trust', 'editorial', 'calm'],
    density: 'medium',
    motion: 'medium',
    bestFor: ['组织公益'],
    avoidWith: ['hard-sell-cta', 'dense-dashboard'],
    requires: ['mission-copy', 'research-canvas'],
    description: '用清晰立场、证据段落、研究图像与行动入口组织公共议题和机构使命。',
  },
  {
    id: 'cinematic-hero',
    type: '排版结构',
    name: '电影感媒体首屏',
    mood: ['cinematic', 'premium'],
    density: 'medium',
    motion: 'medium',
    bestFor: ['媒体娱乐'],
    avoidWith: ['dense-dashboard', 'institutional-split'],
    requires: ['dark-cinema-canvas', 'media-led'],
    description: '以可辨识的影片、节目或人物媒体为首屏主体，标题和转化动作保持克制。',
  },
];

const concreteHardConflicts = [
  { a: 'editorial-serif', b: 'b2b-grid', reason: '编辑感衬线依赖留白，不适合高密度 B2B 功能网格。' },
  { a: 'brand-sans', b: 'research-canvas', reason: '消费品牌字体语气与研究型画布的信息组织冲突。' },
  { a: 'presentation-sans', b: 'cursor-play', reason: '静态路演字体系统不应搭配鼠标玩具动效。' },
  { a: 'quiet-finance-canvas', b: 'cursor-play', reason: '金融可信画布与鼠标追随动效冲突。' },
  { a: 'research-canvas', b: 'product-hover', reason: '研究证据画布不应使用强转化式产品悬停。' },
  { a: 'black-data-canvas', b: 'media-fade', reason: '固定数据路演画布不应混入媒体叙事转场。' },
];

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function writeJson(file, value) {
  await fs.writeFile(file, JSON.stringify(value, null, 2));
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function toDisk(relativePath) {
  return path.join(ROOT, ...relativePath.split('/'));
}

function normalizePackRules(item) {
  const profile = item.compatibilityProfile || {};
  return {
    primaryTemplate: item.id,
    profile,
    compatibleElements: profile.recommendedElements || [],
    avoidWith: profile.blockedElements || [],
  };
}

function normalizeCompatibility(items, elements, rules) {
  const ids = new Set(elements.map((element) => element.id));
  const elementTypes = ['字体系统', '排版结构', '视觉背景', '动效系统'];
  for (const element of elements) {
    element.avoidWith = (element.avoidWith || []).filter((id) => ids.has(id));
  }
  const hardConflicts = [...(rules.hardConflicts || []), ...concreteHardConflicts]
    .filter((conflict) => ids.has(conflict.a) && ids.has(conflict.b));
  rules.hardConflicts = [...new Map(hardConflicts.map((conflict) => [[conflict.a, conflict.b].sort().join('::'), conflict])).values()];
  for (const [useCase, rule] of Object.entries(rules.useCaseRules || {})) {
    rule.recommended = (rule.recommended || []).filter((id) => ids.has(id));
    rule.blocked = elements
      .filter((element) => elementTypes.includes(element.type) && !(element.bestFor || []).includes(useCase))
      .map((element) => element.id);
  }
  for (const item of items) {
    const profile = item.compatibilityProfile || {};
    const useCaseRule = rules.useCaseRules?.[profile.useCase || item.displayCategory];
    const recommended = (profile.recommendedElements || useCaseRule?.recommended || []).filter((id) => ids.has(id));
    item.compatibilityProfile = {
      ...profile,
      recommendedElements: recommended,
      blockedElements: useCaseRule?.blocked || [],
      hardRule: '主模板只允许 recommendedElements；同时执行用途、动效上限和真实元素对冲突检查，任一失败必须禁用导出。',
    };
  }
  return rules;
}

async function updatePackRules(items, hardConflicts) {
  for (const item of items) {
    const dir = toDisk(item.packPath);
    const rules = { ...normalizePackRules(item), globalHardConflicts: hardConflicts };
    await writeJson(path.join(dir, 'compatibility-rules.json'), rules);
  }
}

async function updateEvidenceEntrypoints(items) {
  const start = '<!-- FULL_REPRODUCTION_EVIDENCE_START -->';
  const end = '<!-- FULL_REPRODUCTION_EVIDENCE_END -->';
  for (const item of items.filter((entry) => entry.type === 'website')) {
    const dir = toDisk(item.packPath);
    const preview = path.join(dir, 'reproduction-evidence', 'screenshots', 'desktop-viewport.png');
    if (await exists(preview)) {
      item.previewPath = `${item.packPath}/reproduction-evidence/screenshots/desktop-viewport.png`;
    }
    item.publicPackVersion = '2026-07-13-full-evidence-v3';
    const guidePath = path.join(dir, 'AGENT_README.md');
    const current = await fs.readFile(guidePath, 'utf8').catch(() => `# AGENT_README\n`);
    const block = `${start}
## 强制先读：完整复刻证据

以下文件优先级高于旧的 \`captures/\`，不得跳过：

1. \`reproduction-evidence/replication-manifest.json\`：先确认所有硬性证据为 true。
2. \`reproduction-evidence/screenshots/\`、\`scroll-states/\`、\`recordings/\`：桌面、移动、全页和动态视觉真值。
3. \`reproduction-evidence/assets/\`、\`asset-manifest.json\`：本地字体、图片、视频、来源和 SHA-256。
4. \`reproduction-evidence/css/\`、\`css-variables.json\`：原始样式、内联样式、计算样式和变量。
5. \`reproduction-evidence/dom/\`、\`component-geometry.json\`：渲染 DOM、组件尺寸、间距和排版计算值。
6. \`reproduction-evidence/interaction-states.json\` 与状态截图：控件及 hover、菜单、tabs、折叠等状态。
7. \`reproduction-evidence/research/source-reader.md\`：页面语义、文案结构与来源链接。

如果清单存在未解决资源或截图质量审计失败，禁止声称能够完整复刻。
${end}`;
    const next = current.includes(start)
      ? current.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block)
      : current.replace(/^(# [^\r\n]+\r?\n)/, `$1\n${block}\n`);
    await fs.writeFile(guidePath, next, 'utf8');
    const manifestPath = path.join(dir, 'manifest.json');
    try {
      const manifest = await readJson(manifestPath);
      manifest.reproductionEvidence = {
        version: '2026-07-13-full-evidence-v3',
        root: 'reproduction-evidence',
        manifest: 'reproduction-evidence/replication-manifest.json',
        auditedPreview: 'reproduction-evidence/screenshots/desktop-viewport.png',
      };
      await writeJson(manifestPath, manifest);
    } catch {}
  }
}

async function rebuildZips(items) {
  for (const item of items) {
    const sourceDir = toDisk(item.packPath);
    const destination = toDisk(item.zipPath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.rm(destination, { force: true });
    const result = spawnSync(
      'tar.exe',
      ['-a', '-cf', destination, '-C', path.dirname(sourceDir), path.basename(sourceDir)],
      { encoding: 'utf8' },
    );
    if (result.error || result.status !== 0) {
      throw new Error(`zip failed for ${item.id}: ${result.error?.message || result.stderr || result.stdout}`);
    }
  }
}

function js(value) {
  return JSON.stringify(value).replaceAll('</script>', '<\\/script>');
}

function buildHtml(items, elements, rules) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>审美复刻素材库</title>
<style>
:root{--bg:#f5f4ef;--paper:#fff;--ink:#151515;--muted:#6e6b64;--line:#d8d5cc;--good:#0f7b45;--bad:#b42318}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,"PingFang SC","Microsoft YaHei",sans-serif;letter-spacing:0}button,input,select{font:inherit}button{cursor:pointer}button:disabled{cursor:not-allowed;opacity:.45}a{color:inherit}
.top{position:sticky;top:0;z-index:10;padding:17px 24px;background:rgba(245,244,239,.95);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}.bar{max-width:1500px;margin:auto;display:grid;grid-template-columns:1fr minmax(260px,420px);gap:18px;align-items:end}h1{font-size:52px;line-height:.95;margin:0}.meta{font-size:13px;color:var(--muted);margin-top:8px}.search{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:8px;background:#fff}.filters{max-width:1500px;margin:14px auto 0;display:flex;gap:8px;overflow:auto}.filter{white-space:nowrap;border:1px solid var(--line);border-radius:8px;background:transparent;padding:8px 12px}.filter.on{background:var(--ink);color:#fff;border-color:var(--ink)}
main{max-width:1500px;margin:auto;padding:18px 24px 72px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.card{display:flex;flex-direction:column;overflow:hidden;background:#fff;border:1px solid var(--line);border-radius:8px}.preview{display:block;width:100%;aspect-ratio:16/10;padding:0;border:0;background:#ddd;overflow:hidden}.preview img{width:100%;height:100%;object-fit:cover;object-position:top}.body{display:flex;flex-direction:column;gap:11px;padding:15px;min-height:218px}.kicker{font-size:12px;color:var(--muted)}.name{font-size:23px;line-height:1.12;margin:0}.tags{display:flex;gap:6px;flex-wrap:wrap}.tag,.badge{font-size:11px;padding:5px 8px;border-radius:6px;background:var(--bg)}.actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:auto}.btn,.a{display:flex;align-items:center;justify-content:center;min-height:40px;padding:0 8px;border:1px solid var(--line);border-radius:7px;background:#fff;text-decoration:none;font-size:13px}.primary{background:var(--ink);color:#fff;border-color:var(--ink)}
.panel{padding:18px;border:1px solid var(--line);border-radius:8px;background:#fff}.two{display:grid;grid-template-columns:360px minmax(0,1fr);gap:16px}.field{display:grid;gap:7px;margin-bottom:13px}.field label{font-size:12px;color:var(--muted)}select{width:100%;padding:10px;border:1px solid var(--line);border-radius:7px;background:#fff}.result{white-space:pre-wrap;min-height:220px;padding:16px;border-radius:8px;background:#111;color:#f7f7f2;font-size:12px;line-height:1.6}.ok{border-color:#a7d7b8;background:#f1fff5;color:#12663c}.bad{border-color:#fecaca;background:#fff1f2;color:#991b1b}.element-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.element{padding:14px;border:1px solid var(--line);border-radius:8px;background:#fff}.element h3{margin:4px 0 8px;font-size:18px}.element p{color:var(--muted);font-size:13px;line-height:1.5}.badge{display:inline-flex;margin:0 5px 5px 0;border:1px solid var(--line)}
dialog{width:min(1120px,94vw);max-height:90vh;padding:0;border:1px solid var(--line);border-radius:8px}dialog::backdrop{background:rgba(0,0,0,.48)}.modal{display:grid;grid-template-columns:1.25fr .75fr}.modal-media{background:#111;overflow:auto}.modal-media img{display:block;width:100%}.modal-side{padding:20px;overflow:auto}.modal-side h2{font-size:34px;margin:4px 0 12px}.close{position:absolute;right:12px;top:12px;width:36px;height:36px;border:1px solid var(--line);border-radius:50%;background:#fff}.toast{position:fixed;right:22px;bottom:22px;padding:11px 15px;border-radius:7px;background:#111;color:#fff;opacity:0;transform:translateY(8px);transition:.2s;pointer-events:none}.toast.show{opacity:1;transform:none}
@media(max-width:1000px){.grid,.element-grid{grid-template-columns:repeat(2,1fr)}.two,.modal{grid-template-columns:1fr}}@media(max-width:680px){.top{padding:14px}.bar{grid-template-columns:1fr}h1{font-size:38px}main{padding:14px}.grid,.element-grid{grid-template-columns:1fr}.two{grid-template-columns:1fr}.actions{grid-template-columns:1fr 1fr}}
</style>
</head>
<body>
<header class="top"><div class="bar"><div><h1>审美复刻素材库</h1><div class="meta"><span id="count"></span></div></div><input id="search" class="search" placeholder="搜索名称、用途、风格、分类"></div><div id="filters" class="filters"></div></header>
<main id="app"></main>
<dialog id="previewDialog"><button class="close" aria-label="关闭">×</button><div id="modalContent"></div></dialog>
<div id="toast" class="toast"></div>
<script>
const DATA=${js(items)}, ELEMENTS=${js(elements)}, COMPAT=${js(rules)};
const app=document.querySelector('#app'),filters=document.querySelector('#filters'),count=document.querySelector('#count'),dialog=document.querySelector('#previewDialog'),toast=document.querySelector('#toast');
let mode='全部',query='';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categoryOrder=['商业网站','产品应用','个人网站','电商消费','投资金融','组织公益','工业制造','媒体娱乐','PPT模板'];
const available=[...new Set(DATA.map(x=>x.displayCategory).filter(Boolean))];
const categories=['全部',...categoryOrder.filter(x=>available.includes(x)),...available.filter(x=>!categoryOrder.includes(x)),'元素库','组装器'];
function showToast(message){toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1500)}
function renderFilters(){filters.innerHTML=categories.map(c=>'<button class="filter '+(c===mode?'on':'')+'" data-mode="'+esc(c)+'">'+esc(c)+'</button>').join('');filters.querySelectorAll('button').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;renderFilters();render()})}
function filtered(){const q=query.trim().toLowerCase();return DATA.filter(x=>(mode==='全部'||x.displayCategory===mode)&&(!q||JSON.stringify(x).toLowerCase().includes(q)))}
function promptFor(x){return '请完整读取素材包《'+x.name+'》，先看 AGENT_README.md、reproduction-prompt.md、截图、交互状态、CSS、字体、组件尺寸和本地素材清单，再实现视觉与交互复刻。素材包：'+x.zipPath}
function card(x){return '<article class="card"><button class="preview" data-preview="'+esc(x.id)+'"><img loading="lazy" src="'+encodeURI(x.previewPath)+'" alt="'+esc(x.name)+'"></button><div class="body"><div class="kicker">'+esc(x.displayCategory)+' / '+esc(x.displaySubcategory)+'</div><h2 class="name">'+esc(x.name)+'</h2><div class="tags">'+(x.styleTags||[]).slice(0,5).map(t=>'<span class="tag">'+esc(t)+'</span>').join('')+'</div><div class="actions"><button class="btn" data-preview="'+esc(x.id)+'">预览</button><a class="a primary" download href="'+encodeURI(x.zipPath)+'">下载 AI 素材包</a></div></div></article>'}
function renderTemplates(){const list=filtered();count.textContent=list.length+' / '+DATA.length+' 个模板';app.innerHTML=list.length?'<section class="grid">'+list.map(card).join('')+'</section>':'<div class="panel">没有匹配的模板</div>';app.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>openPreview(DATA.find(x=>x.id===b.dataset.preview)))}
function openPreview(x){document.querySelector('#modalContent').innerHTML='<div class="modal"><div class="modal-media"><img src="'+encodeURI(x.previewPath)+'" alt="'+esc(x.name)+'"></div><aside class="modal-side"><div class="kicker">'+esc(x.displayCategory)+' / '+esc(x.displaySubcategory)+'</div><h2>'+esc(x.name)+'</h2><div class="tags">'+(x.styleTags||[]).map(t=>'<span class="tag">'+esc(t)+'</span>').join('')+'</div><p>素材包包含 Agent 指令、截图、录屏、设计分析、结构说明、令牌、交互状态和本地素材清单。</p><div class="panel"><div class="kicker">兼容性纪律</div><p>'+esc(x.compatibilityProfile?.hardRule||'以主模板为准，禁止无约束混搭。')+'</p></div><div class="actions" style="margin-top:18px"><a class="a" target="_blank" href="'+encodeURI(x.sourceUrl||x.previewPath)+'">预览来源</a><a class="a primary" download href="'+encodeURI(x.zipPath)+'">下载 AI 素材包</a></div></aside></div>';dialog.showModal()}
document.querySelector('.close').onclick=()=>dialog.close();
function renderElements(){count.textContent=ELEMENTS.length+' 个元素';app.innerHTML='<section class="element-grid">'+ELEMENTS.map(e=>'<article class="element"><div class="kicker">'+esc(e.type)+'</div><h3>'+esc(e.name)+'</h3><p>'+esc(e.description)+'</p><div>'+(e.bestFor||[]).map(x=>'<span class="badge">'+esc(x)+'</span>').join('')+'</div></article>').join('')+'</section>'}
const rank={none:0,subtle:1,medium:2,heavy:3};
function checkElement(e,useCase,selected=[],primary=null){const r=COMPAT.useCaseRules[useCase],p=primary?.compatibilityProfile,reasons=[];if(!r)reasons.push('缺少用途规则');if(!e.bestFor.includes(useCase))reasons.push('不适合当前用途');if(r&&rank[e.motion]>rank[r.maxMotion])reasons.push('动效强度超过上限');if(r&&!e.mood.some(m=>r.allowedMoods.includes(m)))reasons.push('气质不在用途范围');if(p?.recommendedElements?.length&&!p.recommendedElements.includes(e.id))reasons.push('不在主模板许可元素中');if(p?.blockedElements?.includes(e.id))reasons.push('被主模板明确阻止');for(const s of selected){if(e.avoidWith.includes(s.id)||s.avoidWith.includes(e.id))reasons.push('与 '+s.name+' 冲突');for(const h of COMPAT.hardConflicts||[])if((h.a===e.id&&h.b===s.id)||(h.b===e.id&&h.a===s.id))reasons.push(h.reason)}return{ok:!reasons.length,reasons}}
function validateSelection(useCase,els,primary){const problems=[];for(const e of els){const c=checkElement(e,useCase,[],primary);if(!c.ok)problems.push(e.name+'：'+c.reasons.join('；'))}for(let i=0;i<els.length;i++)for(let j=i+1;j<els.length;j++){const own=checkElement(els[i],useCase,[],primary).reasons,pair=checkElement(els[i],useCase,[els[j]],primary).reasons.filter(x=>!own.includes(x));if(pair.length)problems.push(els[i].name+' × '+els[j].name+'：'+pair.join('；'))}return[...new Set(problems)]}
function validElements(type,useCase,selected=[],primary=null){return ELEMENTS.filter(e=>e.type===type&&checkElement(e,useCase,selected,primary).ok)}
function fillSelect(id,type,useCase,selected=[],primary=null){const sel=document.querySelector('#'+id),items=validElements(type,useCase,selected,primary);sel.innerHTML=items.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name)+'</option>').join('');return items[0]||null}
function selectedElements(){return['typography','layout','background','motion'].map(id=>ELEMENTS.find(e=>e.id===document.querySelector('#'+id)?.value)).filter(Boolean)}
function primaryTemplate(){return DATA.find(x=>x.id===document.querySelector('#primary')?.value)}
function populateElementChoices(){const useCase=document.querySelector('#useCase').value,primary=primaryTemplate(),selected=[];for(const [id,type] of [['typography','字体系统'],['layout','排版结构'],['background','视觉背景'],['motion','动效系统']]){const chosen=fillSelect(id,type,useCase,selected,primary);if(chosen)selected.push(chosen)}updateAssembler()}
function populateAssembler(){const useCase=document.querySelector('#useCase').value,templates=DATA.filter(x=>x.displayCategory===useCase),primary=document.querySelector('#primary');primary.innerHTML=templates.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');primary.onchange=populateElementChoices;populateElementChoices()}
function makeBrief(primary,useCase,els,problems){return '# 组合设计简报\\n\\n用途：'+useCase+'\\n主模板：'+(primary?.name||'')+'\\n\\n选中元素：\\n'+els.map(e=>'- '+e.type+'：'+e.name+' - '+e.description).join('\\n')+'\\n\\n硬约束：\\n- 主模板决定视觉骨架。\\n- 兼容元素只用于补强。\\n- 冲突组合禁止导出。\\n\\n冲突检查：'+(problems.length?problems.join('；'):'通过')}
function updateAssembler(){const useCase=document.querySelector('#useCase').value,els=selectedElements(),primary=primaryTemplate(),problems=validateSelection(useCase,els,primary),ok=Boolean(primary)&&els.length===4&&!problems.length,panel=document.querySelector('#compatPanel');panel.className='panel '+(ok?'ok':'bad');panel.innerHTML='<h2>'+(ok?'组合可用':'组合冲突')+'</h2><p>'+(ok?'当前组合通过主模板白名单、用途、动效与硬冲突检查。':problems.map(esc).join('<br>'))+'</p>';document.querySelector('#brief').textContent=makeBrief(primary,useCase,els,problems);document.querySelector('#downloadCustom').disabled=!ok;window.assemblerState={useCase,els,primary,problems,ok}}
function crc32(str){const bytes=new TextEncoder().encode(str);let c=~0;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1}return(~c)>>>0}function u16(n){return[n&255,n>>>8&255]}function u32(n){return[n&255,n>>>8&255,n>>>16&255,n>>>24&255]}
function makeZip(files){const chunks=[],central=[];let offset=0;for(const f of files){const name=new TextEncoder().encode(f.name),data=new TextEncoder().encode(f.content),crc=crc32(f.content),local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...name]);chunks.push(local,data);central.push({name,crc,size:data.length,offset});offset+=local.length+data.length}let size=0;for(const c of central){const h=new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(c.crc),...u32(c.size),...u32(c.size),...u16(c.name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(c.offset),...c.name]);chunks.push(h);size+=h.length}chunks.push(new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(central.length),...u16(central.length),...u32(size),...u32(offset),...u16(0)]));return new Blob(chunks,{type:'application/zip'})}
function downloadCustomPack(){const s=window.assemblerState;if(!s?.ok){updateAssembler();return}const brief=makeBrief(s.primary,s.useCase,s.els,s.problems),payload={useCase:s.useCase,primaryTemplate:s.primary,compatibleElements:s.els,compatibilityCheck:{passed:true,problems:[]},compatibilityRules:COMPAT},root='custom-design-reference-pack/';const prompt='先读取 selected-elements.json、combined-design-brief.md 和 compatibility-rules.json。以 primaryTemplate 为主，只使用通过检查的 compatibleElements。';const blob=makeZip([{name:root+'AGENT_README.md',content:prompt},{name:root+'selected-elements.json',content:JSON.stringify(payload,null,2)},{name:root+'combined-design-brief.md',content:brief},{name:root+'compatibility-rules.json',content:JSON.stringify(COMPAT,null,2)},{name:root+'reproduction-prompt.md',content:prompt+'\\n\\n'+brief}]),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='custom-design-reference-pack.zip';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);showToast('组合素材包已生成')}
function renderAssembler(){count.textContent='组装器';const cases=Object.keys(COMPAT.useCaseRules).filter(x=>DATA.some(i=>i.displayCategory===x));app.innerHTML='<section class="two"><aside class="panel"><h2>组装新模板</h2><div class="field"><label>用途</label><select id="useCase">'+cases.map(x=>'<option>'+esc(x)+'</option>').join('')+'</select></div><div class="field"><label>主模板</label><select id="primary"></select></div><div class="field"><label>字体系统</label><select id="typography"></select></div><div class="field"><label>排版结构</label><select id="layout"></select></div><div class="field"><label>视觉背景</label><select id="background"></select></div><div class="field"><label>动效系统</label><select id="motion"></select></div><button class="btn primary" id="downloadCustom">生成组合素材包 ZIP</button></aside><section><div id="compatPanel" class="panel"></div><div id="brief" class="result" style="margin-top:16px"></div></section></section>';document.querySelector('#useCase').onchange=populateAssembler;for(const id of['primary','typography','layout','background','motion'])document.querySelector('#'+id).onchange=updateAssembler;document.querySelector('#downloadCustom').onclick=downloadCustomPack;populateAssembler()}
function render(){if(mode==='元素库')return renderElements();if(mode==='组装器')return renderAssembler();renderTemplates()}
document.querySelector('#search').oninput=e=>{query=e.target.value;render()};renderFilters();render();
</script>
</body>
</html>`;
}

async function main() {
  const items = await readJson(INDEX_PATH);
  const elements = await readJson(ELEMENTS_PATH);
  const rules = await readJson(RULES_PATH);
  for (const element of missingElements) {
    if (!elements.some((item) => item.id === element.id)) {
      elements.push(element);
    }
  }
  normalizeCompatibility(items, elements, rules);
  await updateEvidenceEntrypoints(items);
  await writeJson(INDEX_PATH, items);
  await writeJson(RULES_PATH, rules);
  await writeJson(ELEMENTS_PATH, elements);
  await updatePackRules(items, rules.hardConflicts || []);
  await rebuildZips(items);
  await fs.writeFile(path.join(ROOT, 'index.html'), buildHtml(items, elements, rules));
  console.log(JSON.stringify({ items: items.length, elements: elements.length, zips: items.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
