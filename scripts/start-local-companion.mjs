import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
process.loadEnvFile('.env');
await mkdir('tmp/companion',{recursive:true});
const children=new Set();let stopping=false,ready=false;
function child(binary,args,options={}){
 const p=spawn(binary,args,{cwd:root,env:process.env,stdio:['ignore','inherit','inherit'],...options});
 children.add(p);p.on('error',()=>stop(1));p.on('exit',()=>{children.delete(p);if(!stopping)stop(1)});return p;
}
function stop(code=0){if(stopping)return;stopping=true;for(const p of children)p.kill('SIGTERM');setTimeout(()=>process.exit(code),1500).unref()}
process.on('SIGTERM',()=>stop());process.on('SIGINT',()=>stop());
const bridge=child(process.execPath,['bridge/server.mjs']);
// Wait for the loopback server before requesting a public tunnel.
for(let attempt=0;attempt<30;attempt++){
 try{const r=await fetch(`http://127.0.0.1:${process.env.COMPANION_PORT||8788}/health`);if(r.ok){ready=true;break}}catch{}
 await new Promise(r=>setTimeout(r,200));
}
if(!ready){stop(1);throw Error('Bridge did not start')}
const tunnel=child(process.env.COMPANION_CLOUDFLARED||'cloudflared',['tunnel','--url',`http://127.0.0.1:${process.env.COMPANION_PORT||8788}`,'--no-autoupdate'],{stdio:['ignore','ignore','pipe']});
let output='',published=false;
tunnel.stderr.on('data',async chunk=>{
 output=(output+chunk.toString()).slice(-16000);
 const url=output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
 if(!url||published)return;published=true;
 const env={...process.env,XDG_CONFIG_HOME:path.join(root,'tmp/cloudflare-config'),WRANGLER_LOG_PATH:path.join(root,'tmp/wrangler.log'),WRANGLER_SEND_METRICS:'false'};
 const upload=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','bulk','--name','geniusqi-world','--config','wrangler.production.json'],{cwd:root,env,stdio:['pipe','inherit','inherit']});
 upload.stdin.on('error',()=>{});
 upload.stdin.end(JSON.stringify({COMPANION_BRIDGE_URL:url+'/chat',COMPANION_BRIDGE_TOKEN:process.env.COMPANION_BRIDGE_TOKEN,COMPANION_VISITOR_TOKEN:process.env.COMPANION_VISITOR_TOKEN}));
 upload.on('error',()=>stop(1));
 upload.on('exit',async code=>{if(code!==0)return stop(1);await writeFile('tmp/companion-runtime.json',JSON.stringify({bridgeURL:url,updatedAt:new Date().toISOString()},null,2),{mode:0o600});console.log('Xiaoqi bridge connected to Cloudflare Worker');});
});
setTimeout(()=>{if(!published)stop(1)},90000).unref();
