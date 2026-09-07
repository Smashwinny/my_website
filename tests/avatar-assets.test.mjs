import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm';
// Decode and animate the actual shipped bytes. Image bitmap is stubbed, not visual QA.
globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});
globalThis.ProgressEvent=class{constructor(type,init){this.type=type;Object.assign(this,init)}};
for(const name of ['traveler','traveler-male'])for(const profile of ['mobile','web','lite'])test(`${name}/${profile}: compressed avatar preserves rig, metadata and animation`,async()=>{
 const compressed=await readFile(`public/models/${name}-${profile}.vrm.bin`),bytes=gunzipSync(compressed),fallback=await readFile(`public/models/${name}-${profile}.vrm`),original=await readFile(`public/models/${name}.vrm`);
 assert.deepEqual(bytes,fallback);assert(compressed.length<original.length*.25);
 const json=b=>JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());const optimized=json(bytes),source=json(original);
 assert.deepEqual(optimized.extensions,source.extensions);assert.deepEqual(optimized.nodes,source.nodes);assert.deepEqual(optimized.skins,source.skins);
 const triangles=d=>d.meshes.reduce((sum,m)=>sum+m.primitives.reduce((n,p)=>n+(p.indices===undefined?d.accessors[p.attributes.POSITION].count:d.accessors[p.indices].count)/3,0),0);
 assert.equal(triangles(optimized),triangles(source));
 const primitives=d=>d.meshes.reduce((sum,m)=>sum+m.primitives.length,0);
 if(name==='traveler-male'&&profile!=='mobile')assert(primitives(optimized)<=14);
 const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));
 const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const vrm=gltf.userData.vrm;
 assert(vrm);VRMUtils.rotateVRM0(vrm);
 for(const bone of ['head','chest','hips','leftUpperLeg','leftLowerLeg','rightUpperArm'])assert(vrm.humanoid.getNormalizedBoneNode(bone));
 for(let frame=0;frame<60;frame++){vrm.humanoid.getNormalizedBoneNode('leftUpperLeg').rotation.x=Math.sin(frame/10)*.4;vrm.update(1/60)}
 const box=new THREE.Box3().setFromObject(vrm.scene);assert(Number.isFinite(box.max.y)&&box.max.y>box.min.y);
});
