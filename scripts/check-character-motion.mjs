import {build} from 'rolldown';import {readFile,writeFile,mkdir} from 'node:fs/promises';import assert from 'node:assert/strict';import * as THREE from 'three';
await mkdir('tmp',{recursive:true});
await writeFile('tmp/motion-check-source.ts',"export {loadCharacter} from '../app/scene/characters';export {equipStaff} from '../app/scene/mist-staff';");
await build({input:'tmp/motion-check-source.ts',platform:'node',external:id=>id==='three'||id.startsWith('three/')||id==='@pixiv/three-vrm',output:{file:'tmp/motion-check-bundle.mjs',format:'esm'}});
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});globalThis.ProgressEvent=class{constructor(type,init){this.type=type;Object.assign(this,init)}};
const fetchOriginal=globalThis.fetch;globalThis.fetch=async(url,...args)=>typeof url==='string'&&url.startsWith('/models/')?new Response(await readFile('public'+url)):fetchOriginal(url,...args);
const {loadCharacter,equipStaff}=await import('../tmp/motion-check-bundle.mjs');
for(const name of ['traveler-male','traveler']){
 const actor=await loadCharacter(false,`/models/${name}-mobile.vrm`,true),staff=equipStaff(actor.vrm);const v=actor.vrm;
 const bone=name=>v.humanoid.getNormalizedBoneNode(name).getWorldPosition(new THREE.Vector3());
 const samples=[];
 for(const [state,speed,grounded,verticalVelocity] of [['idle',0,true,0],['walk',1,true,0],['jump',.6,false,3],['land',0,true,0]]){
  for(let frame=0;frame<90;frame++)actor.update(1/60,frame/60,{speed,grounded,verticalVelocity,landing:state==='land'?.2:0,turn:0,engaged:false});
  actor.root.updateWorldMatrix(true,true);
  const hand=v.humanoid.getRawBoneNode('rightHand').getWorldPosition(new THREE.Vector3());
  assert.equal(staff.parent,v.humanoid.getRawBoneNode('rightHand'));assert(staff.getWorldPosition(new THREE.Vector3()).distanceTo(hand)<.15);
  const bottom=staff.localToWorld(new THREE.Vector3(0,-.66,0));
  const head=bone('head'),elbow=bone('rightLowerArm'),wrist=bone('rightHand');assert(elbow.y<head.y&&wrist.y<head.y);assert(bottom.y>.04,'staff must clear the ground');
  actor.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));
  samples.push({state,staffBottom:bottom.y,hand:hand.toArray()});
 }
 console.log(name,'PASS: idle, walk, jump, landing, hand grip, staff clearance');
}
