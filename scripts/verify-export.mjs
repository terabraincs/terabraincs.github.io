import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.env.NEXT_PUBLIC_BASE_PATH??'/CounterSideViewer_Main';const main=JSON.parse(fs.readFileSync('package.json','utf8')).name==='countersideviewer-main';
const all=[];function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else all.push(p);}}walk('out');
const bytes=all.reduce((n,p)=>n+fs.statSync(p).size,0);assert.ok(bytes<1_000_000_000,'GitHub Pages output exceeds 1 GB');
for(const feature of ['characters','story','music','spine-viewer'])assert.ok(!fs.existsSync('out/'+feature+'/index.html'),'Excluded feature exported: '+feature);
for(const route of main?['','equipment','ships','operators','collection','collection/titles','collection/frames','collection/emblems','collection/trophies']:['','minigames','minigames/match-ten','minigames/cafe-strega','minigames/sword-training'])assert.ok(fs.existsSync('out/'+route+'/index.html'),'Missing route '+route);
const missing=new Set();let urls=0;
function check(url){if(!url.startsWith(base+'/'))return;const rel=decodeURIComponent(url.slice(base.length+1).split(/[?#]/)[0]);if(!rel||!path.extname(rel)||rel.endsWith('.html'))return;urls++;if(!fs.existsSync(path.join('out',rel)))missing.add(url);}
for(const file of all.filter(f=>f.endsWith('.html'))){const text=fs.readFileSync(file,'utf8');for(const m of text.matchAll(/(?:src|href)="([^"]+)"/g))check(m[1].replaceAll('&amp;','&'));}
if(!main){for(const file of all.filter(f=>f.endsWith('.json')&&f.includes('minigames'))){const parsed=JSON.parse(fs.readFileSync(file,'utf8'));function visit(v){if(typeof v==='string')check(v);else if(v&&typeof v==='object')for(const c of Object.values(v))visit(c);}visit(parsed);}}
assert.deepEqual([...missing],[],'Missing exported asset references');
if(main){const home=fs.readFileSync('out/index.html','utf8');for(const label of ['사원 정보','장비 정보','함선 정보','오퍼레이터 정보','수집 요소','스토리 연대기','주크박스','Spine 뷰어','미니게임'])assert.ok(home.includes(label),'Missing hub button: '+label);assert.ok(home.includes('/CounterSideViewer_Minigames/minigames'),'Missing sibling link');const operator=all.find(p=>p.split(path.sep).length===4&&p.split(path.sep)[1]==='operators'&&p.endsWith('index.html'));assert.ok(fs.readFileSync(operator,'utf8').includes('/assets/sound/voice/operator_voice/'),'Operator audio is absent');}
console.log(JSON.stringify({files:all.length,bytes,MiB:+(bytes/1048576).toFixed(2),checkedAssetURLs:urls,missingAssets:missing.size,scopeVerified:true}));
