import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const code=stripTypeScriptTypes(await readFile(new URL('../app/api/chat/route.ts',import.meta.url),'utf8'));
const {POST}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
function setup(t,replies){
 const original=globalThis.fetch,env={};for(const [key,value]of Object.entries({COMPANION_BRIDGE_URL:'https://bridge.example/chat',COMPANION_BRIDGE_TOKEN:'test-bridge-token',COMPANION_VISITOR_TOKEN:'test-visitor-token'})){env[key]=process.env[key];process.env[key]=value;}
 const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,...options,body:JSON.parse(options.body)});const [status,data]=replies.shift();return Response.json(data,{status});};
 t.after(()=>{globalThis.fetch=original;for(const [key,value]of Object.entries(env)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});return calls;
}
const request=(style,token='test-visitor-token')=>new Request('https://site.example/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({worldStyle:style,messages:[{role:'user',content:'介绍作品'}]})});
test('new theme falls back to general project chat only for the older bridge style rejection',async t=>{
 const calls=setup(t,[[400,{error:'Invalid world style'}],[200,{reply:'项目资料'}]]),response=await POST(request('monument'));
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{reply:'项目资料'});assert.equal(calls.length,2);assert.equal(calls[0].body.worldStyle,'monument');assert.equal(calls[1].body.worldStyle,undefined);assert.deepEqual(calls[1].body.messages,calls[0].body.messages);
 for(const c of calls){assert.equal(c.url,'https://bridge.example/chat');assert.equal(c.redirect,'manual');assert.equal(c.headers.Authorization,'Bearer test-bridge-token');}assert.equal(calls[0].signal,calls[1].signal);
});
test('updated bridge receives monument context without retry',async t=>{const calls=setup(t,[[200,{reply:'转动桥梁'}]]);assert.equal((await POST(request('monument'))).status,200);assert.equal(calls.length,1);assert.equal(calls[0].body.worldStyle,'monument');});
test('unrelated validation errors and denied visitors never trigger fallback',async t=>{const calls=setup(t,[[400,{error:'Invalid messages'}]]);assert.equal((await POST(request('monument','wrong'))).status,401);assert.equal(calls.length,0);assert.equal((await POST(request('monument'))).status,502);assert.equal(calls.length,1);});
