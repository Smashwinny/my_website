export async function POST(request:Request){
 const url=process.env.COMPANION_BRIDGE_URL, bridgeToken=process.env.COMPANION_BRIDGE_TOKEN, visitorToken=process.env.COMPANION_VISITOR_TOKEN;
 const respond=(error:string,status:number)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
 if(!url||!bridgeToken||!visitorToken)return respond('向导还没连接本机 Codex，请站主先配置连接服务。',503);
 if(request.headers.get('authorization')!==`Bearer ${visitorToken}`)return respond('请在连接设置中填写站主提供的访问口令。',401);
 if(Number(request.headers.get('content-length')||0)>24000)return respond('消息过长。',413);
 try{
 const text=await request.text();if(new TextEncoder().encode(text).length>24000)return respond('消息过长。',413);
 const data=JSON.parse(text);
 if(!data||data.worldStyle!==undefined&&!['garden','mist','elements','mario','monument'].includes(data.worldStyle))return respond('主题格式错误。',400);
 if(data.discoveredProjects!==undefined&&(!Array.isArray(data.discoveredProjects)||data.discoveredProjects.length>100||data.discoveredProjects.some((name:unknown)=>typeof name!=='string'||name.length>200)))return respond('发现手记格式错误。',400);
 if(!Array.isArray(data.messages)||data.messages.length<1||data.messages.length>12||data.messages.some((m:Record<string,unknown>)=>!m||!['user','assistant'].includes(String(m.role))||typeof m.content!=='string'||m.content.length>4000))return respond('消息格式错误。',400);
 // Workers supports manual redirects. Reject non-2xx responses below without
 // following a redirect or forwarding the bridge credential to another host.
 const upstream=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${bridgeToken}`},body:JSON.stringify({messages:data.messages,discoveredProjects:data.discoveredProjects,worldStyle:data.worldStyle}),signal:AbortSignal.timeout(105000),redirect:'manual'});
 if(!upstream.ok)return respond(upstream.status===429?`${data.worldStyle==='elements'?'小浩':Array.isArray(data.discoveredProjects)?'小津':'小齐'}正在回答其他问题，请稍后重试。`:'本机 Codex 暂时不可用，请稍后重试。',upstream.status===429?429:502);
 const reply=await upstream.json() as {reply?:unknown};if(typeof reply.reply!=='string')return respond('连接服务返回格式错误。',502);
 return Response.json({reply:reply.reply},{headers:{'Cache-Control':'no-store'}});
 }catch(error){console.error('Companion proxy error:',error instanceof Error?error.message:'unknown');return respond('连接本机 Codex 失败，请检查连接服务。',502)}
}
