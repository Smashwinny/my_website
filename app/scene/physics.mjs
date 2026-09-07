import { Vector3, Ray } from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { Octree } from 'three/addons/math/Octree.js';

export function createCollisionWorld(root) { return new Octree().fromGraphNode(root); }
export class PlayerController {
 constructor(world, position, {radius=.36,height=2.15,boundary=20.7}={}) {
  this.world=world;this.radius=radius;this.height=height;this.boundary=boundary;
  this.velocity=new Vector3();this.position=position.clone();this.grounded=false;this.landing=0;this.coyote=0;this.jumpBuffer=0;this.accumulator=0;
  this.capsule=new Capsule(new Vector3(),new Vector3(),radius);this.reset(position);
 }
 reset(position){this.position.copy(position);this.capsule.start.copy(position).y+=this.radius;this.capsule.end.copy(position).y+=this.height-this.radius;this.velocity.set(0,0,0);this.jumpBuffer=0;this.coyote=0;this.grounded=false;this.accumulator=0}
 requestJump(){this.jumpBuffer=.12}
 update(delta,direction){
  this.accumulator+=Math.min(delta,.08);
  while(this.accumulator>=1/120){this.step(1/120,direction);this.accumulator-=1/120}
  return this.position;
 }
 step(dt,direction){
  this.landing=Math.max(0,this.landing-dt*4);this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);this.coyote=this.grounded?.09:Math.max(0,this.coyote-dt);
  const accel=this.grounded?13:5,blend=1-Math.exp(-accel*dt);
  this.velocity.x+=(direction.x*3.1-this.velocity.x)*blend;this.velocity.z+=(direction.z*3.1-this.velocity.z)*blend;
  if(this.jumpBuffer>0&&this.coyote>0){this.velocity.y=6;this.grounded=false;this.coyote=0;this.jumpBuffer=0}
  this.velocity.y-=17*dt;const impact=this.velocity.y;this.capsule.translate(this.velocity.clone().multiplyScalar(dt));this.grounded=false;
  for(let pass=0;pass<5;pass++){
   const hit=this.world.capsuleIntersect(this.capsule);if(!hit)break;
   this.capsule.translate(hit.normal.clone().multiplyScalar(hit.depth+1e-5));
   if(hit.normal.y>.5&&impact<=0){this.grounded=true;if(impact< -2.5)this.landing=Math.min(1,-impact/8)}
   const inward=this.velocity.dot(hit.normal);if(inward<0)this.velocity.addScaledVector(hit.normal,-inward);
  }
  this.position.copy(this.capsule.start);this.position.y-=this.radius;
  const r=Math.hypot(this.position.x,this.position.z);
  if(r>this.boundary){const correction=new Vector3(this.position.x*(this.boundary/r-1),0,this.position.z*(this.boundary/r-1));this.capsule.translate(correction);this.position.add(correction);const outward=new Vector3(this.position.x,0,this.position.z).normalize();const speed=this.velocity.dot(outward);if(speed>0)this.velocity.addScaledVector(outward,-speed)}
 }
}
export function safeCameraPosition(world,target,desired,padding=.25){
 const direction=desired.clone().sub(target),distance=direction.length();if(distance<.001)return desired.clone();direction.normalize();const hit=world.rayIntersect(new Ray(target,direction));
 return hit&&hit.distance<distance+padding?target.clone().addScaledVector(direction,Math.max(.05,hit.distance-padding)):desired.clone();
}
// A flying companion uses the same triangle collision world, at a smaller scale.
export function resolveFlyingBody(world,position,radius=.43,height=1.2){
 const body=new Capsule(position.clone().add(new Vector3(0,radius,0)),position.clone().add(new Vector3(0,height-radius,0)),radius);
 for(let i=0;i<6;i++){const hit=world.capsuleIntersect(body);if(!hit)break;body.translate(hit.normal.clone().multiplyScalar(hit.depth+1e-4))}
 return body.start.clone().add(new Vector3(0,-radius,0));
}
