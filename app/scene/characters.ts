import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VRM,VRMLoaderPlugin,VRMHumanBoneName,VRMUtils} from '@pixiv/three-vrm';
import {appearances,type AppearanceId} from './appearances';
export type Motion={speed:number;grounded:boolean;verticalVelocity:number;landing:number;turn:number;engaged:boolean};
export type Character={root:THREE.Group;vrm:VRM;setAppearance:(id:AppearanceId)=>void;update:(delta:number,time:number,motion:Motion)=>void};
export async function loadCharacter(companion=false,source='/models/traveler.vrm'):Promise<Character>{
 const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));
 const gltf=await loader.loadAsync(source),vrm=gltf.userData.vrm as VRM|undefined;
 if(!vrm?.humanoid)throw Error('请选择带有标准人形骨骼的 VRM 模型');
 VRMUtils.removeUnnecessaryVertices(vrm.scene);VRMUtils.combineSkeletons(vrm.scene);
 const root=new THREE.Group();root.add(vrm.scene);
 // Normalize all imported avatars to the same body height used by collision.
 const bounds=new THREE.Box3().setFromObject(vrm.scene),height=bounds.max.y-bounds.min.y;
 if(!Number.isFinite(height)||height<.1)throw Error('模型尺寸无效');
 root.scale.setScalar((companion?1.06:2.05)/height);const baseY=-bounds.min.y;vrm.scene.position.y=baseY;
 type Toon=THREE.MeshStandardMaterial & {shadeColorFactor?:THREE.Color};
 const originals:{material:Toon;map:THREE.Texture|null;color:THREE.Color;shade?:THREE.Color}[]=[];
 vrm.scene.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;object.frustumCulled=false;for(const mat of Array.isArray(object.material)?object.material:[object.material]){const m=mat as Toon;if(m.color&&!originals.some(v=>v.material===m))originals.push({material:m,map:m.map,color:m.color.clone(),shade:m.shadeColorFactor?.clone()})}}});
 const decor=new THREE.Group(),wingLeft=new THREE.Group(),wingRight=new THREE.Group();
 const head=vrm.humanoid.getRawBoneNode('head')!,chest=vrm.humanoid.getRawBoneNode('upperChest')||vrm.humanoid.getRawBoneNode('chest')!;
 const headDecor=new THREE.Group();head.add(headDecor);chest.add(decor);decor.add(wingLeft,wingRight);
 const haloMat=new THREE.MeshStandardMaterial({color:'#ffe7a3',emissive:'#ffcf70',emissiveIntensity:.65});
 const halo=new THREE.Mesh(new THREE.TorusGeometry(.24,.014,8,48),haloMat);halo.rotation.x=Math.PI/2;halo.position.y=.29;headDecor.add(halo);
 const hat=new THREE.Group();const hatMat=new THREE.MeshStandardMaterial({color:'#527569',roughness:.9});const crown=new THREE.Mesh(new THREE.SphereGeometry(.22,24,12),hatMat);crown.scale.set(1,.4,1);crown.position.set(.035,.16,0);hat.add(crown);headDecor.add(hat);
 const wingShape=new THREE.Shape();wingShape.moveTo(0,0);wingShape.bezierCurveTo(.15,.32,.58,.38,.65,.12);wingShape.bezierCurveTo(.45,.13,.4,-.28,.16,-.16);wingShape.quadraticCurveTo(.08,-.04,0,0);
 const wingGeo=new THREE.ShapeGeometry(wingShape,24),wingMat=new THREE.MeshPhysicalMaterial({color:'#d1e8ed',metalness:.15,roughness:.2,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false});
 for(const [group,sign] of [[wingLeft,1],[wingRight,-1]] as const){const wing=new THREE.Mesh(wingGeo,wingMat);wing.scale.x=sign;group.add(wing);group.position.set(sign*.08,.08,-.13)}
 function setAppearance(id:AppearanceId){const preset=appearances.find(p=>p.id===id)||appearances[0];for(const original of originals){const m=original.material;m.map=original.map;m.color.copy(original.color);if(original.shade)m.shadeColorFactor?.copy(original.shade);
 const hair=/HAIR|hair/i.test(m.name),clothes=/Tops|Bottoms|Shoes|cloth/i.test(m.name);const color=hair?preset.hair:clothes?preset.cloth:null;if(color){m.map=null;m.color.set(color);m.shadeColorFactor?.set(color).multiplyScalar(.68)}m.needsUpdate=true}
 halo.visible=companion||preset.accessory==='wings';hat.visible=preset.accessory==='beret';decor.visible=companion||preset.accessory==='wings';wingMat.color.set(preset.accent);hatMat.color.set(preset.cloth||'#527569');haloMat.color.set(preset.accent)}
 setAppearance(companion?'moon':'original');
 const target=new THREE.Quaternion(),euler=new THREE.Euler();let blend=1;
 function pose(name:VRMHumanBoneName,x=0,y=0,z=0){const node=vrm!.humanoid.getNormalizedBoneNode(name);if(node){target.setFromEuler(euler.set(x,y,z));node.quaternion.slerp(target,blend)}}
 let speed=0,phase=0,air=0,land=0,turn=0;
 return {root,vrm,setAppearance,update(delta,time,motion){
 time+=companion?1.37:0;
 speed=THREE.MathUtils.damp(speed,motion.speed,6,delta);air=THREE.MathUtils.damp(air,motion.grounded?0:1,10,delta);land=THREE.MathUtils.damp(land,motion.landing,18,delta);turn=THREE.MathUtils.damp(turn,motion.turn,5,delta);blend=1-Math.exp(-12*delta);
 phase+=delta*(2+speed*7)*speed;const step=Math.sin(phase),opposite=Math.sin(phase+Math.PI),breath=Math.sin(time*2.1),hover=Math.sin(time*2.4);
 if(companion){
  // Independent flight pose: bent, asymmetric legs; reaching arms; banked torso.
  pose('hips',-.18-speed*.12,Math.sin(time*.8)*.05,Math.sin(time*1.7)*.035-turn*.12);
  pose('spine',.05+hover*.025);pose('chest',-.04-speed*.13,Math.sin(time*1.3)*.07,-turn*.18);
  pose('leftUpperArm',-.18+Math.sin(time*3.1)*.12,-.1,-.82+Math.sin(time*2.4)*.16);
  pose('rightUpperArm',-.32+Math.sin(time*3.1+.8)*.14,.1,.78+Math.sin(time*2.4+.5)*.16);
  pose('leftLowerArm',-.15,0,-.45+hover*.12);pose('rightLowerArm',-.2,0,.48-hover*.1);
  pose('leftHand',.07,Math.sin(time*2)*.08,-.12);pose('rightHand',-.05,Math.sin(time*2+.8)*.08,.12);
  pose('leftUpperLeg',-.46+Math.sin(time*1.9)*.12,0,-.06);pose('rightUpperLeg',-.24+Math.sin(time*1.9+1)*.1,0,.08);
  pose('leftLowerLeg',.95+Math.sin(time*1.9+.6)*.16);pose('rightLowerLeg',.65+Math.sin(time*1.9+1.4)*.13);
  pose('leftFoot',.2);pose('rightFoot',.28);pose('head',-.05+breath*.035,Math.sin(time*.7)*.14,-turn*.08);
  wingLeft.rotation.y=-.45+Math.sin(time*5.2)*.4;wingRight.rotation.y=.45-Math.sin(time*5.2)*.4;
 }else{
  const stride=.43*speed*(1-air),jumpBend=air*(motion.verticalVelocity>0?.5:.22),compression=land*.22;
  pose('hips',-.025*speed,step*speed*.055,-step*speed*.025);pose('spine',-.035*speed+.1*land);pose('chest',breath*.012+speed*.04,-step*speed*.055,-turn*.08);
  pose('leftUpperLeg',step*stride-jumpBend-compression);pose('rightUpperLeg',opposite*stride-jumpBend*.6-compression);
  pose('leftLowerLeg',Math.max(0,step)*speed*.65+air*.72+compression*2);pose('rightLowerLeg',Math.max(0,opposite)*speed*.65+air*.48+compression*2);
  pose('leftFoot',-Math.max(0,step)*speed*.23-air*.12-compression);pose('rightFoot',-Math.max(0,opposite)*speed*.23-air*.1-compression);
  pose('leftUpperArm',0,-step*speed*.28,-1.34+air*.3+breath*.012);pose('rightUpperArm',0,-step*speed*.28,1.34-air*.3-breath*.012);
  pose('leftLowerArm',0,.08,-.14-Math.max(0,-step)*speed*.3-air*.3);pose('rightLowerArm',0,-.08,.14+Math.max(0,step)*speed*.3+air*.25);
  pose('leftHand',0,0,-.08);pose('rightHand',0,0,.08);pose('head',breath*.013,-turn*.2+Math.sin(time*.45)*.035,step*speed*.01);
  vrm.scene.position.y=baseY+Math.max(0,Math.abs(Math.sin(phase*2))*speed*.018);
 }
 const blinkPhase=time%4.7;vrm.expressionManager?.setValue('blink',blinkPhase<.18?Math.sin(blinkPhase/.18*Math.PI):0);vrm.expressionManager?.setValue('happy',companion?(motion.engaged?.4:.18):.06);vrm.expressionManager?.setValue('aa',0);
 vrm.update(delta);
 }};
}
