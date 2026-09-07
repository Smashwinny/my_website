import * as THREE from 'three';
// Shared photographic rock maps. Load after entering this world; never gate movement.
export function mistStoneTextures(onError:()=>void){
 const loader=new THREE.TextureLoader();
 const color=loader.load('/models/mist/rock-color.jpg',undefined,undefined,onError),normal=loader.load('/models/mist/rock-normal.jpg',undefined,undefined,onError);
 color.colorSpace=THREE.SRGBColorSpace;
 for(const texture of [color,normal]){texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(2,2);texture.anisotropy=4}
 return {color,normal};
}
export function weatherCliff(){
 const geometry=new THREE.CylinderGeometry(3.57,.45,5.7,64,16,true),p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),angle=Math.atan2(z,x),depth=(2.85-y)/5.7;const rough=1+depth*(Math.sin(angle*11+y*3)*.12+Math.cos(angle*19-y*2)*.085);p.setXYZ(i,x*rough,y-2.94,z*rough)}geometry.computeVertexNormals();return geometry;
}
export function addMistDetails(root:THREE.Group,index:number,add:(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,x?:number,y?:number,z?:number)=>THREE.Mesh,stone:THREE.MeshStandardMaterial,dark:THREE.Material,bronze:THREE.Material){
 const timber=new THREE.MeshStandardMaterial({color:'#352e24',roughness:1});const tiles=new THREE.MeshStandardMaterial({color:'#4f5047',roughness:.94});const moss=new THREE.MeshStandardMaterial({color:'#454d2f',roughness:1});
 const random=(n:number)=>{const v=Math.sin(n*117.3+index*53.8)*43758.5453;return v-Math.floor(v)};
 // Worn flat stones leave the entire centre line clear for running jumps.
 for(let row=-4;row<=4;row++)for(let col=-3;col<=3;col++){const x=col*.72+(row%2)*.15,z=row*.72;if(Math.hypot(x,z)>3.12)continue;const block=add(new THREE.BoxGeometry(.64+random(row*17+col)*.05,.035,.65),row%3?stone:dark,root,x,.02,z);block.rotation.y=(random(row*7+col)-.5)*.055}
 // Small shrine roofs on the two existing solid pillars. Curved profile with raised eaves.
 for(const side of [-1,1]){
  const shrine=new THREE.Group();shrine.position.set(side*2.6,1.3,.6);root.add(shrine);
  for(const sx of [-1,1])for(const sz of [-1,1])add(new THREE.CylinderGeometry(.025,.032,.45,8),timber,shrine,sx*.19,.23,sz*.19);
  for(let layer=0;layer<2;layer++){
   const width=.66-layer*.18,height=.52+layer*.23;
   for(const slope of [-1,1]){const g=new THREE.PlaneGeometry(width,width*.58,10,6);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++){const z=p.getZ(i);p.setY(i,.12-Math.abs(z)*.5+Math.pow(Math.abs(p.getX(i))/width*2,4)*.085)}g.computeVertexNormals();const roof=add(g,tiles,shrine,0,height,slope*width*.19);roof.rotation.x=slope*.24}
   add(new THREE.CylinderGeometry(.025,.025,width*1.12,8),bronze,shrine,0,height+.13).rotation.z=Math.PI/2;
  }
 }
 // Twisting living pines: roots cling to the outside, branches lean over the void.
 for(const side of [-1,1]){
  const tree=new THREE.Group();tree.position.set(side*3.9,-.25,index%2?.8:-.9);root.add(tree);
  const points=[new THREE.Vector3(0,0,0),new THREE.Vector3(side*.13,.85,.1),new THREE.Vector3(side*.45,1.8,-.1),new THREE.Vector3(side*.2,2.7,.12),new THREE.Vector3(side*.65,3.3,0)];
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.14,8,false),timber,tree);
  for(let j=0;j<6;j++){
   const angle=j*2.4,end=new THREE.Vector3(Math.cos(angle)*(.65+j*.09)+side*.25,1.7+j*.25,Math.sin(angle)*.65);
   add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(side*.2,1.1+j*.25,0),end.clone().multiply(new THREE.Vector3(.6,1,.6)),end]),10,.035,5,false),timber,tree);
   // Fine clusters instead of large cartoon foliage spheres.
   const needles=new THREE.BufferGeometry(),vertices:number[]=[];
   for(let k=0;k<80;k++){const a=random(j*81+k)*Math.PI*2,r=random(j*151+k)*.65,x=end.x+Math.cos(a)*r,z=end.z+Math.sin(a)*r,y=end.y+random(k*17+j)*.16;vertices.push(x,y,z,x+.08*Math.cos(a),y+.11,z+.08*Math.sin(a))}
   needles.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));const needleMat=new THREE.LineBasicMaterial({color:'#323c2b'});tree.add(new THREE.LineSegments(needles,needleMat));
  }
  for(let j=0;j<4;j++)add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,.45,0),new THREE.Vector3(-side*.25,-.25,j*.17),new THREE.Vector3(-side*.5,-1.7,j*.3)]),10,.055,6,false),timber,tree);
 }
 for(let j=0;j<22;j++){const a=j*2.399,r=3.3+random(j)*.17;const rock=add(new THREE.IcosahedronGeometry(.14+random(j+25)*.16,1),j%3?stone:moss,root,Math.cos(a)*r,-.04,Math.sin(a)*r);rock.scale.set(1.2,.35,.8)}
 // The same architectural vocabulary on empty and occupied islands avoids spoilers.
 return {materials:[timber,tiles,moss]};
}
