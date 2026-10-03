import fs from 'node:fs';
import path from 'node:path';
const base=process.env.NEXT_PUBLIC_BASE_PATH??'/CounterSideViewer_Main';
const pattern=/^\/(?:minigames|equipment|operators?|ships?|collection|unit|ui|story|music|spine|assets)(?:\/|$)/;
const prefix=v=>typeof v==='string'&&pattern.test(v)&&base&&!v.startsWith(base+'/')?base+v:v;
function rebase(v){if(typeof v==='string')return prefix(v);if(Array.isArray(v))return v.map(rebase);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,v])=>[k,rebase(v)]));return v;}
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.json')&&!p.includes(path.sep+'_next'+path.sep)){fs.writeFileSync(p,JSON.stringify(rebase(JSON.parse(fs.readFileSync(p,'utf8')))),'utf8');}else if(e.name.endsWith('.css')){const text=fs.readFileSync(p,'utf8');fs.writeFileSync(p,text.replace(/url\((['"]?)(\/[^)'"\s]+)\1\)/g,(_,quote,url)=>'url('+quote+prefix(url)+quote+')'),'utf8');}}}
walk('out');fs.writeFileSync('out/.nojekyll','');console.log('Prepared static assets for '+base);
