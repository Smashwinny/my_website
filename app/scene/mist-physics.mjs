import {Vector3} from 'three';
export const ISLAND_RADIUS=3.6,ISLAND_SPACING=8.4;
export function islandX(index){return Math.sin(index*.64)*1.15}
export function islandHeight(index,time){return Math.sin(index*1.7)*.16+Math.sin(time*.65+index*.83)*.48}
export function islandPosition(index,time){return new Vector3(islandX(index),islandHeight(index,time),-index*ISLAND_SPACING)}
export function islandContains(index,x,z,margin=0){return Math.hypot(x-islandX(index),z+index*ISLAND_SPACING)<=ISLAND_RADIUS-margin}
export function visibleIsland(index,anchor){return Math.abs(index-anchor)<=1}
// Explicit route order is independent of repository count. Missing assignments
// become empty islands; new projects can be inserted anywhere without a counter.
export function islandEntry(index,route){const start=Math.max(0,route.findIndex(entry=>entry.id==='arrival'));return route[start+index]??{id:`wilderness-${index}`,project:null}}
export class MistController{
 constructor(index=0){this.position=islandPosition(index,0);this.velocity=new Vector3();this.time=0;this.accumulator=0;this.grounded=true;this.island=index;this.checkpoint=index;this.coyote=.1;this.buffer=0;this.landing=0;this.respawns=0}
 requestJump(){this.buffer=.14}
 reset(){this.position.copy(islandPosition(this.checkpoint,this.time));this.velocity.set(0,0,0);this.island=this.checkpoint;this.grounded=true;this.buffer=0;this.coyote=.1;this.respawns++}
 update(delta,direction){this.accumulator+=Math.min(delta,.08);while(this.accumulator>=1/120){this.step(1/120,direction);this.accumulator-=1/120}return this.position}
 step(dt,direction){
  const oldTime=this.time;this.time+=dt;this.landing=Math.max(0,this.landing-dt*4);this.buffer=Math.max(0,this.buffer-dt);
  if(this.grounded&&islandContains(this.island,this.position.x,this.position.z,.15))this.position.y+=islandHeight(this.island,this.time)-islandHeight(this.island,oldTime);
  this.coyote=this.grounded?.1:Math.max(0,this.coyote-dt);
  const blend=1-Math.exp(-(this.grounded?18:7)*dt);this.velocity.x+=(direction.x*4.4-this.velocity.x)*blend;this.velocity.z+=(direction.z*4.4-this.velocity.z)*blend;
  if(this.buffer>0&&this.coyote>0){this.velocity.y=7.4;this.buffer=0;this.coyote=0;this.grounded=false}
  const oldY=this.position.y;this.velocity.y-=16*dt;this.position.addScaledVector(this.velocity,dt);this.grounded=false;
  const closest=Math.round(-this.position.z/ISLAND_SPACING);
  for(let index=closest-1;index<=closest+1;index++){
   const top=islandHeight(index,this.time),oldTop=islandHeight(index,oldTime);
   if(islandContains(index,this.position.x,this.position.z,.15)&&this.velocity.y<=0&&oldY>=Math.min(top,oldTop)-.045&&this.position.y<=top+.012){if(this.velocity.y< -3)this.landing=Math.min(1,-this.velocity.y/9);this.position.y=top;this.velocity.y=0;this.grounded=true;this.island=index;this.checkpoint=index;break}
   // Solid platform edge: falling beside an island cannot pass through its rock.
   if(this.position.y<top-.05&&this.position.y+2.05>top-1.5){const dx=this.position.x-islandX(index),dz=this.position.z+index*ISLAND_SPACING,r=Math.hypot(dx,dz),edge=ISLAND_RADIUS+.28;if(r>0&&r<edge){this.position.x=islandX(index)+dx/r*edge;this.position.z=-index*ISLAND_SPACING+dz/r*edge;const inward=(this.velocity.x*dx+this.velocity.z*dz)/r;if(inward<0){this.velocity.x-=dx/r*inward;this.velocity.z-=dz/r*inward}}}
  }
  // Stone lanterns and the investigation tablet have solid collision bodies.
  for(const [x,z,radius,height] of [[-2.6,.6,.28,1.4],[2.6,.6,.28,1.4],[1.3,-.65,.34,.93]]){
   const top=islandHeight(closest,this.time);if(this.position.y>=top+height||this.position.y+2.05<=top)continue;
   const dx=this.position.x-islandX(closest)-x,dz=this.position.z+closest*ISLAND_SPACING-z,r=Math.hypot(dx,dz),edge=radius+.28;
   if(r>0&&r<edge){this.position.x+=dx/r*(edge-r);this.position.z+=dz/r*(edge-r);const inward=(this.velocity.x*dx+this.velocity.z*dz)/r;if(inward<0){this.velocity.x-=dx/r*inward;this.velocity.z-=dz/r*inward}}
  }
  if(this.position.y<islandHeight(this.checkpoint,this.time)-11)this.reset();
 }
}
