import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {loadTypeScript} from './load-typescript.mjs';
const imageCatalog=JSON.parse(fs.readFileSync(new URL('../data/main-image-assets.json',import.meta.url),'utf8'));
const operatorCatalog=JSON.parse(fs.readFileSync(new URL('../data/operator-voice-assets.json',import.meta.url),'utf8'));
const {deploymentUrl,deploymentData}=loadTypeScript('lib/deployment.ts');
const {publicFileExists}=loadTypeScript('lib/publicAssets.ts');
const {createVoiceAudioPath}=loadTypeScript('lib/voice.ts');

test('migrated images resolve to Raw even when no image is present in the Pages repository',()=>{
  assert.equal(imageCatalog.paths.length,3723);
  for(const asset of imageCatalog.paths){
    const expected=imageCatalog.baseUrl+asset.split('/').map(encodeURIComponent).join('/');
    assert.equal(deploymentUrl(asset),expected,asset);
    assert.equal(deploymentUrl(expected),expected);
    if(asset!=='/favicon.ico')assert.ok(publicFileExists(path.join(process.cwd(),'public',asset)));
  }
  assert.ok(!publicFileExists(path.join(process.cwd(),'public/unit/MISSING_IMAGE.png')));
  const input={image:'/counterside_logo.webp',href:'/equipment/ITEM',offset:[-2,4]};
  const output=deploymentData(input);
  assert.equal(output.image,imageCatalog.baseUrl+'/counterside_logo.webp');
  assert.equal(output.href,input.href);
  assert.deepEqual(output.offset,input.offset);
});

test('all operator voices use CS_Voice while absent or unsafe recordings stay unavailable',()=>{
  assert.equal(operatorCatalog.paths.length,2084);
  for(const asset of operatorCatalog.paths){
    const [,bundle,file]=asset.split('/');
    const language=bundle.endsWith('.vjpn')?'ja':'ko';
    assert.equal(createVoiceAudioPath('operator',bundle,file.slice(0,-4),language),operatorCatalog.baseUrl+'/'+asset);
  }
  assert.equal(createVoiceAudioPath('operator','ab_ui_unit_voice_opr_lee_suyeon','__MISSING_VOICE__'),'');
  assert.equal(createVoiceAudioPath('operator','../ab_ui_unit_voice_opr_lee_suyeon','VOICE'),'');
  assert.equal(createVoiceAudioPath('unit','ab_ui_unit_voice_opr_lee_suyeon','VOICE'),'');
});
