import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm';
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
globalThis.ProgressEvent=class{constructor(type,init){this.type=type;Object.assign(this,init)}};
const rows=[];
for(const name of ['traveler-male','traveler'])for(const profile of ['mobile','web','lite']){
 const compressed=await readFile(`public/models/${name}-${profile}.vrm.bin`),samples=[];
 for(let i=0;i<6;i++){
  const start=performance.now(),data=gunzipSync(compressed),inflate=performance.now()-start;
  const loader=new GLTFLoader();loader.register(p=>new VRMLoaderPlugin(p));
  const parsed=await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  const vrm=parsed.userData.vrm;VRMUtils.removeUnnecessaryVertices(vrm.scene);VRMUtils.combineSkeletons(vrm.scene);
  if(i>0)samples.push({inflate,total:performance.now()-start});
  VRMUtils.deepDispose(vrm.scene);
 }
 const median=key=>samples.map(v=>v[key]).sort((a,b)=>a-b)[2];
 rows.push({name,profile,transferredBytes:compressed.length,gzipMedianMs:median('inflate'),parseAndOptimizeMedianMs:median('total')});
}
const result={scope:'Node CPU gzip + actual GLTF/VRM parse and skeleton optimization; image decode stubbed at 1px. NOT browser, network, shader compilation, GPU upload, FPS or perceived-load timing.',node:process.version,runs:5,rows};
await mkdir('docs/performance',{recursive:true});await writeFile('docs/performance/avatar-cpu-benchmark.json',JSON.stringify(result,null,2)+'\n');
console.table(rows);
