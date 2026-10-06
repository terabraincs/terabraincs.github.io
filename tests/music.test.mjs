import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const catalog=JSON.parse(fs.readFileSync(new URL('../data/music-tracks.json',import.meta.url),'utf8'));

test('all converted tracks are present once and use the unified Raw audio repository',()=>{
  assert.equal(catalog.tracks.length,278);
  assert.equal(catalog.tracks.filter(track=>track.isRegistered).length,166);
  assert.equal(catalog.tracks.filter(track=>!track.isRegistered).length,112);
  assert.equal(new Set(catalog.tracks.map(track=>track.id)).size,278);
  assert.equal(new Set(catalog.tracks.map(track=>track.audioPath.toLowerCase())).size,278);
  for(const track of catalog.tracks){
    const url=new URL(track.audioPath);
    assert.equal(url.origin,'https://raw.githubusercontent.com');
    assert.ok(url.pathname.startsWith('/terabraincs/CS_Music/main/audio/'));
    assert.match(path.posix.basename(url.pathname),/^[A-Za-z0-9_]+\.ogg$/);
    assert.equal(track.isLocked,false);
    assert.ok(Number.isFinite(track.duration)&&track.duration>0);
    assert.ok(Math.abs(track.duration*48000-Math.round(track.duration*48000))<0.00001);
    assert.ok(fs.existsSync(new URL('../public'+track.coverPath,import.meta.url)));
  }
});

test('Pages jukebox loader depends on checked-in metadata instead of local audio',()=>{
  const loader=fs.readFileSync(new URL('../lib/music.ts',import.meta.url),'utf8');
  assert.ok(loader.includes('@/data/music-tracks.json'));
  assert.ok(!/node:fs|COUNTERSIDE_BGM_DIR|\.wav|sound\/music/.test(loader));
});
