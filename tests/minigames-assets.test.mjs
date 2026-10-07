import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadTypeScript} from './load-typescript.mjs';
const catalog=JSON.parse(fs.readFileSync('data/minigame-assets.json','utf8'));
const {deploymentUrl,deploymentData}=loadTypeScript('lib/deployment.ts');
const {minigameAssetUrl}=loadTypeScript('lib/minigameAssets.ts');
test('all minigame images and sounds resolve to Asset_main, preserving routes and data URLs',()=>{
  assert.equal(catalog.paths.length,1618);
  for(const file of catalog.paths){const expected=catalog.baseUrl+file.split('/').map(encodeURIComponent).join('/');assert.equal(deploymentUrl(file),expected);assert.equal(deploymentUrl(expected),expected);if(file.startsWith('/game-assets/'))assert.equal(minigameAssetUrl(file.replace('/game-assets/','/minigames/')),expected);}
  for(const value of ['/minigames/','/minigames/cafe-strega/','data:image/png;base64,AAAA','https://example.com/image.png'])assert.equal(minigameAssetUrl(value),value);
});
test('all 16 font references share byte-identical preserved original fonts',()=>{
  assert.equal(Object.keys(catalog.fontAliases).length,16);
  assert.equal(new Set(Object.values(catalog.fontAliases)).size,2);
  const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const sourceHashes={'MainFont.ttf':'63c3682228cd7f90334ec38988ef2acfdb6cfd6aee69aee9dc1795a928144fa7','Rajdhani-SemiBold.ttf':'94bbd25a18ca665999feb05a537de9fd2b860dcfb78bbe9ca00270825bf235da'};
  for(const [original,shared] of Object.entries(catalog.fontAliases)){assert.equal(deploymentUrl(original),shared);assert.equal(hash(path.join('public',shared)),sourceHashes[path.basename(shared)]);}
});
test('external URL rewriting preserves original gameplay, font identity, and rendering values',()=>{
  const paths=['game-assets/cafe-strega/client-source-v2/client-data.json','game-assets/sword-training/client-source/client-data.json','game-assets/sword-training/client-source/slash-fx.json'];
  let checked=0;
  function verify(before,after){if(typeof before==='string'){const expected=deploymentUrl(before);assert.equal(after,expected);if(expected!==before)checked++;}else if(Array.isArray(before)){assert.equal(after.length,before.length);before.forEach((value,i)=>verify(value,after[i]));}else if(before&&typeof before==='object'){assert.deepEqual(Object.keys(after),Object.keys(before));for(const key of Object.keys(before))verify(before[key],after[key]);}else assert.equal(after,before);}
  for(const rel of paths){const file=path.join('public',rel);if(!fs.existsSync(file))continue;const before=JSON.parse(fs.readFileSync(file,'utf8'));const after=deploymentData(before);verify(before,after);assert.deepEqual(deploymentData(after),after);}
  assert.ok(checked>0);
});
