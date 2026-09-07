import * as THREE from 'three';
import type {VRM} from '@pixiv/three-vrm';
// The grip is attached to the actual animated hand, with a model-independent length.
export function equipStaff(vrm:VRM){
 const hand=vrm.humanoid.getRawBoneNode('rightHand');if(!hand)throw Error('人物缺少右手骨骼');
 vrm.scene.updateWorldMatrix(true,true);
 const staff=new THREE.Group();staff.name='JinguBang';
 const finger=vrm.humanoid.getRawBoneNode('rightMiddleProximal');
 if(finger){const palm=finger.getWorldPosition(new THREE.Vector3()).lerp(hand.getWorldPosition(new THREE.Vector3()),.35);staff.position.copy(hand.worldToLocal(palm))}
 const handRotation=hand.getWorldQuaternion(new THREE.Quaternion());
 const upright=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-.12);
 staff.quaternion.copy(handRotation.invert().multiply(upright));
 const scale=hand.getWorldScale(new THREE.Vector3());staff.scale.set(1/scale.x,1/scale.y,1/scale.z);
 const iron=new THREE.MeshStandardMaterial({color:'#2e2923',metalness:.8,roughness:.38});
 const gold=new THREE.MeshStandardMaterial({color:'#bba263',metalness:.86,roughness:.3});
 const wrap=new THREE.MeshStandardMaterial({color:'#4d2920',roughness:.92});
 const add=(g:THREE.BufferGeometry,m:THREE.Material,y:number)=>{const mesh=new THREE.Mesh(g,m);mesh.position.y=y;mesh.castShadow=true;mesh.receiveShadow=true;staff.add(mesh);return mesh};
 // Lower end remains above the floor in the relaxed carrying stance.
 add(new THREE.CylinderGeometry(.024,.024,2.1,16),iron,.39);
 for(const y of [-.59,1.37]){add(new THREE.CylinderGeometry(.034,.034,.14,16),gold,y);for(const d of [-.065,0,.065]){const ring=add(new THREE.TorusGeometry(.035,.006,6,20),gold,y+d);ring.rotation.x=Math.PI/2}}
 add(new THREE.CylinderGeometry(.027,.027,.2,12),wrap,0);
 for(let i=0;i<9;i++){const band=add(new THREE.TorusGeometry(.028,.003,4,16),gold,-.09+i*.022);band.rotation.x=Math.PI/2}
 hand.add(staff);return staff;
}
