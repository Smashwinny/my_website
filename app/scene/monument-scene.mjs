import * as THREE from 'three';
import {monumentNodes,monumentEdges,nodeById,stairSpec} from './monument-paths.mjs';

export function createMonumentScene(){
 const scene=new THREE.Scene(),geometries=new Set(),materials=new Set();
 const material=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.88,...extra});materials.add(m);return m};
 const cream=material('#fff0d8'),rose=material('#db8793'),lightRose=material('#f5b7b4'),teal=material('#5b9c9d'),dark=material('#346c76'),gold=material('#e6b674',{metalness:.22}),ink=material('#233e50'),white=material('#fff9e9');
 const mesh=(geometry,mat,parent=scene)=>{geometries.add(geometry);const m=new THREE.Mesh(geometry,mat);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m};
 const box=(x,y,z,w,h,d,mat,parent=scene)=>{const m=mesh(new THREE.BoxGeometry(w,h,d),mat,parent);m.position.set(x,y,z);return m};
 const cylinder=(x,y,z,r,h,mat,parent=scene)=>{const m=mesh(new THREE.CylinderGeometry(r,r,h,32),mat,parent);m.position.set(x,y,z);return m};
 scene.add(new THREE.HemisphereLight('#fff4e2','#54828e',2.5));
 const sun=new THREE.DirectionalLight('#ffe4c7',3.4);sun.position.set(-10,22,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:1,far:60});sun.shadow.bias=-.0005;sun.shadow.normalBias=.03;scene.add(sun);
 const floor=box(0,-3.3,0,200,.3,200,material('#92b8bd'));floor.castShadow=false;
 const plinth=box(0,-2.95,0,15.8,.5,15.8,teal);plinth.rotation.y=Math.PI/4;
 const pool=box(0,-2.64,0,13.9,.06,13.9,material('#79afb8',{roughness:.32,metalness:.15}));pool.rotation.y=Math.PI/4;
 const armMaterial=node=>node.position[0]>3?lightRose:node.position[2]>3?teal:cream;
 const markers=new Map();
 for(const node of monumentNodes){
  if(node.id==='center')continue;
  const [x,y,z]=node.position,port=node.gallery===undefined,size=port?1.35:2.05,mat=armMaterial(node);
  box(x,(y-2.45)/2,z,size,y+2.45,size,mat);
  box(x,y-.08,z,size+.2,.16,size+.2,mat);
  box(x,y-.38,z,size+.12,.1,size+.12,gold);
  if(!port){
   box(x,y+.015,z,1.35,.035,1.35,mat===teal?cream:lightRose);
   const ring=mesh(new THREE.TorusGeometry(.29,.025,6,32),gold);ring.rotation.x=-Math.PI/2;ring.position.set(x,y+.06,z);markers.set(node.id,ring);
   // Recessed-looking openings on the outward faces of the solid tower.
   for(const offset of [-.46,.46])box(x+offset,y-1.45,z+size/2+.008,.24,.68,.025,dark);
  }
 }
 for(const [from,to] of monumentEdges){
  const a=nodeById(from).position,b=nodeById(to).position,dx=b[0]-a[0],dz=b[2]-a[2],rise=Math.abs(b[1]-a[1]);
  if(!rise){box((a[0]+b[0])/2,a[1]-.18,(a[2]+b[2])/2,Math.abs(dx)+1.25,.36,Math.abs(dz)+1.25,armMaterial(nodeById(from)));continue;}
  const stairs=stairSpec(nodeById(from),nodeById(to)),low=stairs.low.position,steps=stairs.risers,run=stairs.end-stairs.start;
  for(let i=0;i<steps;i++){
   const distance=stairs.start+(i+.5)/steps*run,y=low[1]+(i+1)/steps*rise;
   box(low[0]+stairs.direction[0]*distance,y-.24,low[2]+stairs.direction[2]*distance,dx?run/steps+.01:1.25,.48,dz?run/steps+.01:1.25,cream);
  }
 }
 // Real rotating bridge, with clear endpoint bands and a visible brass axle.
 cylinder(0,.1,0,.8,5.2,rose);cylinder(0,2.7,0,1.02,.28,gold);
 const bridge=new THREE.Group();bridge.position.y=3;scene.add(bridge);
 box(0,-.2,0,8.15,.4,1.13,cream,bridge);box(0,-.02,0,8.12,.035,.22,lightRose,bridge);
 for(const x of [-3.7,3.7])box(x,.015,0,.25,.055,1.14,gold,bridge);
 cylinder(0,-.06,0,.6,.16,lightRose,bridge);
 // Gate arch: extruded semicircular masonry, open in the middle.
 function arch(x,y,z,mat,rotation=0){
  const root=new THREE.Group();root.position.set(x,y,z);root.rotation.y=rotation;scene.add(root);
  box(-.72,.8,0,.28,1.6,.32,mat,root);box(.72,.8,0,.28,1.6,.32,mat,root);
  const shape=new THREE.Shape();shape.absarc(0,1.6,.86,0,Math.PI,false);shape.lineTo(-.58,1.6);shape.absarc(0,1.6,.58,Math.PI,0,true);shape.closePath();
  const crown=mesh(new THREE.ExtrudeGeometry(shape,{depth:.32,bevelEnabled:false,curveSegments:24}),mat,root);crown.position.z=-.16;
  box(0,2.55,0,1.9,.16,.55,mat,root);return root;
 }
 arch(7.6,5,-3.45,rose);arch(-3,6,-8.1,cream);arch(3,1,8.05,cream);
 // Open colonnade on the high tower, leaving its walkway unblocked.
 for(const x of [-.8,.8])for(const z of [-8.4,-6.8])cylinder(x,7.1,z,.12,2.2,cream);
 box(0,8.25,-7.6,2.4,.25,2.4,cream);box(0,8.44,-7.6,1.95,.14,1.95,lightRose);
 const roof=mesh(new THREE.ConeGeometry(1.42,.8,4),gold);roof.position.set(0,8.9,-7.6);roof.rotation.y=Math.PI/4;
 const finial=mesh(new THREE.SphereGeometry(.14,12,8),gold);finial.position.set(0,9.43,-7.6);
 // Small topiary silhouettes frame, rather than obstruct, the routes.
 for(const [x,y,z]of [[-8.4,1,3.6],[3.7,1,8.1],[8.4,5,.55]]){box(x,y+.14,z,.48,.28,.48,cream);cylinder(x,y+.65,z,.035,1,gold);const tree=mesh(new THREE.SphereGeometry(.38,12,10),dark);tree.scale.set(.75,1.65,.75);tree.position.set(x,y+1.2,z);}
 const traveler=new THREE.Group();scene.add(traveler);
 const robe=mesh(new THREE.CylinderGeometry(.13,.3,.55,8),rose,traveler);robe.position.y=.42;
 const head=mesh(new THREE.SphereGeometry(.15,16,12),white,traveler);head.position.set(0,.84,0);
 const hood=mesh(new THREE.ConeGeometry(.22,.22,8),ink,traveler);hood.position.y=1.04;
 const face=mesh(new THREE.SphereGeometry(.025,8,6),gold,traveler);face.position.set(0,.85,.145);
 const feet=[-.095,.095].map(x=>{const m=box(x,.085,0,.1,.17,.2,ink,traveler);return m});
 const glow=mesh(new THREE.TorusGeometry(.4,.018,6,32),white,traveler);glow.rotation.x=-Math.PI/2;glow.position.y=.025;
 const rings=[];for(let i=0;i<3;i++){const r=mesh(new THREE.TorusGeometry(1.8+i*.7,.008,4,80),material('#b1d4d2',{transparent:true,opacity:.45}));r.rotation.x=-Math.PI/2;r.position.set(0,-2.59,0);r.castShadow=false;rings.push(r);}
 let disposed=false;
 return {scene,bridge,traveler,markers,
  update(journey,time){bridge.rotation.y=journey.rotation;traveler.position.set(...journey.position);traveler.rotation.y=journey.facing;robe.position.y=.42+(journey.moving?Math.sin(journey.walked*9)*.02:0);feet.forEach((foot,i)=>{foot.position.z=journey.moving?Math.sin(journey.walked*9+i*Math.PI)*.13:0});rings.forEach((ring,i)=>ring.material.opacity=.22+Math.sin(time*.6+i)*.08)},
  dispose(){if(disposed)return;disposed=true;sun.shadow.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());},
 };
}
