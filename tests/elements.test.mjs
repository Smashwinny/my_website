import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cycleProject,swipeDirection,projectElement} from '../app/scene/elements.mjs';
import {companionPrompt} from '../bridge/server.mjs';
test('swipe distinguishes horizontal intention from taps and vertical scrolling',()=>{assert.equal(swipeDirection(-100,10),1);assert.equal(swipeDirection(80,5),-1);assert.equal(swipeDirection(15,0),0);assert.equal(swipeDirection(60,100),0)});
test('project carousel reaches every project and wraps both ways',async()=>{const projects=JSON.parse(await readFile('data/projects.json','utf8'));const seen=new Set();let i=0;for(let step=0;step<projects.length;step++){seen.add(i);i=cycleProject(i,1,projects.length)}assert.equal(seen.size,projects.length);assert.equal(i,0);assert.equal(cycleProject(0,-1,projects.length),projects.length-1);assert.equal(cycleProject(0,1,0),0);assert.equal(new Set(projects.map(p=>projectElement(p.name).id)).size,3)});
test('element guide is Xiaohao while existing guide identities remain intact',()=>{assert.match(companionPrompt([],[],undefined,'elements'),/向导小浩/);assert.match(companionPrompt([],[],[],'mist'),/向导小津/);assert.match(companionPrompt([],[],undefined,'garden'),/向导小齐/)});
