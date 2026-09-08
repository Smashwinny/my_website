'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import projects from '../data/projects.json';
import type {WorldProps} from './scene/world-styles';
import {MonumentJourney,monumentNodes,nodeById,galleryProjects} from './scene/monument-paths.mjs';
import {createMonumentScene} from './scene/monument-scene.mjs';

const destinations=monumentNodes.filter(node=>node.gallery!==undefined&&node.gallery%2===0||node.id==='center');
export default function MonumentWorld(props:WorldProps){
 const host=useRef<HTMLDivElement>(null),current=useRef(props),actions=useRef({move:(_id:string)=>{},rotate:()=>{},reset:()=>{}});current.current=props;
 const labels=useRef(new Map<string,HTMLButtonElement>());
 const [notice,setNotice]=useState('点击圆形落点，沿阶梯出发。中央机关可以旋转桥梁。');
 const [location,setLocation]=useState('west'),[orientation,setOrientation]=useState(0),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[visited,setVisited]=useState<string[]>([]);
 const here=nodeById(location),indices=here?.gallery===undefined?[]:galleryProjects(here.gallery,projects.length);
 const neighbor=here?.gallery===undefined?null:monumentNodes.find(node=>node.gallery===(here.gallery!^1));
 useEffect(()=>{
  const el=host.current!;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'})}catch{setFailed(true);return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0,0);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;el.appendChild(renderer.domElement);
  const world=createMonumentScene(),journey=new MonumentJourney(),camera=new THREE.OrthographicCamera(-15,15,12,-12,.1,100);
  camera.position.set(20,20,24);camera.lookAt(0,2.3,0);
  let frame=0,last=performance.now(),time=0,lastBusy=false,lastOrientation=0,width=1,height=1,lost=false;
  function positionLabels(){for(const node of destinations){const label=labels.current.get(node.id);if(!label)continue;const p=new THREE.Vector3(...node.position).add(new THREE.Vector3(0,.16,0)).project(camera);label.style.left=`${(p.x+1)*.5*width}px`;label.style.top=`${(1-p.y)*.5*height}px`;}}
  function resize(){width=el.clientWidth;height=el.clientHeight;if(!width||!height)return;const aspect=width/height,span=Math.max(21,24/aspect);camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();camera.updateMatrixWorld();renderer.setSize(width,height);positionLabels();}
  const observer=new ResizeObserver(resize);observer.observe(el);resize();
  const move=(id:string)=>{
   if(current.current.paused||document.hidden)return;
   const result=journey.moveTo(id);
   if(result==='busy'){setNotice('旅人正在途中，稍等一下。');return;}
   if(result==='blocked'){setNotice(journey.node==='center'?'转动中央桥梁，让桥头对准目的地。':'道路尚未接通。先转桥对齐脚下道路，再到回转之心换方向。');return;}
   setNotice(id==='center'?'走向回转之心。抵达后，按 R 或点击转桥。':`正在前往${nodeById(id)?.name}。`);
  };
  const rotate=()=>{if(current.current.paused||document.hidden)return;if(!journey.rotate()){setNotice('先让旅人走到落脚处，再旋转桥梁。');return;}setNotice('桥梁正在转动，另一条路即将接通。');};
  const reset=()=>{if(current.current.paused)return;journey.reset();setLocation('west');setOrientation(0);setBusy(false);lastBusy=false;lastOrientation=0;setNotice('已回到启程台，已抵达的记录保留。');};
  actions.current={move,rotate,reset};
  const keydown=(e:KeyboardEvent)=>{if(current.current.paused||e.repeat||/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName))return;if(e.key.toLowerCase()==='r'){e.preventDefault();rotate();}else if(e.key.toLowerCase()==='c'){e.preventDefault();move('center');}};
  const contextLost=(e:Event)=>{e.preventDefault();lost=true;setFailed(true);cancelAnimationFrame(frame);};
  window.addEventListener('keydown',keydown);renderer.domElement.addEventListener('webglcontextlost',contextLost);
  function loop(now:number){
   if(lost)return;
   const dt=Math.min((now-last)/1000,.05);last=now;
   if(!current.current.paused&&!document.hidden){time+=dt;journey.update(dt);const arrival=journey.takeArrival();if(arrival){setLocation(arrival);if(nodeById(arrival)?.gallery!==undefined)setVisited(old=>old.includes(arrival)?old:[...old,arrival]);setNotice(arrival==='center'?'站在回转之心。旋转桥梁，选择新的方向。':`已抵达${nodeById(arrival)?.name}，点击下方作品查看详情。`);}if(lastBusy!==journey.busy){lastBusy=journey.busy;setBusy(lastBusy);}if(lastOrientation!==journey.orientation){lastOrientation=journey.orientation;setOrientation(lastOrientation);setNotice(journey.orientation%2?'南北桥已接通。点击落点继续探索。':'东西桥已接通。点击落点继续探索。');}}
   world.update(journey,time);if(!document.hidden)renderer.render(world.scene,camera);frame=requestAnimationFrame(loop);
  }frame=requestAnimationFrame(loop);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('keydown',keydown);renderer.domElement.removeEventListener('webglcontextlost',contextLost);world.dispose();renderer.dispose();renderer.domElement.remove();actions.current={move:()=>{},rotate:()=>{},reset:()=>{}};};
 },[]);
 return <section className="monument-world" aria-label="回声之庭，纪念碑谷风格的建筑探索">
  <div className="monument-heading"><p>V / THE COURT OF ECHOES</p><h1>回声之庭<span>。</span></h1><p className="monument-subtitle">转动建筑，续上未走完的路。</p><span className="monument-edition">GENIUSQI · 空间作品集</span></div>
  <div className="monument-stage" ref={host}>
   {!failed&&destinations.map(node=><button key={node.id} ref={el=>{if(el)labels.current.set(node.id,el);else labels.current.delete(node.id)}} className={`monument-point ${node.id==='center'?'monument-center':''}`} disabled={props.paused||busy} aria-label={`走到${node.name}${node.gallery!==undefined&&galleryProjects(node.gallery,projects.length).length?`，${galleryProjects(node.gallery,projects.length).map(i=>projects[i].name).join('、')}`:''}`} aria-current={location===node.id?'location':undefined} title={node.name} onClick={()=>actions.current.move(node.id)}><span>{node.id==='center'?'↻':String(node.gallery!+1).padStart(2,'0')}</span><small>{node.name}</small>{visited.includes(node.id)&&<i aria-label="已抵达">·</i>}</button>)}
  </div>
  {failed?<div className="monument-fallback" role="alert"><h2>这个设备暂时无法展开三维庭院</h2><p>仍可直接查看所有作品。</p>{projects.map((p,i)=><button key={p.name} onClick={()=>props.onSelect(i)}>{p.name} ↗</button>)}</div>:<>
   <div className="monument-mechanism"><span>回转机关 · {orientation%2?'南北相通':'东西相通'}</span><button disabled={props.paused||busy} onClick={()=>actions.current.rotate()} aria-label="将中央桥梁旋转九十度"><span aria-hidden="true">↻</span> 转桥 90° <kbd>R</kbd></button><button className="monument-center-link" disabled={props.paused||busy} onClick={()=>actions.current.move('center')}>走到回转之心 <kbd>C</kbd></button>{neighbor&&<button className="monument-center-link" disabled={props.paused||busy} onClick={()=>actions.current.move(neighbor.id)} title={`沿廊走到${neighbor.name}`}>{neighbor.name} →</button>}</div>
   <div className="monument-bottom"><p className="monument-notice" role="status">{notice}</p><div className="monument-location"><div><span>当前落点 / {here?.name}</span><strong>{indices.length?indices.map(i=>projects[i].name).join(' · '):'路在转动之间'}</strong></div><div className="monument-projects">{indices.map(i=><button key={i} disabled={props.paused||busy} onClick={()=>props.onSelect(i)}>查看{indices.length>1?` ${projects[i].name}`:'作品'} ↗</button>)}</div></div></div>
   <button className="monument-reset" disabled={props.paused||busy} onClick={()=>actions.current.reset()}>回到起点</button>
  </>}
 </section>;
}
