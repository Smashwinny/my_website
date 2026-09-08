import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const manifest=JSON.parse(await readFile('dist/client/.vite/manifest.json','utf8'));
const keys=new Set();
function visit(key){if(keys.has(key))return;keys.add(key);for(const imported of manifest[key]?.imports??[])visit(imported)}
visit('virtual:vinext-app-browser-entry');visit('app/page.tsx');
const files=[...keys].map(key=>manifest[key].file);
assert(!files.some(file=>/characters|mist-world|mario-world|element-world|monument-world|\/world-/.test(file)),'world code must stay lazy');
const rows=await Promise.all(files.map(async file=>{const bytes=await readFile('dist/client/'+file);return{file,bytes:bytes.length,gzipBytes:gzipSync(bytes).length}}));
const gzipBytes=rows.reduce((sum,row)=>sum+row.gzipBytes,0);
assert(gzipBytes<180000,'startup JavaScript budget is 180 KB gzip, excluding HTML/CSS');
await writeFile('docs/performance/startup-budget.json',JSON.stringify({scope:'Static client dependency graph; excludes lazy worlds, HTML, CSS and network timing.',gzipBytes,files:rows},null,2)+'\n');
console.log('PASS: initial JS has no 3D world / character code;',gzipBytes,'bytes gzip');
