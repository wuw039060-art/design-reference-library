import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('output/审美素材库');
const expected=['americanhousing','anatoly-design','apple','augen','beacon','belen-jones','busy-bee-honey','corentin-bernadou','danilo-sierra','daylight','defiant-vc','digital-trust-alliance','elle-and-riley','everyday','flex-n-gate','greenlock','happyrobot','human-interest-nz','iam-arnob','liftoff-network','marianna-von-fedak','microsoft-ai','mobbin','netflix','onlook','openhome','ova-investment','robot-com','spacex-roadshow-ppt','typeless','valar','y-combinator'];
const docs=['README.md','manifest.json','design-analysis.md','page-structure.md','interaction-map.md','design-tokens.json','assets-inventory.json','reproduction-prompt.md'];
const captures=['captures/screenshots/desktop-viewport.png','captures/screenshots/desktop-full.png','captures/screenshots/mobile-viewport.png','captures/screenshots/mobile-full.png','captures/recordings/desktop-scroll.webm','captures/desktop-metadata.json','captures/mobile-metadata.json'];
const issues=[];const index=JSON.parse(await fs.readFile(path.join(root,'library-index.json'),'utf8'));
const ids=index.map(x=>x.id).sort();if(JSON.stringify(ids)!==JSON.stringify(expected))issues.push(`索引 ID 不匹配：${ids.length}/${expected.length}`);
async function exists(file,min=1){try{return (await fs.stat(file)).size>=min}catch{return false}}
async function pngSize(file){const b=await fs.readFile(file);if(b.toString('ascii',1,4)!=='PNG')throw new Error('not png');return {w:b.readUInt32BE(16),h:b.readUInt32BE(20)};}
for(const item of index){
 const pack=path.join(root,...item.packPath.split('/'));
 try{if(!(await fs.stat(pack)).isDirectory())issues.push(`${item.id}: pack missing`)}catch{issues.push(`${item.id}: pack missing`)}
 if(item.type==='website'){
  for(const f of [...docs,...captures])if(!(await exists(path.join(pack,...f.split('/')),f.endsWith('.webm')?50000:100)))issues.push(`${item.id}: missing/small ${f}`);
  for(const f of captures.filter(x=>x.endsWith('.json')))try{JSON.parse(await fs.readFile(path.join(pack,...f.split('/')),'utf8'))}catch{issues.push(`${item.id}: invalid ${f}`)}
  for(const [f,minW,maxW,minH] of [['desktop-viewport.png',1400,1440,850],['desktop-full.png',1400,1440,850],['mobile-viewport.png',380,390,800],['mobile-full.png',380,390,800]])try{const d=await pngSize(path.join(pack,'captures','screenshots',f));if(d.w<minW||d.w>maxW||d.h<minH)issues.push(`${item.id}: unexpected ${f} ${d.w}x${d.h}`)}catch{issues.push(`${item.id}: invalid ${f}`)}
 }else{
  for(const f of ['README.md','manifest.json','design-analysis.md','design-tokens.json','slide-map.md','reproduction-prompt.md','source/SpaceX IPO Roadshow 路演PPT.pdf','source/contact-sheet-1.jpg','source/contact-sheet-2.jpg','source/contact-sheet-3.jpg','source/contact-sheet-4.jpg'])if(!(await exists(path.join(pack,...f.split('/')),100)))issues.push(`${item.id}: missing ${f}`);
 }
 const zip=path.join(root,...item.zipPath.split('/'));if(!(await exists(zip,1000)))issues.push(`${item.id}: zip missing/small`);
}
if(!(await exists(path.join(root,'index.html'),1000)))issues.push('index.html missing');
const result={expectedCases:expected.length,indexCases:index.length,websites:index.filter(x=>x.type==='website').length,presentations:index.filter(x=>x.type==='presentation').length,issues};
await fs.writeFile(path.join(root,'audit-report.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(issues.length)process.exitCode=1;
