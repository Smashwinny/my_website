import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {VRM,VRMHumanBoneName} from '@pixiv/three-vrm';

// Original travelling gear: fitted lamellar plates, split robe and soft mantle.
// Author attachments in model-forward space, independent of VRM 0/1 raw bases.
export function dressMistTraveler(vrm:VRM,companion:boolean){
 const cloth=new THREE.MeshStandardMaterial({color:companion?'#565a50':'#514433',roughness:.95,side:THREE.DoubleSide});
 const bronze=new THREE.MeshStandardMaterial({color:'#927c50',metalness:.65,roughness:.48});
 const leather=new THREE.MeshStandardMaterial({color:'#302b24',roughness:.86});
 const red=new THREE.MeshStandardMaterial({color:'#703e32',roughness:.9,side:THREE.DoubleSide});
 const root=vrm.scene.parent!;
 root.updateWorldMatrix(true,true);
 const canonical=root.getWorldQuaternion(new THREE.Quaternion());
 const scale=root.getWorldScale(new THREE.Vector3()).y;
 const shoulderL=vrm.humanoid.getRawBoneNode('leftUpperArm')!.getWorldPosition(new THREE.Vector3());
 const shoulderR=vrm.humanoid.getRawBoneNode('rightUpperArm')!.getWorldPosition(new THREE.Vector3());
 const fit=THREE.MathUtils.clamp(shoulderL.distanceTo(shoulderR)/scale/.42,.8,1.2);
 const frame=(name:VRMHumanBoneName)=>{
  const bone=vrm.humanoid.getRawBoneNode(name)!;
  const group=new THREE.Group();group.name='traveler-attachment-'+name;
  group.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(canonical));
  group.scale.setScalar(fit);bone.add(group);return group;
 };
 const chest=frame('chest'),hips=frame('hips'),head=frame('head');
 const add=(parent:THREE.Object3D,g:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0)=>{
  const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;
 };
 const cuirass=add(chest,new THREE.SphereGeometry(.224,24,16),leather,0,-.035,0);cuirass.scale.set(1,.95,.64);
 // One mesh instead of 35 draw calls, with bevels that catch the side light.
 const plates:THREE.BufferGeometry[]=[];
 for(let row=0;row<5;row++)for(let col=0;col<7;col++){
  const a=(col-3)*.25,g=new RoundedBoxGeometry(.048,.054,.014,2,.004);
  g.rotateY(a);g.translate(Math.sin(a)*.22,.12-row*.051,Math.cos(a)*.151);plates.push(g);
 }
 const plateMesh=mergeGeometries(plates);plates.forEach(g=>g.dispose());add(chest,plateMesh,bronze);
 const panels:THREE.Mesh[]=[];
 for(let panel=0;panel<6;panel++){
  const center=(panel+.5)/6*Math.PI*2;
  const g=new THREE.PlaneGeometry(1,1,5,8),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
   const t=.5-p.getY(i),a=center+p.getX(i)*.94,r=.175+t*.085;
   p.setXYZ(i,Math.sin(a)*r,-t*.36-.035,Math.cos(a)*r*.85+Math.sin(t*16)*.006);
  }
  g.computeVertexNormals();const o=add(hips,g,cloth);o.name='split-robe-'+panel;panels.push(o);
 }
 const belt=add(hips,new THREE.CylinderGeometry(.195,.2,.068,32),red,0,-.015);belt.scale.z=.8;
 const buckle=add(hips,new RoundedBoxGeometry(.072,.061,.018,2,.008),bronze,0,-.01,.17);
 buckle.rotation.z=.08;
 const cape=new THREE.PlaneGeometry(.47,.61,12,16),p=cape.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),t=(.305-y)/.61;p.setXYZ(i,x*(1+t*.12),y,Math.sin(x*43)*.012-t*.07)}
 cape.computeVertexNormals();const rest=Float32Array.from(p.array);
 const mantle=add(chest,cape,cloth,0,-.14,-.16);mantle.name='traveler-mantle';
 const sash=add(chest,new RoundedBoxGeometry(.055,.43,.016,2,.006),red,.065,-.02,.17);sash.rotation.z=-.48;
 for(const side of ['left','right'] as const){
  const forearm=frame(`${side}LowerArm`),leg=frame(`${side}LowerLeg`);
  forearm.updateWorldMatrix(true,true);
  const hand=vrm.humanoid.getRawBoneNode(`${side}Hand`)!.getWorldPosition(new THREE.Vector3());
  const direction=forearm.worldToLocal(hand).normalize();
  const guard=add(forearm,new THREE.CylinderGeometry(.054,.045,.145,16),bronze);
  guard.position.copy(direction).multiplyScalar(.085);
  guard.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
  for(let i=0;i<4;i++)add(leg,new THREE.CylinderGeometry(.064-i*.002,.063-i*.002,.023,16),leather,0,-.075-i*.039);
 }
 // Slightly curved, double-sided brim with concentric woven ribs.
 const hat=add(head,new THREE.ConeGeometry(.33,.21,48,3,true),cloth,0,.3);hat.scale.z=.95;
 for(let i=0;i<3;i++){const radius=.14+i*.09;const rim=add(head,new THREE.TorusGeometry(radius,.0035,4,48),bronze,0,.405-radius*.636);rim.rotation.x=Math.PI/2;rim.scale.y=.95}
 const beads:THREE.BufferGeometry[]=[];
 for(let i=0;i<15;i++){const a=i/15*Math.PI*2,g=new THREE.SphereGeometry(.016,8,6);g.translate(Math.cos(a)*.143,.13+Math.sin(a)*.075,.14);beads.push(g)}
 add(chest,mergeGeometries(beads),bronze);beads.forEach(g=>g.dispose());
 let breeze=0,bank=0,clock=0;
 const basis=vrm.meta.metaVersion==='0'?-1:1;
 return {cloth,bronze,mantle,update(dt:number,speed:number,turn:number){
  if(dt<=0)return;clock+=dt;breeze=THREE.MathUtils.damp(breeze,speed,5,dt);bank=THREE.MathUtils.damp(bank,turn,5,dt);
  for(let i=0;i<p.count;i++){
   const x=rest[i*3],y=rest[i*3+1],t=(.305-y)/.61,weight=t*t;
   p.setXYZ(i,x+bank*.055*weight,y,rest[i*3+2]-breeze*.06*weight+Math.sin(clock*3.4+t*4+x*8)*(.004+breeze*.013)*weight);
  }
  p.needsUpdate=true;cape.computeVertexNormals();
  const left=vrm.humanoid.getNormalizedBoneNode('leftUpperLeg')!.rotation.x*basis;
  const right=vrm.humanoid.getNormalizedBoneNode('rightUpperLeg')!.rotation.x*basis;
  panels.forEach((panel,i)=>{const thigh=i<3?left:right;panel.rotation.x=-Math.max(0,-thigh)*.24;panel.rotation.z=Math.sin(clock*3+i)*.008*breeze+bank*.018;});
 }};
}
