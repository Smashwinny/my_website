import {build} from 'rolldown';import {readFile,writeFile,mkdir} from 'node:fs/promises';import assert from 'node:assert/strict';import * as THREE from 'three';
import {MistController} from '../app/scene/mist-physics.mjs';
await mkdir('tmp',{recursive:true});
await writeFile('tmp/motion-check-source.ts',"export {loadCharacter} from '../app/scene/characters';export {equipStaff} from '../app/scene/mist-staff';export {dressMistTraveler} from '../app/scene/mist-outfit';");
await build({input:'tmp/motion-check-source.ts',platform:'node',external:id=>id==='three'||id.startsWith('three/')||id==='@pixiv/three-vrm',output:{file:'tmp/motion-check-bundle.mjs',format:'esm'}});
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){}});globalThis.ProgressEvent=class{constructor(type,init){this.type=type;Object.assign(this,init)}};
const fetchOriginal=globalThis.fetch;globalThis.fetch=async(url,...args)=>typeof url==='string'&&url.startsWith('/models/')?new Response(await readFile('public'+url)):fetchOriginal(url,...args);
const {loadCharacter,equipStaff,dressMistTraveler}=await import('../tmp/motion-check-bundle.mjs');
const report=[],poses=[];
for(const name of ['traveler-male','traveler']){
 const actor=await loadCharacter(false,`/models/${name}-web.vrm`,true),staff=equipStaff(actor.vrm),outfit=dressMistTraveler(actor.vrm,false);const v=actor.vrm;
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
 const feet=['leftFoot','rightFoot'].map(name=>v.humanoid.getRawBoneNode(name));
 for(let i=0;i<120;i++)actor.update(1/120,i/120,{speed:0,grounded:true,verticalVelocity:0,landing:0,turn:0,engaged:false});
 const baseline=feet.map(f=>f.getWorldPosition(new THREE.Vector3()).y);
 const before=feet.map(f=>f.getWorldPosition(new THREE.Vector3()));
 let sliding=0,contactFrames=0,minHeight=Infinity,maxLift=0,clock=2;
 for(let i=0;i<720;i++){
  clock+=1/120;actor.root.position.z+=3.1/120;
  actor.update(1/120,clock,{speed:1,metersPerSecond:3.1,grounded:true,verticalVelocity:0,landing:0,turn:0,engaged:false});
  outfit.update(1/120,1,0);actor.root.updateWorldMatrix(true,true);
  feet.forEach((f,j)=>{const p=f.getWorldPosition(new THREE.Vector3()),lift=p.y-baseline[j];minHeight=Math.min(minHeight,lift);maxLift=Math.max(maxLift,lift);
   if(i>120&&Math.abs(lift)<.004&&Math.abs(before[j].y-baseline[j])<.004){sliding+=Math.hypot(p.x-before[j].x,p.z-before[j].z)*120;contactFrames++}before[j].copy(p);
  });
  if([360,375,390].includes(i))snapshot(actor,name,'walk-'+i);
 }
 const meanContactSpeed=sliding/contactFrames;
 console.log(name,{meanContactSpeed,minHeight,maxLift,contactFrames});
 assert(contactFrames>150,'must contain sustained support phases');
 assert(meanContactSpeed<.25,'support feet must stay planted');
 assert(minHeight>-.015,'ankles may not sink beneath rest ground');
 assert(maxLift>.04&&maxLift<.3,'swing must lift the foot naturally');
 report.push({name,meanContactSpeed,minHeight,maxLift,contactFrames});
 for(let i=0;i<120;i++){clock+=1/120;actor.update(1/120,clock,{speed:0,grounded:true,verticalVelocity:0,landing:0,turn:0,engaged:false});outfit.update(1/120,0,0)}
 snapshot(actor,name,'idle');
 // Real controller-driven jump, not a hand-written sustained landing flag.
 const parent=new THREE.Group();parent.add(actor.root);actor.root.position.set(0,0,0);
 const controller=new MistController();parent.position.copy(controller.position);controller.requestJump();
 let tookOff=false,landed=false,lowestStaff=Infinity;
 for(let i=0;i<240;i++){
  parent.position.copy(controller.update(1/120,new THREE.Vector3()));clock+=1/120;
  actor.update(1/120,clock,{speed:0,metersPerSecond:0,grounded:controller.grounded,verticalVelocity:controller.velocity.y,landing:controller.landing,turn:0,engaged:false});
  outfit.update(1/120,0,0);parent.updateWorldMatrix(true,true);
  if(!controller.grounded)tookOff=true;if(tookOff&&controller.grounded)landed=true;
  const bottom=staff.localToWorld(new THREE.Vector3(0,-.66,0)).y-parent.position.y;lowestStaff=Math.min(lowestStaff,bottom);
  actor.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));
 }
 assert(tookOff&&landed);assert(lowestStaff>-.02,'staff cannot penetrate landing surface');
 console.log(name,'real jump + landing PASS', {lowestStaff});
}
// Run the same movement timeline at common frame rates, including a 20Hz phone.
const rates=[];
for(const fps of [20,30,60,120]){
 const actor=await loadCharacter(false,'/models/traveler-male-lite.vrm');
 for(let i=0;i<fps*4;i++){
  actor.root.position.z+=3.1/fps;
  actor.update(1/fps,i/fps,{speed:1,metersPerSecond:3.1,grounded:true,verticalVelocity:0,landing:0,turn:0,engaged:false});
 }
 const feet=['leftFoot','rightFoot'].map(n=>actor.vrm.humanoid.getRawBoneNode(n).getWorldPosition(new THREE.Vector3()).sub(actor.root.position).toArray());
 rates.push({fps,position:actor.root.position.toArray(),feet});
 // Acute change of heading: keep knee solutions finite and feet above ground.
 for(let i=0;i<fps;i++){
  const yaw=Math.min(Math.PI,i/fps*6);actor.root.rotation.y=yaw;actor.root.position.x+=Math.sin(yaw)*3.1/fps;actor.root.position.z+=Math.cos(yaw)*3.1/fps;
  actor.update(1/fps,4+i/fps,{speed:1,metersPerSecond:3.1,grounded:true,verticalVelocity:0,landing:0,turn:1,engaged:false});
  actor.root.updateWorldMatrix(true,true);actor.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));
  for(const name of ['leftFoot','rightFoot'])assert(actor.vrm.humanoid.getRawBoneNode(name).getWorldPosition(new THREE.Vector3()).y>.1);
 }
}
for(const sample of rates){assert(Math.abs(sample.position[2]-12.4)<1e-8);for(let j=0;j<2;j++)assert(new THREE.Vector3(...sample.feet[j]).distanceTo(new THREE.Vector3(...rates.at(-1).feet[j]))<.13,'frame rates must not change the gait substantially')}
console.log('20/30/60/120 Hz and 180-degree turning PASS');
await writeFile('tmp/motion-metrics.json',JSON.stringify({grounded:report,frameRates:rates},null,2));
if(process.argv.includes('--snapshots'))await writeFile('tmp/motion-poses.json',JSON.stringify(poses));

