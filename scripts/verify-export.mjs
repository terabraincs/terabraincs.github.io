import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const base=process.env.NEXT_PUBLIC_BASE_PATH??'';const main=JSON.parse(fs.readFileSync('package.json','utf8')).name==='countersideviewer-main';
const all=[];function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else all.push(p);}}walk('out');
const bytes=all.reduce((n,p)=>n+fs.statSync(p).size,0);assert.ok(bytes<1_000_000_000,'GitHub Pages output exceeds 1 GB');
for(const feature of ['characters','story','spine-viewer'])assert.ok(!fs.existsSync('out/'+feature+'/index.html'),'Excluded feature exported: '+feature);
for(const route of ['','music','equipment','ships','operators','collection','collection/titles','collection/frames','collection/emblems','collection/trophies','minigames','minigames/match-ten','minigames/cafe-strega','minigames/sword-training'])assert.ok(fs.existsSync('out/'+route+'/index.html'),'Missing route '+route);
const missing=new Set();let urls=0;
const imageCatalog=JSON.parse(fs.readFileSync('data/main-image-assets.json','utf8'));
const imagePaths=new Set(imageCatalog.paths);
const minigameCatalog=JSON.parse(fs.readFileSync('data/minigame-assets.json','utf8'));
const mediaPaths=new Set(minigameCatalog.paths);
const operatorCatalog=JSON.parse(fs.readFileSync('data/operator-voice-assets.json','utf8'));
const operatorPaths=new Set(operatorCatalog.paths);
let externalImages=0,externalOperatorVoices=0;
function check(url){
  if(url.startsWith(imageCatalog.baseUrl+'/')){const rel=decodeURI(new URL(url).pathname.split('/').slice(4).join('/'));assert.ok(imagePaths.has('/'+rel)||mediaPaths.has('/'+rel),'Missing Asset_main media '+url);externalImages++;return;}
  if(url.startsWith(operatorCatalog.baseUrl+'/operator_voice/')){const rel=decodeURI(new URL(url).pathname.split('/').slice(4).join('/'));assert.ok(operatorPaths.has(rel),'Missing CS_Voice operator audio '+url);externalOperatorVoices++;return;}
  if(!url.startsWith(base+'/'))return;const rel=decodeURIComponent(url.slice(base.length+1).split(/[?#]/)[0]);if(!rel||!path.extname(rel)||rel.endsWith('.html'))return;urls++;if(!fs.existsSync(path.join('out',rel)))missing.add(url);
}
for(const file of all.filter(f=>f.endsWith('.html'))){const text=fs.readFileSync(file,'utf8');for(const m of text.matchAll(/(?:src|href)="([^"]+)"/g))check(m[1].replaceAll('&amp;','&'));for(const m of text.replaceAll('&quot;','"').matchAll(/url\((?:["']?)([^)'"\s]+)/g))check(m[1]);}
for(const file of all.filter(f=>f.endsWith('.css'))){const text=fs.readFileSync(file,'utf8');for(const m of text.matchAll(/url\((?:["']?)([^)'"\s]+)/g))check(m[1]);}
for(const file of all.filter(f=>f.endsWith('.json')&&f.includes('game-assets'))){const parsed=JSON.parse(fs.readFileSync(file,'utf8'));function visit(v){if(typeof v==='string')check(v);else if(v&&typeof v==='object')for(const c of Object.values(v))visit(c);}visit(parsed);}
assert.deepEqual([...missing],[],'Missing exported asset references');
if(main){
  const home=fs.readFileSync('out/index.html','utf8');
  for(const label of ['사원','장비','함선','오퍼레이터','수집 요소','스토리 뷰어','주크박스','Spine 뷰어','미니게임','공식 홈페이지 백업','라운지 백업'])assert.ok(home.includes(label),'Missing hub button: '+label);
  for(const route of ['characters','equipment','ships','operators','collection','story','music','spine-viewer','minigames'])assert.ok(home.includes('href="/'+route),'Missing hub destination: '+route);
  assert.ok(home.includes('https://counterside.kro.kr/website/'),'Website backup link');
  const minigames=fs.readFileSync('out/minigames/index.html','utf8');
  for(const route of ['cafe-strega','match-ten','sword-training'])assert.ok(minigames.includes('href="/minigames/'+route),'Missing integrated game link');
  const fonts=all.filter(file=>file.endsWith('.ttf')&&fs.statSync(file).size>0);assert.equal(fonts.length,2,'Duplicate font copies remain');
  const operator=all.find(p=>p.split(path.sep).length===4&&p.split(path.sep)[1]==='operators'&&p.endsWith('index.html'));
  assert.ok(fs.readFileSync(operator,'utf8').includes('https://raw.githubusercontent.com/terabraincs/CS_Voice/main/operator_voice/'),'External operator audio is absent');
  assert.ok(!all.some(file=>/\.(?:png|webp|jpe?g|gif|svg|ico|avif|ogg|wav)$/i.test(file)),'Migrated images/audio remain in Pages output');
  assert.ok(externalImages>0&&externalOperatorVoices>0,'External asset references are absent');
  const ship=fs.readFileSync('out/ships/NKM_SHIP_A_COFFIN/index.html','utf8');
  assert.ok(ship.includes('현재 함선 능력치 조건')&&ship.includes('조건 설정'),'Latest ship stats controls are absent');
}
console.log(JSON.stringify({files:all.length,bytes,MiB:+(bytes/1048576).toFixed(2),checkedAssetURLs:urls,externalImageReferences:externalImages,externalOperatorVoiceReferences:externalOperatorVoices,missingAssets:missing.size,scopeVerified:true}));

if(main){
  const catalog=JSON.parse(fs.readFileSync('data/music-tracks.json','utf8'));
  const music=fs.readFileSync('out/music/index.html','utf8');
  assert.ok(!fs.existsSync('out/assets/sound/music'),'Jukebox audio must live in the audio repositories');
  assert.ok(!all.some(file=>/out[\\/]music[\\/].*\.(ogg|wav)$/i.test(file)));
  for(const track of catalog.tracks){
    assert.ok(music.includes(track.audioPath),'Missing deployed track '+track.id);
    assert.ok(imagePaths.has(track.coverPath),'Missing external album cover');
  }
  console.log(JSON.stringify({jukeboxTracks:catalog.tracks.length,externalAudio:true}));
}
