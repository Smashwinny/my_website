import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Group,Mesh,BoxGeometry} from 'three';
import {PlayerController,createCollisionWorld} from '../app/scene/physics.mjs';
import {MistController} from '../app/scene/mist-physics.mjs';

const still=new Vector3(),backward=new Vector3(0,0,1),dt=1/120;
function advance(body,seconds,direction=still){for(let i=0;i<Math.round(seconds/dt);i++)body.update(dt,direction)}
function garden(){
 const group=new Group(),floor=new Mesh(new BoxGeometry(50,.2,50)),platform=new Mesh(new BoxGeometry(5,4,5));
 floor.position.y=-.1;platform.position.y=2;group.add(floor,platform);
 const body=new PlayerController(createCollisionWorld(group),new Vector3(0,4,0));advance(body,.1);return body;
}
function land(body){for(let i=0;i<600&&!body.grounded;i++)body.update(dt,still);assert.ok(body.grounded,'must land');assert.equal(body.jumpsUsed,0)}

for(const [name,create,impulse,apex] of [['garden',garden,8,1.85],['mist',()=>new MistController(),9,2.5]]){
 test(`${name}: higher first jump does not automatically fire the second`,()=>{
  const body=create(),origin=body.position.y;body.requestJump();let height=0;
  for(let i=0;i<180;i++){body.update(dt,still);height=Math.max(height,body.position.y-origin);assert.ok(body.jumpsUsed<=1)}
  assert.ok(Math.abs(height-apex)<.1,`height ${height}`);assert.ok(body.grounded);
 });
 test(`${name}: second press at apex boosts height and third press is rejected`,()=>{
  const body=create(),origin=body.position.y;body.requestJump();body.update(dt,still);
  while(body.velocity.y>0)body.update(dt,still);
  const first=body.position.y;body.requestJump();body.update(dt,still);
  assert.equal(body.jumpsUsed,2);assert.ok(body.velocity.y>impulse-.2);
  const velocity=body.velocity.y;body.requestJump();body.update(dt,still);
  assert.ok(body.velocity.y<velocity);assert.equal(body.jumpsUsed,2);
  let peak=body.position.y;for(let i=0;i<180;i++){body.update(dt,still);peak=Math.max(peak,body.position.y)}
  assert.ok(peak-first>apex-.15);assert.ok(peak-origin>apex*1.8);land(body);
  body.requestJump();body.update(dt,still);assert.equal(body.jumpsUsed,1);assert.ok(body.velocity.y>impulse-.2);
  body.requestJump();body.update(dt,still);assert.equal(body.jumpsUsed,2);
 });
 test(`${name}: double jump reverses a fall instead of adding to downward velocity`,()=>{
  const body=create();body.requestJump();advance(body,.7);assert.ok(body.velocity.y<0);
  body.requestJump();body.update(dt,still);assert.ok(body.velocity.y>impulse-.2);assert.equal(body.jumpsUsed,2);land(body);
 });
 test(`${name}: coyote jump preserves the second jump`,()=>{
  const body=create();for(let i=0;i<300&&body.grounded;i++)body.update(dt,backward);
  assert.equal(body.grounded,false);assert.ok(body.coyote>0);
  body.requestJump();body.update(dt,still);assert.equal(body.jumpsUsed,1);
  body.requestJump();body.update(dt,still);assert.equal(body.jumpsUsed,2);assert.ok(body.velocity.y>0);
 });
 test(`${name}: walking off a ledge leaves one rescue jump after grace expires`,()=>{
  const body=create();for(let i=0;i<300&&body.grounded;i++)body.update(dt,backward);
  advance(body,.14,backward);assert.equal(body.grounded,false);assert.equal(body.coyote,0);
  body.requestJump();body.update(dt,still);assert.equal(body.jumpsUsed,2);assert.ok(body.velocity.y>impulse-.2);
  const velocity=body.velocity.y;body.requestJump();body.update(dt,still);assert.ok(body.velocity.y<velocity);
 });
 test(`${name}: rejected third presses do not buffer an automatic jump on landing`,()=>{
  const body=create();body.requestJump();advance(body,.2);body.requestJump();body.update(dt,still);
  for(let i=0;i<600&&!body.grounded;i++){body.requestJump();body.update(dt,still)}
  assert.ok(body.grounded);advance(body,.2);assert.ok(body.grounded);assert.equal(body.jumpsUsed,0);
 });
 test(`${name}: reset restores jumping after both jumps were used`,()=>{
  const body=create(),origin=body.position.clone();body.requestJump();advance(body,.2);body.requestJump();body.update(dt,still);
  body.reset(origin);advance(body,.1);assert.equal(body.jumpsUsed,0);assert.ok(body.grounded);
  body.requestJump();body.update(dt,still);assert.equal(body.jumpsUsed,1);
  body.requestJump();body.update(dt,still);assert.equal(body.jumpsUsed,2);
 });
 test(`${name}: long display frames retain the two-jump limit`,()=>{
  const body=create();body.requestJump();body.update(.08,still);body.requestJump();body.update(.08,still);
  const velocity=body.velocity.y;body.requestJump();body.update(.08,still);assert.ok(body.velocity.y<velocity);assert.equal(body.jumpsUsed,2);land(body);
 });
}

test('garden: ceiling contact does not recharge the air jump',()=>{
 const group=new Group(),floor=new Mesh(new BoxGeometry(50,.2,50)),ceiling=new Mesh(new BoxGeometry(8,.2,8));
 floor.position.y=-.1;ceiling.position.y=3.4;group.add(floor,ceiling);
 const body=new PlayerController(createCollisionWorld(group),new Vector3());advance(body,.1);body.requestJump();body.update(dt,still);
 for(let i=0;i<60&&body.velocity.y>=0;i++){body.update(dt,still);if(body.velocity.y===0)break}
 assert.equal(body.grounded,false);assert.equal(body.jumpsUsed,1);
 body.requestJump();body.update(dt,still);assert.equal(body.jumpsUsed,2);assert.ok(body.position.y+body.height<=3.301);
 body.requestJump();body.update(dt,still);assert.equal(body.jumpsUsed,2);assert.ok(body.velocity.y<=0);land(body);
});