function snapshot(actor,name,state){
 if(!process.argv.includes('--snapshots'))return;
 actor.root.updateMatrixWorld(true);
 const meshes=[];
 actor.root.traverse(o=>{
  if(!o.isMesh||!o.visible)return;
  for(let p=o.parent;p;p=p.parent)if(!p.visible)return;
  const g=o.geometry.clone(),pos=g.attributes.position,v=new THREE.Vector3();
  if(o.isSkinnedMesh)o.skeleton.update();
  for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);if(o.isSkinnedMesh)o.applyBoneTransform(i,v);v.applyMatrix4(o.matrixWorld);v.sub(actor.root.position);pos.setXYZ(i,v.x,v.y,v.z)}
  g.computeVertexNormals();
  const mats=Array.isArray(o.material)?o.material:[o.material];
  meshes.push({name:o.name,positions:Array.from(pos.array),normals:Array.from(g.attributes.normal.array),uv:g.attributes.uv?Array.from(g.attributes.uv.array):null,indices:g.index?Array.from(g.index.array):null,groups:g.groups,materials:mats.map(m=>({name:m.name,color:m.color?.toArray()??[1,1,1],map:m.map?.name??null,side:m.side,alphaTest:m.alphaTest,opacity:m.opacity}))});g.dispose();
 });
 poses.push({source:`public/models/${name}-web.vrm`,name,state,meshes});
}
