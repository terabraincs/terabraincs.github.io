import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTypeScript} from './load-typescript.mjs';
const {BASE_PATH,MAIN_BASE_PATH,MINIGAMES_BASE_PATH,deploymentUrl,deploymentData,siteLink}=loadTypeScript('lib/deployment.ts');
test('asset paths remain local and idempotent',()=>{
  const url=deploymentUrl('/game-assets/cafe-strega/image.png');
  assert.equal(url,BASE_PATH+'/game-assets/cafe-strega/image.png');
  assert.equal(deploymentUrl(url),url);
  assert.equal(deploymentUrl('https://example.com/icon.png'),'https://example.com/icon.png');
});
test('JSON URLs are rebased without changing gameplay values',()=>{
  const data={texture:'/game-assets/game/image.png',position:[12,-3],name:'/Root/Panel',children:[{audio:'/assets/sound/clip.ogg'}]};
  const mapped=deploymentData(data);
  assert.equal(mapped.texture,BASE_PATH+data.texture);
  assert.equal(mapped.name,data.name);
  assert.deepEqual(mapped.position,data.position);
  assert.equal(mapped.children[0].audio,BASE_PATH+'/assets/sound/clip.ogg');
  assert.deepEqual(deploymentData(mapped),mapped);
});
test('minigames navigation stays inside the integrated Main site',()=>{
  assert.deepEqual(siteLink('/minigames/'),{href:'/minigames/',external:false});
  assert.deepEqual(siteLink('/minigames/cafe-strega/'),{href:'/minigames/cafe-strega/',external:false});
  assert.deepEqual(siteLink('/'),{href:'/',external:false});
  assert.deepEqual(siteLink(deploymentUrl('/equipment/ITEM')),{href:'/equipment/ITEM',external:false});
});
test('unpublished feature buttons retain their destinations',()=>{
  for(const route of ['/characters','/story','/spine-viewer'])assert.deepEqual(siteLink(route),{href:route,external:false});
});
test('Main preview assets do not overlap the minigames project route',()=>{
  const url=deploymentUrl('/game-assets/match-ten/images/preview.png');
  assert.equal(url,BASE_PATH+'/game-assets/match-ten/images/preview.png');
  assert.ok(!url.startsWith('/minigames/'));
});

test('jukebox is an owned Main route',()=>{assert.deepEqual(siteLink('/music/'),{href:'/music/',external:false});});
