import {writeFile} from 'node:fs/promises';
const projects=[];
for(let page=1;;page++){
 const res=await fetch(`https://api.github.com/users/Smashwinny/repos?per_page=100&page=${page}`,{headers:{Accept:'application/vnd.github+json','User-Agent':'geniusqi-portfolio'}});
 if(!res.ok)throw Error(`GitHub ${res.status}; existing data left unchanged`);
 const batch=await res.json();if(!Array.isArray(batch))throw Error('Unexpected GitHub response');
 projects.push(...batch.filter(p=>!p.fork&&p.name!=='my_website').map(p=>({name:p.name,description:p.description||'项目详情与使用说明请查看 GitHub 仓库。',language:p.language||'Project',url:p.html_url,updated:p.updated_at})));
 if(batch.length<100)break;
}
await writeFile(new URL('../data/projects.json',import.meta.url),JSON.stringify(projects,null,2)+'\n');console.log(`Saved ${projects.length} non-fork projects`);
