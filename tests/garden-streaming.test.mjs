import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {build} from 'rolldown';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
await mkdir('tmp',{recursive:true});
await build({input:'app/scene/environment.ts',platform:'node',external:id=>id==='three'||id.startsWith('three/'),output:{file:'tmp/garden-test.mjs',format:'esm'}});
const {buildEnvironment}=await import('../tmp/garden-test.mjs');
test('garden enters without scenery downloads, streams nearby bounded batches and stops after disposal',async()=>{
 const original=GLTFLoader.prototype.loadAsync,requests=[];
 GLTFLoader.prototype.loadAsync=function(url){return new Promise(resolve=>requests.push({url,resolve}))};
 const scene=new THREE.Scene(),position=new THREE.Vector3(0,0,7.5);
 let environment;
 try{
  environment=await buildEnvironment(scene,()=>{});
  assert.equal(requests.length,0,'base world must not wait for or request GLTF scenery');
  assert(environment.collisionRoot.children.length>0,'terrain collision must be available immediately');
  environment.update(1,position);
  assert.equal(requests.length,2,'at most two model requests in flight');
  environment.update(2,position);
  assert.equal(requests.length,2,'updates cannot exceed download concurrency');
  for(const request of requests){const group=new THREE.Group();group.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({name:'Bark'})));request.resolve({scene:group})}
  await new Promise(resolve=>setImmediate(resolve));
  const before=environment.collisionRoot.children.length;
  environment.update(3,position);
  const added=environment.collisionRoot.children.slice(before);
  assert(added.length>0&&added.length<=8,'one update must instantiate a bounded batch');
  for(const mesh of added){const p=new THREE.Vector3().setFromMatrixPosition(mesh.matrix);const d=Math.hypot(p.x-position.x,p.z-position.z);assert(d<14,'unexplored far scenery must not instantiate')}
  environment.dispose();const total=requests.length;
  environment.update(4,new THREE.Vector3(0,0,-15),true);
  assert.equal(requests.length,total,'switching themes must stop scheduling');
  let released=0;
  for(const request of requests.slice(2)){const group=new THREE.Group(),geometry=new THREE.BoxGeometry();geometry.addEventListener('dispose',()=>released++);group.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial()));request.resolve({scene:group})}
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(released,requests.length-2,'late downloads must release GPU resources');
 }finally{environment?.dispose();GLTFLoader.prototype.loadAsync=original}
});

test('appended collision subtree preserves old floor and blocks new geometry',async()=>{
 const {createCollisionWorld,PlayerController,safeCameraPosition}=await import('../app/scene/physics.mjs');
 const base=new THREE.Group(),floor=new THREE.Mesh(new THREE.BoxGeometry(30,.2,30));floor.position.y=-.1;base.add(floor);
 const world=createCollisionWorld(base),original=world.subTrees.slice();
 const batch=new THREE.Group(),wall=new THREE.Mesh(new THREE.BoxGeometry(.2,5,8));wall.position.set(2,2.5,0);batch.add(wall);
 const start=performance.now();world.subTrees.push(createCollisionWorld(batch));
 console.log('Incremental box collision build:',(performance.now()-start).toFixed(2),'ms');
 assert(original.every((tree,i)=>world.subTrees[i]===tree),'base octree must be reused');
 const player=new PlayerController(world,new THREE.Vector3(0,0,0));
 for(let i=0;i<180;i++)player.update(1/60,new THREE.Vector3(1,0,0));
 assert(player.position.x<1.6,'streamed wall must stop the player');
 assert(Math.abs(player.position.y)<.03,'old floor must still support player');
 assert(safeCameraPosition(world,new THREE.Vector3(0,1,0),new THREE.Vector3(4,1,0)).x<2,'camera must see appended collision');
 player.requestJump();for(let i=0;i<8;i++)player.update(1/60,new THREE.Vector3());assert(player.position.y>.2,'jump must survive collision append');
});
