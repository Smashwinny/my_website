import {readFile,writeFile} from 'node:fs/promises';
const projects=[];
for(let page=1;;page++){
 const res=await fetch(`https://api.github.com/users/Smashwinny/repos?per_page=100&page=${page}`,{headers:{Accept:'application/vnd.github+json','User-Agent':'geniusqi-portfolio'}});
 if(!res.ok)throw Error(`GitHub ${res.status}; existing data left unchanged`);
 const batch=await res.json();if(!Array.isArray(batch))throw Error('Unexpected GitHub response');
 projects.push(...batch.filter(p=>!p.fork&&p.name!=='my_website').map(p=>({name:p.name,description:p.description||'项目详情与使用说明请查看 GitHub 仓库。',language:p.language||'Project',url:p.html_url,updated:p.updated_at})));
 if(batch.length<100)break;
}
const routeFile=new URL('../data/mist-route.json',import.meta.url),route=JSON.parse(await readFile(routeFile,'utf8'));
const assigned=new Set(route.map(island=>island.project));
for(const project of projects)if(!assigned.has(project.name))route.push({id:`rest-before-${project.name}`,project:null},{id:`project-${project.name}`,project:project.name});
await writeFile(new URL('../data/projects.json',import.meta.url),JSON.stringify(projects,null,2)+'\n');
await writeFile(routeFile,JSON.stringify(route,null,2)+'\n');console.log(`Saved ${projects.length} non-fork projects; preserved mist route and added unassigned projects`);
