'use client';
import {useEffect,useRef,useState} from 'react';
import projects from '../data/projects.json';
import type {WorldProps} from './scene/world-styles';
import {MushroomAdventure,FLOOR} from './scene/mario-physics.mjs';

export default function MarioWorld(props:WorldProps){
 const canvas=useRef<HTMLCanvasElement>(null),state=useRef(props),touch=useRef(new Set<string>()),jump=useRef(false);state.current=props;
 const [found,setFound]=useState(0),[notice,setNotice]=useState('走到问号砖下方，跳起来顶出项目蘑菇！');
 useEffect(()=>{
  const c=canvas.current!,ctx=c.getContext('2d');if(!ctx)return;
  const game=new MushroomAdventure(projects.length),keys=new Set<string>();let frame=0,last=performance.now(),camera=0,viewWidth=960,noticeUntil=7,facing=1;
  const clear=()=>{keys.clear();touch.current.clear();jump.current=false};
  const resize=()=>{const rect=c.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);c.width=Math.round(rect.width*dpr);c.height=Math.round(rect.height*dpr);viewWidth=540*rect.width/Math.max(rect.height,1)};const observer=new ResizeObserver(resize);observer.observe(c);resize();
  const down=(e:KeyboardEvent)=>{if(state.current.paused||/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName))return;const k=e.key.toLowerCase();if(['arrowleft','arrowright','a','d',' ','arrowup','w'].includes(k)){e.preventDefault();if([' ','arrowup','w'].includes(k)){if(!e.repeat)jump.current=true}else keys.add(k)}};
  const up=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
  function box(x:number,y:number,w:number,h:number,color:string){ctx!.fillStyle=color;ctx!.fillRect(Math.round(x),Math.round(y),w,h)}
  function mushroom(x:number,y:number,color:string){box(x+6,y+12,12,12,'#ffe9b4');box(x+3,y+6,18,12,color);box(x+6,y+2,12,5,color);box(x,y+12,24,6,color);box(x+5,y+6,5,5,'#fff7da');box(x+15,y+11,5,5,'#fff7da');box(x+8,y+19,2,3,'#39272b');box(x+15,y+19,2,3,'#39272b')}
  function render(){
   ctx!.setTransform(c.height/540,0,0,c.height/540,0,0);ctx!.imageSmoothingEnabled=false;
   const sky=ctx!.createLinearGradient(0,0,0,FLOOR);sky.addColorStop(0,'#60bbe9');sky.addColorStop(1,'#c8f2ef');ctx!.fillStyle=sky;ctx!.fillRect(0,0,viewWidth,540);
   for(let i=-1;i<viewWidth/190+2;i++){const x=i*190-(camera*.2%190);box(x,125,65,17,'#ffffff');box(x+13,112,37,30,'#ffffff');box(x+25,103,17,10,'#ffffff')}
   for(let i=-1;i<viewWidth/240+2;i++){const x=i*240-(camera*.35%240);ctx!.fillStyle='#8fcf86';ctx!.beginPath();ctx!.ellipse(x+90,FLOOR,110,110,0,Math.PI,Math.PI*2);ctx!.fill();box(x+67,385,4,9,'#4a9b68');box(x+86,385,4,9,'#4a9b68')}
   ctx!.save();ctx!.translate(-camera,0);
   box(0,FLOOR,game.width,100,'#b97441');box(0,FLOOR,game.width,10,'#5bab55');box(0,FLOOR+10,game.width,5,'#285e3e');for(let x=Math.floor(camera/32)*32;x<camera+viewWidth+32;x+=32){box(x,FLOOR+18,2,82,'#8c4c31');for(let y=FLOOR+18;y<540;y+=27)box(x,y,32,2,'#d4995a')}
   for(const pipe of game.pipes){box(pipe.x,pipe.y,pipe.w,pipe.h,'#236c37');box(pipe.x+6,pipe.y,pipe.w-13,pipe.h,'#61be47');box(pipe.x,pipe.y,pipe.w,12,'#358c3a');box(pipe.x+6,pipe.y+3,pipe.w-12,5,'#9bd760');box(pipe.x+10,pipe.y+14,5,pipe.h-14,'#a4dc68')}
   for(const b of game.blocks){if(b.x<camera-50||b.x>camera+viewWidth+50)continue;const y=b.y-Math.sin(b.bump/.2*Math.PI)*7;box(b.x+3,y+3,42,42,'#7c492d');box(b.x,y,42,42,b.used?'#b27d49':'#e6a337');box(b.x+3,y+3,36,3,b.used?'#d09b65':'#ffe192');box(b.x+3,y+3,3,35,'#ffd275');box(b.x+36,y+7,3,32,'#a86428');ctx!.font='bold 29px monospace';ctx!.textAlign='center';ctx!.fillStyle=b.used?'#795033':'#fff5c4';ctx!.fillText(b.used?'·':'?',b.x+21,y+31);for(const dx of [5,34])for(const dy of [6,34])box(b.x+dx,y+dy,3,3,'#8b572d')}
   for(const m of game.mushrooms)mushroom(m.x,m.y,['#db4445','#2f9bc0','#9670c7'][m.project%3]);
   const p=game.player;ctx!.save();ctx!.translate(p.x+p.w/2,p.y);ctx!.scale(facing,1);const walk=game.grounded?Math.sin(game.time*15)*Math.min(1,Math.abs(p.vx)/150)*3:0;
   box(-9,2,18,6,'#d53b38');box(-8,0,14,3,'#ec6253');box(-7,8,15,9,'#ffc58b');box(-10,8,5,8,'#66362b');box(4,10,3,3,'#26262b');box(4,14,8,3,'#ffc58b');box(-3,16,10,2,'#5d342a');box(-8,18,16,9,'#df4b40');box(-5,22,13,9,'#315ec1');box(-5,18,3,8,'#315ec1');box(5,18,3,8,'#315ec1');box(-12,21+walk,5,7,'#ffc58b');box(8,21-walk,5,7,'#ffc58b');box(-6,30,5,5+walk,'#315ec1');box(3,30,5,5-walk,'#315ec1');box(-8,34+walk,8,3,'#52362c');box(2,34-walk,9,3,'#52362c');box(-3,24,2,2,'#ffe8a0');box(5,24,2,2,'#ffe8a0');ctx!.restore();
   const flag=game.width-145;box(flag,FLOOR-155,5,155,'#eaf5cc');box(flag-4,FLOOR-162,13,10,'#efc957');box(flag+5,FLOOR-150,55,29,'#e7584b');ctx!.font='bold 12px monospace';ctx!.fillStyle='#fff';ctx!.textAlign='left';ctx!.fillText('GO!',flag+13,FLOOR-130);ctx!.restore();
  }
  function loop(now:number){const dt=Math.min((now-last)/1000,.04);last=now;const paused=state.current.paused||document.hidden;if(paused)clear();else{const axis=Number(keys.has('d')||keys.has('arrowright')||touch.current.has('right'))-Number(keys.has('a')||keys.has('arrowleft')||touch.current.has('left'));if(axis)facing=axis;if(jump.current){game.jump();jump.current=false}game.update(dt,axis);for(const event of game.takeEvents()){if(event.type==='spawn'){setNotice('蘑菇出来啦！碰到它，就能打开作品。');noticeUntil=game.time+4}else{clear();setFound(game.collected.size);setNotice(game.collected.size===projects.length?'所有项目蘑菇都找到了！':'发现新作品！也可以再顶这块砖重新查看。');noticeUntil=game.time+5;state.current.onSelect(event.project);break}}if(noticeUntil&&game.time>noticeUntil){setNotice('');noticeUntil=0}}
   camera=Math.max(0,Math.min(game.width-viewWidth,game.player.x-viewWidth*.38));if(!document.hidden)render();frame=requestAnimationFrame(loop)
  }frame=requestAnimationFrame(loop);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();clear();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear)};
 },[]);
 return <section className="mario-world"><canvas ref={canvas} aria-label="马里奥风格横版冒险：左右移动，跳跃顶砖，收集蘑菇查看项目"/><div className="mario-hud"><span>GENIUSQI · 蘑菇王国</span><strong>项目蘑菇 {found} / {projects.length}</strong><small>← → / A D 移动 · 空格跳跃</small></div>{notice&&<p className="mario-notice" role="status">{notice}</p>}{!props.paused&&<div className="mario-controls"><div>{[['left','←'],['right','→']].map(([key,label])=><button key={key} aria-label={key==='left'?'向左移动':'向右移动'} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);touch.current.add(key)}} onPointerUp={()=>touch.current.delete(key)} onPointerCancel={()=>touch.current.delete(key)} onLostPointerCapture={()=>touch.current.delete(key)}>{label}</button>)}</div><button className="mario-jump" onPointerDown={e=>{e.preventDefault();jump.current=true}}>跳跃 ↑</button></div>}</section>
}
