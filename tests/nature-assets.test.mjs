import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
test('optimized scenery preserves geometry and all referenced textures exist',async()=>{
 const report=JSON.parse(await readFile('docs/performance/texture-report.json','utf8'));
 assert(report.totals.transfer_reduction_percent>80);
 for(const file of await readdir('public/models/nature-web'))if(file.endsWith('.gltf')){
  const old=JSON.parse(await readFile('public/models/nature/'+file,'utf8'));
  const current=JSON.parse(await readFile('public/models/nature-web/'+file,'utf8'));
  for(const key of ['meshes','accessors','nodes','materials'])assert.deepEqual(current[key],old[key]);
  for(const image of current.images)assert((await readFile('public/models/nature-web/'+image.uri)).length>0);
  for(const buffer of current.buffers){const bytes=await readFile('public/models/nature-web/'+buffer.uri);assert.equal(createHash('sha256').update(bytes).digest('hex'),report.unchanged_binaries[buffer.uri].sha256)}
 }
});
