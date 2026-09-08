import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {MonumentJourney,monumentNodes,monumentEdges,nodeById,activeEdges,findMonumentPath,galleryProjects,platformRadius} from '../app/scene/monument-paths.mjs';
import {createMonumentScene} from '../app/scene/monument-scene.mjs';
function finish(journey){for(let i=0;i<2400&&journey.busy;i++)journey.update(1/60);assert.equal(journey.busy,false,'journey must finish');}
function walk(journey,id){assert.equal(journey.moveTo(id),'ok');finish(journey);assert.equal(journey.node,id);assert.deepEqual(journey.position,nodeById(id).position);}

test('bridge connects only the two banks its geometry faces',()=>{
 assert.deepEqual(findMonumentPath('west','east-end',0),['west','west-port','center','east-port','east','east-end']);
 assert.equal(findMonumentPath('west','north',0),null);
 assert.deepEqual(findMonumentPath('north','south',1),['north','north-port','center','south-port','south']);
 assert.equal(findMonumentPath('center','west',1),null);
 assert.deepEqual(activeEdges(2),activeEdges(0));assert.deepEqual(activeEdges(3),activeEdges(1));
 assert.equal(findMonumentPath('missing','west',0),null);
 for(const [a,b]of monumentEdges){assert.ok(nodeById(a));assert.ok(nodeById(b));}
});
test('turning takes time and never enables a half-rotated bridge',()=>{
 const j=new MonumentJourney();walk(j,'center');assert.ok(j.rotate());j.update(.05);assert.equal(j.orientation,0);assert.equal(j.moveTo('north'),'busy');assert.equal(j.rotate(),false);finish(j);assert.equal(j.orientation,1);assert.ok(Math.abs(j.rotation-Math.PI/2)<1e-6);walk(j,'north');
});
test('travel and rotation cannot overlap; reset clears in-flight actions',()=>{
 const j=new MonumentJourney();j.moveTo('center');j.update(.05);assert.equal(j.rotate(),false);assert.equal(j.moveTo('east'),'busy');j.reset();assert.equal(j.busy,false);assert.equal(j.takeArrival(),null);assert.deepEqual(j.position,nodeById('west').position);assert.ok(j.rotate());j.reset();assert.equal(j.orientation,0);assert.equal(j.rotation,0);
});
test('every gallery is reachable and return paths remain open across repeated rotations',()=>{
 const j=new MonumentJourney(),seen=new Set();
 for(const node of monumentNodes.filter(n=>n.gallery!==undefined)){
  // Start each arm from the turntable, rotating the bridge under the traveler.
  const horizontal=node.gallery<4;
  if(!findMonumentPath(j.node,'center',j.orientation)){assert.ok(j.rotate());finish(j)}
  walk(j,'center');if((j.orientation%2===0)!==horizontal){assert.ok(j.rotate());finish(j)}
  walk(j,node.id);assert.equal(j.takeArrival(),node.id);assert.equal(j.takeArrival(),null);seen.add(node.gallery);
 }
 assert.equal(seen.size,8);
});
test('new and empty project collections never lose or duplicate a project',()=>{
 for(const count of [0,1,8,9,17,40]){const assigned=Array.from({length:8},(_,i)=>galleryProjects(i,count)).flat().sort((a,b)=>a-b);assert.deepEqual(assigned,Array.from({length:count},(_,i)=>i));}
});
test('walking follows each authored stair at varied display frame rates',()=>{
 for(const dt of [1/120,1/60,1/20,.2]){
  const j=new MonumentJourney();j.moveTo('east');let peakStep=0,previous=[...j.position];
  for(let i=0;i<2000&&j.busy;i++){j.update(dt);assert.ok(j.position.every(Number.isFinite));peakStep=Math.max(peakStep,Math.abs(previous[1]-j.position[1]));previous=[...j.position];}
  assert.equal(j.node,'east');assert.ok(peakStep<.4,`step rise ${peakStep}`);assert.deepEqual(j.position,nodeById('east').position);
 }
});
test('procedural scene has bounded meshes and releases each owned resource once',()=>{
 const world=createMonumentScene(),j=new MonumentJourney();let meshes=0;const geos=new Set(),mats=new Set();world.scene.traverse(o=>{if(o.isMesh){meshes++;geos.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));}});
 assert.ok(meshes>100&&meshes<220,`mesh count ${meshes}`);assert.equal(world.markers.size,8);
 let releases=0,shadowReleases=0;for(const r of [...geos,...mats])r.addEventListener('dispose',()=>releases++);
 world.scene.traverse(o=>{if(o.isDirectionalLight)o.shadow.map={dispose(){shadowReleases++}}});
 for(let i=0;i<180;i++){if(i===0)j.moveTo('center');j.update(1/60);world.update(j,i/60);world.scene.updateMatrixWorld(true);world.scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));}
 assert.deepEqual(world.traveler.position.toArray(),j.position);world.dispose();world.dispose();assert.equal(releases,geos.size+mats.size);assert.equal(shadowReleases,1);
});
test('stairs finish before the solid upper platform begins',()=>{
 for(const [a,b]of monumentEdges.filter(([a,b])=>nodeById(a).position[1]!==nodeById(b).position[1]))for(const [from,to]of [[a,b],[b,a]]){
  const j=new MonumentJourney();j.node=from;j.position=[...nodeById(from).position];j.moveTo(to);
  while(j.busy){j.update(1/120);for(const id of [from,to]){const platform=nodeById(id),p=platform.position,r=platformRadius(platform);if(Math.abs(j.position[0]-p[0])<r-.001&&Math.abs(j.position[2]-p[2])<r-.001)assert.ok(j.position[1]>=p[1]-.001,`${from}→${to}: inside ${id}`);}}
 }
});
test('five primary touch targets do not overlap on compact phones',()=>{
 const points=monumentNodes.filter(n=>n.id==='center'||n.gallery!==undefined&&n.gallery%2===0);
 for(const [vw,vh]of [[320,568],[375,667],[390,844],[430,932]]){
  const width=vw+44,height=Math.max(vh,640)-387,aspect=width/height,span=Math.max(21,24/aspect),camera=new THREE.OrthographicCamera(-span*aspect/2,span*aspect/2,span/2,-span/2,.1,100);camera.position.set(20,20,24);camera.lookAt(0,2.3,0);camera.updateMatrixWorld();
  const projected=points.map(n=>({id:n.id,p:new THREE.Vector3(...n.position).add(new THREE.Vector3(0,.16,0)).project(camera)}));
  for(let i=0;i<projected.length;i++)for(let k=i+1;k<projected.length;k++){const a=projected[i],b=projected[k],dx=Math.abs(a.p.x-b.p.x)*width/2,dy=Math.abs(a.p.y-b.p.y)*height/2,gap=a.id==='center'||b.id==='center'?47:44;assert.ok(dx>=gap||dy>=gap,`${vw}x${vh} ${a.id}/${b.id}: ${dx}, ${dy}`);}
 }
});
test('gallery click targets stay on screen in desktop and portrait framing',()=>{
 for(const [width,height] of [[1200,700],[434,410],[364,232],[780,310]]){
  const aspect=width/height,span=Math.max(21,24/aspect),camera=new THREE.OrthographicCamera(-span*aspect/2,span*aspect/2,span/2,-span/2,.1,100);camera.position.set(20,20,24);camera.lookAt(0,2.3,0);camera.updateMatrixWorld();
  for(const n of monumentNodes){const p=new THREE.Vector3(...n.position).project(camera);assert.ok(Math.abs(p.x)<.9&&Math.abs(p.y)<.9,`${n.id} outside ${width}x${height}`);}
 }
});
test('monument is lazy loaded and does not preload character models',async()=>{
 const styles=await readFile('app/scene/world-styles.ts','utf8'),view=await readFile('app/world-view.tsx','utf8'),page=await readFile('app/page.tsx','utf8'),scene=await readFile('app/monument-world.tsx','utf8');
 assert.match(styles,/id:'monument',name:'回声之庭'/);assert.match(view,/monument:lazy\(\(\)=>import\('\.\/monument-world'\)\)/);assert.doesNotMatch(scene,/loadCharacter|loadAvatar|preloadAvatar/);assert.match(page,/if\(next==='garden'\|\|next==='mist'\)preloadAvatar/);assert.match(page,/!\['elements','mario','monument'\]\.includes\(style\)/);
});
