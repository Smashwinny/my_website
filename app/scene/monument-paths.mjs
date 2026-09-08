// A small navigable architectural graph. Geometry and pathfinding share these
// coordinates so a visual bridge can never disagree with its walkable route.
export const monumentNodes=[
 {id:'west',name:'启程台',position:[-7.6,1,0],gallery:0},
 {id:'west-end',name:'日晷庭',position:[-7.6,1,3],gallery:1},
 {id:'west-port',name:'西阶',position:[-3.8,3,0]},
 {id:'center',name:'回转之心',position:[0,3,0]},
 {id:'east-port',name:'东阶',position:[3.8,3,0]},
 {id:'east',name:'绯色拱廊',position:[7.6,5,0],gallery:2},
 {id:'east-end',name:'风之门',position:[7.6,5,-3],gallery:3},
 {id:'north-port',name:'北阶',position:[0,3,-3.8]},
 {id:'north',name:'月白高塔',position:[0,6,-7.6],gallery:4},
 {id:'north-end',name:'云端书室',position:[-3,6,-7.6],gallery:5},
 {id:'south-port',name:'南阶',position:[0,3,3.8]},
 {id:'south',name:'碧水庭',position:[0,1,7.6],gallery:6},
 {id:'south-end',name:'回声藏室',position:[3,1,7.6],gallery:7},
];
export const monumentEdges=[
 ['west','west-end'],['west','west-port'],['east-port','east'],['east','east-end'],
 ['north-port','north'],['north','north-end'],['south-port','south'],['south','south-end'],
];
export const nodeById=id=>monumentNodes.find(node=>node.id===id);
export const platformRadius=node=>node.gallery===undefined?.775:1.125;
export function stairSpec(a,b){
 const low=a.position[1]<b.position[1]?a:b,high=low===a?b:a;
 const length=Math.hypot(high.position[0]-low.position[0],high.position[2]-low.position[2]);
 const direction=[(high.position[0]-low.position[0])/length,0,(high.position[2]-low.position[2])/length];
 return {low,high,length,start:platformRadius(low),end:length-platformRadius(high),direction,risers:Math.ceil((high.position[1]-low.position[1])/.18)};
}
export function activeEdges(orientation){return [...monumentEdges,...(orientation%2===0?['west-port','east-port']:['north-port','south-port']).map(id=>['center',id])];}
export function findMonumentPath(from,to,orientation){
 if(!nodeById(from)||!nodeById(to))return null;
 const queue=[[from]],seen=new Set([from]),edges=activeEdges(orientation);
 for(let i=0;i<queue.length;i++){
  const path=queue[i],last=path.at(-1);if(last===to)return path;
  for(const [a,b] of edges){const next=a===last?b:b===last?a:null;if(next&&!seen.has(next)){seen.add(next);queue.push([...path,next])}}
 }
 return null;
}
export function galleryProjects(gallery,count){return Array.from({length:count},(_,i)=>i).filter(i=>i%8===gallery);}
export class MonumentJourney{
 constructor(){this.reset()}
 reset(){this.node='west';this.position=[...nodeById('west').position];this.orientation=0;this.rotation=0;this.rotationFrom=0;this.rotationTime=0;this.rotating=false;this.route=[];this.segment=null;this.arrival=null;this.walked=0;this.facing=0}
 get moving(){return this.segment!==null||this.route.length>0}
 get busy(){return Boolean(this.moving||this.rotating)}
 moveTo(id){
  if(this.busy)return 'busy';const route=findMonumentPath(this.node,id,this.orientation);if(!route)return 'blocked';
  this.arrival=null;this.route=route.slice(1);if(!this.route.length)this.arrival=id;return 'ok';
 }
 rotate(){if(this.busy)return false;this.arrival=null;this.rotating=true;this.rotationTime=0;this.rotationFrom=this.rotation;return true;}
 update(delta){
  const dt=Math.max(0,Math.min(delta,.05));
  if(this.rotating){this.rotationTime+=dt;const t=Math.min(1,this.rotationTime/.75);this.rotation=this.rotationFrom+(t*t*(3-2*t))*Math.PI/2;if(t===1){this.rotating=false;this.orientation=(this.orientation+1)%4}return;}
  if(!this.segment&&this.route.length){const to=this.route.shift(),target=nodeById(to).position;this.segment={from:[...this.position],fromId:this.node,to,target,t:0,duration:Math.hypot(...target.map((n,i)=>n-this.position[i]))/3.8};this.facing=Math.atan2(target[0]-this.position[0],target[2]-this.position[2]);}
  if(!this.segment)return;const step=this.segment;step.t=Math.min(1,step.t+dt/step.duration);this.walked+=dt*3.8;
  this.position=step.from.map((n,i)=>n+(step.target[i]-n)*step.t);
  // Match the discrete risers used by the scene's staircase mesh.
  const rise=step.target[1]-step.from[1];if(rise){const stairs=stairSpec(nodeById(step.fromId),nodeById(step.to)),distance=(rise>0?step.t:1-step.t)*stairs.length,progress=Math.max(0,Math.min(1,(distance-stairs.start)/(stairs.end-stairs.start)));this.position[1]=stairs.low.position[1]+Math.ceil(progress*stairs.risers)*Math.abs(rise)/stairs.risers;}
  if(step.t===1){this.node=step.to;this.position=[...step.target];this.segment=null;if(!this.route.length)this.arrival=this.node;}
 }
 takeArrival(){const arrival=this.arrival;this.arrival=null;return arrival;}
}
