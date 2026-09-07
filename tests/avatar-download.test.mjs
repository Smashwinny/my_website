import test from 'node:test';import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {downloadAvatar,avatarAsset,preloadAvatar} from '../app/scene/avatar-download.mjs';
test('stream reports received bytes, decompresses and reuses cache',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original});let calls=0;const raw=Buffer.from('real model payload '.repeat(300)),gz=gzipSync(raw);
 globalThis.fetch=async()=>{calls++;return new Response(new ReadableStream({start(c){c.enqueue(gz.subarray(0,10));c.enqueue(gz.subarray(10));c.close()}}),{headers:{'content-length':String(gz.length)}})};
 const events=[];const bytes=await downloadAvatar('/unit-mobile.vrm',p=>events.push({...p}));assert.deepEqual(Buffer.from(bytes),raw);assert(events.some(p=>p.loaded===10&&p.total===gz.length));assert.equal(events.at(-1).phase,'ready');
 await downloadAvatar('/unit-mobile.vrm',()=>{});assert.equal(calls,1);
});
test('missing compressed asset falls back and preloading shares the real transfer',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original});const calls=[];
 globalThis.fetch=async url=>{calls.push(url);return url.endsWith('.bin')?new Response('',{status:404}):new Response(new Uint8Array([4,5,6]))};
 preloadAvatar('/fallback-web.vrm');
 assert.deepEqual(new Uint8Array(await downloadAvatar('/fallback-web.vrm')),new Uint8Array([4,5,6]));
 assert.deepEqual(calls,['/fallback-web.vrm.bin','/fallback-web.vrm']);
});
test('coarse pointer uses the low-memory model without changing custom imports',t=>{
 const original=globalThis.matchMedia;t.after(()=>{globalThis.matchMedia=original});
 globalThis.matchMedia=()=>({matches:true});
 assert.equal(avatarAsset('/models/traveler-web.vrm'),'/models/traveler-lite.vrm');
 assert.equal(avatarAsset('blob:custom'),'blob:custom');
});
test('unknown transfer size stays indeterminate and failures may retry',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original});let calls=0;globalThis.fetch=async()=>{calls++;return calls===1?new Response('',{status:503}):new Response(new Uint8Array([1,2,3]))};
 await assert.rejects(downloadAvatar('/retry.vrm',()=>{}));const events=[];assert.deepEqual(new Uint8Array(await downloadAvatar('/retry.vrm',v=>events.push({...v}))),new Uint8Array([1,2,3]));assert(events.some(p=>p.loaded===3&&p.total===0&&p.phase==='download'));assert.equal(calls,2);
});
