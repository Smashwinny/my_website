export const FLOOR=440;
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export class MushroomAdventure{
 constructor(count){this.width=Math.max(1100,560+count*300);this.player={x:90,y:FLOOR-36,w:25,h:36,vx:0,vy:0};this.blocks=Array.from({length:count},(_,i)=>({x:240+i*300,y:320,w:42,h:42,project:i,bump:0,used:false}));this.pipes=Array.from({length:Math.max(0,count-1)},(_,i)=>({x:405+i*300,y:FLOOR-48,w:48,h:48}));this.mushrooms=[];this.collected=new Set();this.grounded=true;this.buffer=0;this.coyote=.1;this.time=0;this.accumulator=0;this.events=[]}
 jump(){this.buffer=.14}
 update(delta,axis){this.accumulator+=Math.min(delta,.08);while(this.accumulator>=1/120){this.step(1/120,axis);this.accumulator-=1/120}return this.player}
 hit(block){if(this.mushrooms.some(m=>m.project===block.project))return;block.bump=.2;block.used=true;this.mushrooms.push({x:block.x+9,y:block.y-24,w:24,h:24,vx:this.player.x<block.x?-65:65,vy:-125,project:block.project,age:0});this.events.push({type:'spawn',project:block.project})}
 step(dt,axis){
  this.time+=dt;this.buffer=Math.max(0,this.buffer-dt);this.coyote=this.grounded?.1:Math.max(0,this.coyote-dt);const p=this.player,solids=[...this.blocks,...this.pipes];
  p.vx+=(axis*205-p.vx)*(1-Math.exp(-18*dt));if(this.buffer>0&&this.coyote>0){p.vy=-515;this.grounded=false;this.coyote=0;this.buffer=0}
  p.x+=p.vx*dt;for(const b of solids)if(overlaps(p,b)){p.x=p.vx>0?b.x-p.w:b.x+b.w;p.vx=0}p.x=Math.max(0,Math.min(this.width-p.w,p.x));
  const before=p.y;p.vy+=1300*dt;p.y+=p.vy*dt;this.grounded=false;
  for(const b of solids)if(overlaps(p,b)){if(p.vy<0&&before>=b.y+b.h-.5){p.y=b.y+b.h;p.vy=0;if('project'in b)this.hit(b)}else if(p.vy>=0&&before+p.h<=b.y+.5){p.y=b.y-p.h;p.vy=0;this.grounded=true}}
  if(p.y+p.h>=FLOOR){p.y=FLOOR-p.h;p.vy=0;this.grounded=true}
  for(const b of this.blocks)b.bump=Math.max(0,b.bump-dt);
  for(const m of this.mushrooms){m.age+=dt;const old=m.y;m.x+=m.vx*dt;m.vy+=700*dt;m.y+=m.vy*dt;
   for(const b of solids)if(overlaps(m,b)){if(m.vy>=0&&old+m.h<=b.y+.5){m.y=b.y-m.h;m.vy=0}else if(m.age>.45){m.x=m.vx>0?b.x-m.w:b.x+b.w;m.vx*=-1}}
   if(m.y+m.h>=FLOOR){m.y=FLOOR-m.h;m.vy=0}if(m.x<0||m.x+m.w>this.width)m.vx*=-1;
   if(m.age>.3&&overlaps(p,m)){this.collected.add(m.project);m.collected=true;this.events.push({type:'collect',project:m.project})}
  }this.mushrooms=this.mushrooms.filter(m=>!m.collected);
 }
 takeEvents(){return this.events.splice(0)}
}
