import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMHumanBoneName, VRMUtils } from '@pixiv/three-vrm';

export type Character = { root: THREE.Group; vrm: VRM; update: (delta:number,time:number,moving:number,talking:boolean)=>void };
export async function loadCharacter(companion=false):Promise<Character>{
 const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));
 const gltf=await loader.loadAsync('/models/traveler.vrm');const vrm=gltf.userData.vrm as VRM;
 VRMUtils.removeUnnecessaryVertices(vrm.scene);VRMUtils.combineSkeletons(vrm.scene);
 const root=new THREE.Group();root.add(vrm.scene);root.scale.setScalar(companion?.62:1.35);
 vrm.scene.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;object.frustumCulled=false;
 if(companion){const wasArray=Array.isArray(object.material);const recolored=(wasArray?object.material as THREE.Material[]:[object.material as THREE.Material]).map(mat=>{const m=mat.clone() as THREE.MeshStandardMaterial & {shadeColorFactor?:THREE.Color};if(/HAIR/.test(m.name)){m.map=null;m.color.set('#eee5cf');m.shadeColorFactor?.set('#aca8bc')}if(/Tops|Bottoms|Shoes/.test(m.name)){m.map=null;m.color.set(/Bottoms/.test(m.name)?'#adb6de':'#f7efda');m.shadeColorFactor?.set('#9ea8c9')}return m});object.material=wasArray?recolored:recolored[0]}
 }});
 if(companion){const halo=new THREE.Mesh(new THREE.TorusGeometry(.28,.016,8,48),new THREE.MeshStandardMaterial({color:'#ffe7a3',emissive:'#ffcf70',emissiveIntensity:1.2}));halo.rotation.x=Math.PI/2;halo.position.y=1.78;vrm.scene.add(halo)}
 const bone=(name:VRMHumanBoneName)=>vrm.humanoid.getNormalizedBoneNode(name);
 const pose=(name:VRMHumanBoneName,x=0,y=0,z=0)=>bone(name)?.rotation.set(x,y,z);
 let speed=0;
 return {root,vrm,update(delta,time,moving,talking){
 speed=THREE.MathUtils.damp(speed,moving,8,delta);const cycle=time*8.4,swing=Math.sin(cycle)*.52*speed;
 pose('leftUpperArm',-swing*.65,0,-1.32+(companion?.25:0));pose('rightUpperArm',swing*.65,0,1.32-(companion?.25:0));
 pose('leftLowerArm',-.1-Math.max(0,-swing)*.5);pose('rightLowerArm',-.1-Math.max(0,swing)*.5);
 pose('leftUpperLeg',swing);pose('rightUpperLeg',-swing);pose('leftLowerLeg',Math.max(0,-swing)*1.1);pose('rightLowerLeg',Math.max(0,swing)*1.1);
 pose('chest',Math.sin(time*2)*.013+speed*.05,Math.sin(cycle)*speed*.025,Math.sin(time*1.4)*.01);
 pose('head',Math.sin(time*.7)*.035,Math.sin(time*.55)*.07);if(companion){pose('leftUpperLeg',-.18);pose('rightUpperLeg',-.1);pose('leftLowerLeg',.3);pose('rightLowerLeg',.22)}
 vrm.expressionManager?.setValue('blink',Math.pow(Math.max(0,Math.sin(time*1.05)),35));vrm.expressionManager?.setValue('happy',companion?.25:.08);vrm.expressionManager?.setValue('aa',talking?Math.max(0,Math.sin(time*10))*.4:0);
 vrm.scene.position.y=companion?0:Math.abs(Math.sin(cycle))*speed*.035;
 vrm.update(delta);
 }};
}
