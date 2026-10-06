// Generate deployment metadata from converted Ogg files and the client tables.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const ts=require('typescript');
const args=process.argv.slice(2);
function argument(name){const index=args.indexOf(name);return index<0?undefined:args[index+1];}
const audioDirectory=argument('--audio-dir');
assert.ok(audioDirectory,'Provide --audio-dir with the converted Ogg directory');
const repositoryDirectory=argument('--repositories-dir');
const musicRepositoryDirectory=argument('--repository-dir')??(repositoryDirectory?path.join(path.resolve(repositoryDirectory),'CS_Music'):undefined);
const musicBaseUrl='https://raw.githubusercontent.com/terabraincs/CS_Music/main/audio';
process.chdir(app);
process.env.COUNTERSIDE_BGM_DIR=path.resolve(audioDirectory);
process.env.COUNTERSIDE_ASSET_ROOT=path.join(app,'.tmp/no-source-asset-fallback');
delete process.env.NEXT_PUBLIC_BGM_BASE_URL;
delete process.env.NEXT_PUBLIC_ASSET_BASE_URL;
const cache=new Map();
const guardedFs=new Proxy(fs,{get(target,key){
  const original=Reflect.get(target,key);
  if(!['existsSync','statSync','openSync','readFileSync'].includes(key))return original;
  return (...values)=>{assert.ok(!(typeof values[0]==='string'&&/\.wav$/i.test(values[0])),'Source WAV access');return original(...values);};
}});
function load(file){
  if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}};cache.set(file,module);
  const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
  const localRequire=specifier=>specifier==='node:fs'?guardedFs:specifier.startsWith('@/')?load(path.join(app,specifier.slice(2)+'.ts')):specifier.startsWith('.')?load(path.resolve(path.dirname(file),specifier+'.ts')):require(specifier);
  new Function('require','module','exports',output)(localRequire,module,module.exports);
  return module.exports;
}
const source=load(path.join(app,'scripts/music-source.ts'));
const groups={registered:[],unregistered:[]};
const tracks=source.loadMusicTracks().map(track=>{
  assert.ok(!track.isLocked&&track.duration>0,`Missing playable Ogg: ${track.id}`);
  const filename=decodeURIComponent(path.posix.basename(track.audioPath));
  assert.match(filename,/^[A-Za-z0-9_]+\.ogg$/);
  const sourceFile=source.getMusicFilePath(filename);
  assert.ok(sourceFile);
  const bytes=fs.readFileSync(sourceFile);
  const group=track.isRegistered?'registered':'unregistered';
  groups[group].push({name:filename,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),duration:track.duration,isRegistered:track.isRegistered});
  if(musicRepositoryDirectory){
    const target=path.join(path.resolve(musicRepositoryDirectory),'audio',filename);
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(sourceFile,target);
  }
  return {...track,audioPath:`${musicBaseUrl}/${encodeURIComponent(filename)}`};
});
const allFiles=Object.values(groups).flat();
assert.equal(new Set(allFiles.map(file=>file.name.toLowerCase())).size,tracks.length,'Overlapping audio groups');
assert.equal(tracks.length,fs.readdirSync(process.env.COUNTERSIDE_BGM_DIR).filter(file=>/\.ogg$/i.test(file)).length,'Unassigned converted audio');
fs.mkdirSync(path.join(app,'data'),{recursive:true});
fs.writeFileSync(path.join(app,'data/music-tracks.json'),JSON.stringify({format:1,durationSource:'Ogg Opus final granule minus pre-skip at 48000 Hz',tracks},null,2)+'\n','utf8');
const repository='terabraincs/CS_Music';
const bytes=allFiles.reduce((total,file)=>total+file.bytes,0);
assert.ok(allFiles.every(file=>file.bytes<100*1024*1024),'Regular Git file exceeds 100 MiB');
if(musicRepositoryDirectory)fs.writeFileSync(path.join(path.resolve(musicRepositoryDirectory),'catalog.json'),JSON.stringify({format:2,repository,audioBaseUrl:musicBaseUrl,bytes,files:allFiles},null,2)+'\n','utf8');
console.log(JSON.stringify({repository,tracks:allFiles.length,registered:groups.registered.length,unregistered:groups.unregistered.length,bytes,pages:false}));
