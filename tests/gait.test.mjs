import test from 'node:test';
import assert from 'node:assert/strict';
import {gaitParameters,sampleFoot} from '../app/scene/gait.mjs';
test('foot trajectory has zero world velocity at both contacts',()=>{
 for(const speed of [1,3.1,4.4]){
  const g=gaitParameters(speed),eps=1e-6;
  for(const phase of [0,g.stance]){
   const left=sampleFoot(phase-eps,g),right=sampleFoot(phase+eps,g);
   assert(Math.abs(left.z-right.z)<.00001);
   assert(Math.abs((right.z-left.z)/(eps*2)+g.stride)<.0001);
   assert(Math.abs((right.y-left.y)/(eps*2))<.0001);
  }
  for(let p=0;p<1;p+=.001){const f=sampleFoot(p,g);assert(f.y>=0&&f.y<=g.lift+.00001);}
 }
});
