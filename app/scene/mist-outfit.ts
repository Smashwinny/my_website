import * as THREE from 'three';
import type {VRM} from '@pixiv/three-vrm';
// Lightweight, original travelling robes and weathered bronze details.
// Attached to the existing human rig, so gender and animation remain independent.
export function dressMistTraveler(vrm:VRM,companion:boolean){
 const cloth=new THREE.MeshStandardMaterial({color:companion?'#565a50':'#514433',roughness:1,side:THREE.DoubleSide});
 const bronze=new THREE.MeshStandardMaterial({color:'#84704a',metalness:.55,roughness:.72});
 const leather=new THREE.MeshStandardMaterial({color:'#302b24',roughness:.95});
 const red=new THREE.MeshStandardMaterial({color:'#62352c',roughness:1,side:THREE.DoubleSide});
 const chest=vrm.humanoid.getRawBoneNode('chest')!,hips=vrm.humanoid.getRawBoneNode('hips')!,head=vrm.humanoid.getRawBoneNode('head')!;
 const add=(parent:THREE.Object3D,g:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o};
 const cuirass=add(chest,new THREE.SphereGeometry(.235,20,14),leather,0,-.035,0);cuirass.scale.set(1,.95,.63);
 for(let row=0;row<5;row++)for(let col=0;col<7;col++){const a=(col-3)*.25;const plate=add(chest,new THREE.BoxGeometry(.047,.05,.014),bronze,Math.sin(a)*.23,.12-row*.055,Math.cos(a)*.151);plate.rotation.y=a}
 const skirt=add(hips,new THREE.CylinderGeometry(.17,.285,.46,24,5,true,0,Math.PI*1.87),cloth,0,-.25);skirt.rotation.y=.2;
 const belt=add(hips,new THREE.CylinderGeometry(.195,.2,.075,24),red,0,-.015);belt.scale.z=.78;
 add(hips,new THREE.TorusGeometry(.04,.009,6,20),bronze,0,-.01,.17);
 // Split shoulder mantle; folds and an asymmetrical sash give the silhouette weight.
 const cape=new THREE.PlaneGeometry(.48,.66,12,16);const p=cape.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,Math.sin(x*42)*.014+( .33-y)*.15)}cape.computeVertexNormals();
 const mantle=add(chest,cape,cloth,0,-.15,-.15);mantle.rotation.x=-.12;
 const sash=add(chest,new THREE.BoxGeometry(.065,.45,.012),red,.07,-.02,.17);sash.rotation.z=-.48;
 for(const side of ['left','right'] as const){
  const forearm=vrm.humanoid.getRawBoneNode(`${side}LowerArm`),leg=vrm.humanoid.getRawBoneNode(`${side}LowerLeg`);
  if(forearm){const guard=add(forearm,new THREE.CylinderGeometry(.057,.048,.16,12),bronze,side==='left'?.09:-.09);guard.rotation.z=Math.PI/2}
  if(leg)for(let i=0;i<5;i++)add(leg,new THREE.CylinderGeometry(.065-i*.002,.064-i*.002,.027,12),leather,0,-.07-i*.04);
 }
 const hat=add(head,new THREE.ConeGeometry(.31,.13,40),cloth,0,.22);hat.scale.z=.95;
 const rim=add(head,new THREE.TorusGeometry(.3,.009,6,40),bronze,0,.155);rim.rotation.x=Math.PI/2;
 // Prayer beads, not the bright fairy wings used by the garden.
 for(let i=0;i<15;i++){const a=i/15*Math.PI*2;add(chest,new THREE.SphereGeometry(.018,8,6),bronze,Math.cos(a)*.145,.13+Math.sin(a)*.075,.14)}
 return {cloth,bronze,mantle};
}
