'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import projects from '../data/projects.json';
import type {WorldProps} from './scene/world-styles';
import {projectElement,cycleProject,swipeDirection,drawElement} from './scene/elements.mjs';

export default function ElementWorld(props:WorldProps){
 const [index,setIndex]=useState(0),[ready,setReady]=useState(false),[failed,setFailed]=useState(false);
 const canvas=useRef<HTMLCanvasElement>(null),state=useRef(props),indexRef=useRef(index),gesture=useRef<{x:number;y:number}|null>(null),lastSwipe=useRef(0);state.current=props;indexRef.current=index;
 const project=projects[index],element=projectElement(project?.name||'');
 function move(direction:number){if(!state.current.paused)setIndex(i=>cycleProject(i,direction,projects.length))}
 useEffect(()=>{
  const c=canvas.current!,ctx=c.getContext('2d');if(!ctx)return;
  let frame=0,last=0,time=0,lastDrawn=-1;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const draw=()=>drawElement(ctx,c.width,c.height,time,projectElement(projects[indexRef.current]?.name||''));
  const resize=()=>{const size=Math.round(c.clientWidth*Math.min(devicePixelRatio,1.5));c.width=c.height=Math.max(size,1);draw()};const observer=new ResizeObserver(resize);observer.observe(c);resize();
  function loop(now:number){const dt=Math.min((now-last)/1000,.05);last=now;if(!document.hidden&&!state.current.paused){if(!reduced.matches)time+=dt;if(!reduced.matches||lastDrawn!==indexRef.current){draw();lastDrawn=indexRef.current}}frame=requestAnimationFrame(loop)}frame=requestAnimationFrame(loop);
  const key=(e:KeyboardEvent)=>{if(state.current.paused||/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setIndex(i=>cycleProject(i,e.key==='ArrowRight'?1:-1,projects.length))}if(e.key==='Enter'&&e.target===document.body&&projects.length)state.current.onSelect(indexRef.current)};
  window.addEventListener('keydown',key);return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('keydown',key)};
 },[]);
 return <section className="element-world" style={{'--element-color':element.color} as CSSProperties} aria-label="掌中元素作品展厅">
  <div className="element-atmosphere"/>
  <div className="element-copy"><p className="eyebrow">GENIUSQI / ELEMENTAL CHAPTER</p><h1>万象，<br/>在我掌中<span>。</span></h1><p>将一个想法，凝成一束力量。<br/>滑动掌中元素，遇见下一件作品。</p><span className="element-sign">{element.name}</span></div>
  <div className="element-portrait" onPointerDown={e=>{if(props.paused)return;gesture.current={x:e.clientX,y:e.clientY};(e.target as HTMLElement).setPointerCapture(e.pointerId)}} onPointerUp={e=>{if(!gesture.current)return;const direction=swipeDirection(e.clientX-gesture.current.x,e.clientY-gesture.current.y);gesture.current=null;if(direction){lastSwipe.current=performance.now();move(direction)}}} onPointerCancel={()=>{gesture.current=null}}>
   <img src="/models/elements/hero-titan-face.webp" alt="保留参考人物面貌与眼镜的绿色巨人，暗蓝衣甲与强烈明暗光影下伸手托起元素之力" draggable={false} onLoad={()=>setReady(true)} onError={()=>{setFailed(true);setReady(true)}}/>
   <div className="element-hand-light"/>
   <button className="element-orb" aria-label={`查看作品 ${project?.name||''}，${element.title}`} onClick={()=>{if(performance.now()-lastSwipe.current>300&&!props.paused&&project)props.onSelect(index)}}><canvas ref={canvas} aria-hidden="true"/></button>
   {!ready&&<div className="element-image-loading" role="status">正在唤醒掌中万象<div className="asset-progress" role="progressbar" aria-label="主体画面加载中"><i className="indeterminate"/></div></div>}
   {failed&&<p className="element-image-loading" role="alert">主体画面暂未加载，仍可切换和查看作品。</p>}
  </div>
  <div className="element-selector"><button className="element-arrow" aria-label="上一个项目" onClick={()=>move(-1)} disabled={props.paused||projects.length<2}>←</button><div className="element-current" aria-live="polite"><p>{element.title} <span> / {String(index+1).padStart(2,'0')}</span></p><button onClick={()=>project&&props.onSelect(index)} disabled={props.paused||!project}>{project?.name||'静候新的作品'} <span>↗</span></button><small>{project?.language} · 点击元素球查看作品</small></div><button className="element-arrow" aria-label="下一个项目" onClick={()=>move(1)} disabled={props.paused||projects.length<2}>→</button></div>
  <p className="element-swipe-hint">← 左右滑动 · 切换项目 →</p>
 </section>
}
