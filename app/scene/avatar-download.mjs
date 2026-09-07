// Cache transferred bytes across scenes, while every VRM retains its own GPU resources.
const downloads=new Map();
/** @param {string} source @param {(value:{loaded:number,total:number,phase:'download'|'decode'|'ready'})=>void} onProgress */
export async function downloadAvatar(source,onProgress=()=>{}){
 let entry=downloads.get(source);
 if(!entry){
  entry={listeners:new Set(),progress:{loaded:0,total:0,phase:'download'},promise:null};
  downloads.set(source,entry);
  const emit=value=>{entry.progress=value;for(const listener of entry.listeners)listener(value)};
  entry.promise=(async()=>{
   const compressed=source.endsWith('-mobile.vrm')&&typeof DecompressionStream!=='undefined';
   const response=await fetch(compressed?source+'.bin':source);
   if(!response.ok)throw Error('人物下载失败');
   const total=Number(response.headers.get('content-length'))||0;
   const reader=response.body?.getReader();if(!reader)throw Error('人物数据为空');
   const chunks=[];let loaded=0;emit({loaded,total,phase:'download'});
   for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.byteLength;emit({loaded,total,phase:'download'})}
   const bytes=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
   emit({loaded,total:loaded,phase:'decode'});
   const decoded=compressed?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():bytes.buffer;
   emit({loaded,total:loaded,phase:'ready'});return decoded;
  })();
  entry.promise.catch(()=>downloads.delete(source));
 }
 entry.listeners.add(onProgress);onProgress(entry.progress);
 try{return await entry.promise}finally{entry.listeners.delete(onProgress);if(source.startsWith('blob:'))downloads.delete(source)}
}
