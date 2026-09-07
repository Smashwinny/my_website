import * as THREE from 'three';
import type {VRM} from '@pixiv/three-vrm';
import {gaitParameters,sampleFoot,smoothstep} from './gait.mjs';

type Input={speed:number;metersPerSecond?:number;grounded:boolean;landing:number};

/** Grounded, world-space foot plants and two-bone IK. Works with both VRM bases. */
export function createLocomotion(vrm:VRM,root:THREE.Group) {
 const hips=vrm.humanoid.getNormalizedBoneNode('hips')!;
 const hipsY=hips.position.y;
 root.updateWorldMatrix(true,true);
 const rootQ=root.getWorldQuaternion(new THREE.Quaternion());
 const inverseRootQ=rootQ.clone().invert();
 const legs=(['left','right'] as const).map((side,index)=>{
  const upper=vrm.humanoid.getNormalizedBoneNode(`${side}UpperLeg`)!;
  const lower=vrm.humanoid.getNormalizedBoneNode(`${side}LowerLeg`)!;
  const foot=vrm.humanoid.getNormalizedBoneNode(`${side}Foot`)!;
  const ankle=foot.getWorldPosition(new THREE.Vector3());
  const rest=root.worldToLocal(ankle.clone());
  return {upper,lower,foot,rest,offset:index*.5,
   length1:upper.getWorldPosition(new THREE.Vector3()).distanceTo(lower.getWorldPosition(new THREE.Vector3())),
   length2:lower.getWorldPosition(new THREE.Vector3()).distanceTo(ankle),
   restRotation:foot.getWorldQuaternion(new THREE.Quaternion()).premultiply(inverseRootQ),
   planted:ankle.clone(),target:ankle.clone(),correction:new THREE.Vector3(),contact:true,
   plantRotation:new THREE.Quaternion(),rotation:new THREE.Quaternion(),settleFrom:ankle.clone(),settle:1};
 });
 const previous=root.getWorldPosition(new THREE.Vector3()),position=new THREE.Vector3();
 const forward=new THREE.Vector3(),neutral=new THREE.Vector3(),hip=new THREE.Vector3();
 const ankle=new THREE.Vector3(),axis=new THREE.Vector3(),bend=new THREE.Vector3();
 const from=new THREE.Vector3(),to=new THREE.Vector3(),desiredKnee=new THREE.Vector3();
 const deltaQ=new THREE.Quaternion(),worldQ=new THREE.Quaternion(),parentQ=new THREE.Quaternion();
 let phase=.25,speed=0,dip=0,initialized=false,wasGrounded=true,owner=root.parent;

 function aim(node:THREE.Object3D,child:THREE.Object3D,target:THREE.Vector3) {
  node.getWorldPosition(from);child.getWorldPosition(to);to.sub(from).normalize();
  from.copy(target).sub(node.getWorldPosition(ankle)).normalize();
  deltaQ.setFromUnitVectors(to,from);
  node.getWorldQuaternion(worldQ).premultiply(deltaQ);
  node.parent!.getWorldQuaternion(parentQ).invert();
  node.quaternion.copy(parentQ.multiply(worldQ));
  node.updateWorldMatrix(false,true);
 }

 return {get cycle(){return phase},update(dt:number,motion:Input) {
  if(dt<=0)return;
  root.getWorldPosition(position);
  if(root.parent!==owner){owner=root.parent;initialized=false;previous.copy(position)}
  const distance=Math.hypot(position.x-previous.x,position.z-previous.z);
  const teleported=distance>1.5;
  previous.copy(position);
  speed=THREE.MathUtils.damp(speed,motion.metersPerSecond??motion.speed*3.1,10,dt);
  const gait=gaitParameters(speed);
  root.getWorldQuaternion(rootQ);forward.set(0,0,1).applyQuaternion(rootQ).setY(0).normalize();
  const scale=root.getWorldScale(to).y;
  if(!motion.grounded){
   initialized=false;wasGrounded=false;
   dip=THREE.MathUtils.damp(dip,0,12,dt);hips.position.y=hipsY-dip/scale;
   return;
  }
  if(teleported)initialized=false;
  if(!initialized){
   phase=gait.stance/2;
   for(const leg of legs){
    root.localToWorld(neutral.copy(leg.rest));leg.planted.copy(neutral);leg.target.copy(neutral);
    leg.rotation.copy(rootQ).multiply(leg.restRotation);leg.plantRotation.copy(leg.rotation);
    leg.correction.set(0,0,0);leg.contact=true;leg.settle=1;
   }
   initialized=true;
  }
  if(!teleported)phase=(phase+distance/gait.stride)%1;
  let requiredDip=0;
  const moving=speed>.12&&distance>.00001;
  // Stop with two small recovery steps, never drag planted feet towards idle.
  let recovering=false;
  for(const leg of legs){
   root.localToWorld(neutral.copy(leg.rest));
   leg.rotation.copy(rootQ).multiply(leg.restRotation);
   if(moving){
    const sample=sampleFoot(phase+leg.offset,gait);
    leg.target.copy(neutral).addScaledVector(forward,sample.z);leg.target.y+=sample.y;
    if(sample.contact){
     if(!leg.contact){leg.planted.copy(leg.target);leg.plantRotation.copy(leg.rotation)}
     leg.target.copy(leg.planted);leg.target.y=neutral.y;
     leg.rotation.copy(leg.plantRotation);
    }else{
     if(leg.contact)leg.correction.copy(leg.planted).sub(leg.target);
     leg.target.addScaledVector(leg.correction,1-smoothstep(sample.swing));
     leg.target.y=Math.max(neutral.y,leg.target.y);
    }
    leg.contact=sample.contact;leg.settle=1;
   }else{
    if(!recovering&&(leg.settle<1||leg.target.distanceTo(neutral)>.025)){
     recovering=true;
     if(leg.settle>=1){leg.settle=0;leg.settleFrom.copy(leg.target)}
     leg.settle=Math.min(1,leg.settle+dt/.22);
     leg.target.lerpVectors(leg.settleFrom,neutral,smoothstep(leg.settle));
     leg.target.y+=.045*Math.sin(Math.PI*leg.settle)**2;
     leg.planted.copy(leg.target);leg.plantRotation.copy(leg.rotation);
    }else{leg.target.y=neutral.y;leg.planted.copy(leg.target)}
    leg.contact=true;
   }
   leg.upper.getWorldPosition(hip);
   const horizontal=Math.hypot(hip.x-leg.target.x,hip.z-leg.target.z);
   const reach=(leg.length1+leg.length2)*.995;
   requiredDip=Math.max(requiredDip,hip.y+dip-leg.target.y-Math.sqrt(Math.max(.01,reach*reach-horizontal*horizontal)));
  }
  const wanted=Math.max(0,requiredDip)+motion.landing*.045;
  // Downward correction must be immediate to keep targets reachable; only rise is damped.
  dip=Math.max(wanted,THREE.MathUtils.damp(dip,wanted,12,dt));
  if(!wasGrounded)dip=Math.min(dip,.25);
  wasGrounded=true;hips.position.y=hipsY-dip/scale;
  root.updateWorldMatrix(true,true);
  for(const leg of legs){
   leg.upper.getWorldPosition(hip);axis.copy(leg.target).sub(hip);
   const length=THREE.MathUtils.clamp(axis.length(),.001,(leg.length1+leg.length2)*.9999);
   axis.normalize();
   // Knee plane follows the character's forward direction, not the raw VRM basis.
   bend.copy(forward).addScaledVector(axis,-forward.dot(axis)).normalize();
   const along=(leg.length1**2-leg.length2**2+length**2)/(2*length);
   const height=Math.sqrt(Math.max(0,leg.length1**2-along**2));
   desiredKnee.copy(hip).addScaledVector(axis,along).addScaledVector(bend,height);
   aim(leg.upper,leg.lower,desiredKnee);aim(leg.lower,leg.foot,leg.target);
   leg.foot.parent!.getWorldQuaternion(parentQ).invert();
   leg.foot.quaternion.copy(parentQ.multiply(leg.rotation));
   leg.foot.updateWorldMatrix(false,true);
  }
 }};
}
