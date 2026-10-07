import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cache=new Map();
export function loadTypeScript(relative){
  const file=path.isAbsolute(relative)?relative:path.join(app,relative);
  if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}};cache.set(file,module);
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
  function localRequire(specifier){
    if(!specifier.startsWith('@/')&&!specifier.startsWith('.'))return require(specifier);
    const resolved=specifier.startsWith('@/')?path.join(app,specifier.slice(2)):path.resolve(path.dirname(file),specifier);
    if(resolved.endsWith('.json'))return JSON.parse(fs.readFileSync(resolved,'utf8'));
    return loadTypeScript(resolved.endsWith('.ts')?resolved:resolved+'.ts');
  }
  new Function('require','module','exports',source)(localRequire,module,module.exports);
  return module.exports;
}
