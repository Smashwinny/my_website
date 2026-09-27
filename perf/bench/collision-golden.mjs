import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {rolldown} from 'rolldown';
import * as THREE from 'three';
import {createCollisionWorld,PlayerController} from '../../app/scene/physics.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));

const source=(await readFile('app/world.tsx','utf8')).replace(/\s+/g,'');
const start=source.indexOf('constloading='),end=source.indexOf('Promise.allSettled(loading)');
assert(start>=0&&end>start);
const earlySource=source.slice(start,end),lateSource=source.slice(end,source.indexOf('constkeys=',end));
assert.match(earlySource,/if\(disposed\)\{[^}]*return\}/);
assert(earlySource.includes('collisionRoot.add(value.collisionRoot);collisionWorld=createCollisionWorld(collisionRoot)'));
assert(!earlySource.includes('newPlayerController('));
assert(!lateSource.includes('createCollisionWorld('));
assert(lateSource.includes('newPlayerController(collisionWorld,player.position)'));
assert(lateSource.includes('ready=true;setProgress(100);voidloadCompanion()'));
assert.equal([...source.matchAll(/collisionWorld=createCollisionWorld\(collisionRoot\)/g)].length,1);
for(const recipe of ['newTHREE.CylinderGeometry(.75-l*.08,.79-l*.08,.14,48)','newTHREE.CylinderGeometry(.37,.48,.85,32)','newTHREE.CylinderGeometry(.68,.56,.16,48)'])assert(source.includes(recipe),'Update exhibit golden fixture if geometry changes');
const projects=JSON.parse(await readFile('data/projects.json','utf8'));assert.equal(projects.length,8);
const bundle=await rolldown({input:'app/scene/environment.ts',platform:'node',external:id=>id==='three'||id.startsWith('three/')});
let code;try{const {output}=await bundle.generate({format:'esm'});code=output[0].code.replace(/from\s+(['"])([^'"]+)\1/g,(_,q,id)=>`from ${JSON.stringify(import.meta.resolve(id))}`)}finally{await bundle.close()}
const {buildEnvironment,exhibitPosition,groundHeight}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const scene=new THREE.Scene(),player=new THREE.Group(),companion=new THREE.Group();
player.position.set(0,groundHeight(0,7.5),7.5);scene.add(player,companion);
const collisionRoot=new THREE.Group(),material=new THREE.MeshBasicMaterial();
for(let index=0;index<projects.length;index++){
 const stand=new THREE.Group();stand.position.copy(exhibitPosition(index,projects.length));scene.add(stand);
 for(let l=0;l<3;l++){const m=new THREE.Mesh(new THREE.CylinderGeometry(.75-l*.08,.79-l*.08,.14,48),material);m.position.y=l*.14+.07;stand.add(m)}
 for(const [g,y] of [[new THREE.CylinderGeometry(.37,.48,.85,32),.83],[new THREE.CylinderGeometry(.68,.56,.16,48),1.34]]){const m=new THREE.Mesh(g,material);m.position.y=y;stand.add(m)}
 stand.updateMatrixWorld(true);stand.traverse(o=>{if(!o.isMesh)return;const proxy=new THREE.Mesh(o.geometry,o.material);proxy.matrix.copy(o.matrixWorld);proxy.matrixAutoUpdate=false;collisionRoot.add(proxy)});
}
const environment=await buildEnvironment(scene,()=>{});collisionRoot.add(environment.collisionRoot);
const early=createCollisionWorld(collisionRoot);
// Player attachment and render-matrix updates never mutate the collision branch.
player.add(new THREE.Group());scene.updateMatrixWorld(true);
const late=createCollisionWorld(collisionRoot);
function signature(tree){
 const hash=createHash('sha256');let nodes=0,triangleReferences=0;
 function visit(node){nodes++;hash.update(JSON.stringify([node.box?.min.toArray(),node.box?.max.toArray(),node.triangles.length,node.subTrees.length]));for(const t of node.triangles){triangleReferences++;hash.update(JSON.stringify([t.a.toArray(),t.b.toArray(),t.c.toArray()]))}node.subTrees.forEach(visit)}
 visit(tree);return {hash:hash.digest('hex'),nodes,triangleReferences};
}
const expected={hash:'97700b027d2b60d2cd1b7184e2aa73c029d3b1ef8ff8def02fd59a10c68fb0e0',nodes:138983,triangleReferences:534838};
assert.deepEqual(signature(early),expected);assert.deepEqual(signature(late),expected);
const a=new PlayerController(early,player.position),b=new PlayerController(late,player.position),direction=new THREE.Vector3();
for(let frame=0;frame<480;frame++){
 direction.set(Math.sin(frame/90),0,Math.cos(frame/90)).normalize();if(frame%120===0){a.requestJump();b.requestJump()}
 a.update(1/60,direction);b.update(1/60,direction);
 assert.deepEqual(a.position.toArray(),b.position.toArray(),`position ${frame}`);assert.deepEqual(a.velocity.toArray(),b.velocity.toArray(),`velocity ${frame}`);assert.equal(a.grounded,b.grounded);
}
environment.dispose();console.log(JSON.stringify({scope:'scheduling, complete collision tree, 480 controller frames',golden:expected,frames:480,passed:true},null,2));
