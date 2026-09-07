export async function POST(request:Request){
 const url=process.env.COMPANION_BRIDGE_URL, bridgeToken=process.env.COMPANION_BRIDGE_TOKEN, visitorToken=process.env.COMPANION_VISITOR_TOKEN;
 const respond=(error:string,status:number)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
 if(!url||!bridgeToken||!visitorToken)return respond('小齐还没连接本机 Codex，请站主先配置连接服务。',503);
 if(request.headers.get('authorization')!==`Bearer ${visitorToken}`)return respond('请在连接设置中填写站主提供的访问口令。',401);
 if(Number(request.headers.get('content-length')||0)>24000)return respond('消息过长。',413);
 try{
 const text=await request.text();if(new TextEncoder().encode(text).length>24000)return respond('消息过长。',413);
 const data=JSON.parse(text);
 if(!Array.isArray(data.messages)||data.messages.length<1||data.messages.length>12||data.messages.some((m:Record<string,unknown>)=>!m||!['user','assistant'].includes(String(m.role))||typeof m.content!=='string'||m.content.length>4000))return respond('消息格式错误。',400);
 const upstream=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${bridgeToken}`},body:JSON.stringify({messages:data.messages}),signal:AbortSignal.timeout(105000),redirect:'error'});
 if(!upstream.ok)return respond(upstream.status===429?'小齐正在回答其他问题，请稍后重试。':'本机 Codex 暂时不可用，请稍后重试。',upstream.status===429?429:502);
 const reply=await upstream.json() as {reply?:unknown};if(typeof reply.reply!=='string')return respond('连接服务返回格式错误。',502);
 return Response.json({reply:reply.reply},{headers:{'Cache-Control':'no-store'}});
 }catch{return respond('连接本机 Codex 失败，请检查连接服务。',502)}
}
