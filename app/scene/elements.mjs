import assignments from '../../data/project-elements.json' with {type:'json'};
export const elements=[
 {id:'fire',name:'焰',title:'火焰之力',color:'#ff9b52',description:'烈焰翻涌，火星生灭。'},
 {id:'water',name:'澜',title:'流水之力',color:'#6ddaff',description:'水光流转，涟漪相生。'},
 {id:'lightning',name:'霆',title:'雷电之力',color:'#be9aff',description:'电弧交织，能量涌动。'},
];
export function projectElement(name){let hash=0;for(const c of name)hash=(hash*31+c.charCodeAt(0))>>>0;return elements.find(e=>e.id===assignments[name])||elements[hash%elements.length]}
export function cycleProject(index,direction,total){return total>0?((index+direction)%total+total)%total:0}
export function swipeDirection(dx,dy){return Math.abs(dx)>=45&&Math.abs(dx)>Math.abs(dy)*1.2?(dx<0?1:-1):0}
export function drawElement(ctx,width,height,time,element){
 ctx.clearRect(0,0,width,height);const x=width/2,y=height/2,r=width*.235;ctx.save();ctx.globalCompositeOperation='lighter';
 const glow=ctx.createRadialGradient(x,y,r*.3,x,y,r*2);glow.addColorStop(0,element.color+'77');glow.addColorStop(.55,element.color+'22');glow.addColorStop(1,element.color+'00');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
 const body=ctx.createRadialGradient(x-r*.3,y-r*.3,r*.1,x,y,r);body.addColorStop(0,'#fff6dd');body.addColorStop(.23,element.color);body.addColorStop(.72,element.id==='water'?'#126c9d':element.id==='fire'?'#b83108':'#5a28a4');body.addColorStop(1,'#090919');ctx.globalCompositeOperation='source-over';ctx.fillStyle=body;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation='lighter';
 if(element.id==='fire'){
  for(let i=0;i<65;i++){const phase=(time*.65+i*.618)%1,a=i*2.399,base=Math.sin(a)*r*.85,px=x+base+Math.sin(time*3+i)*r*.09,py=y+r*.5-phase*r*2.1,size=(1-phase)*r*(.045+.09*(.5+.5*Math.sin(i*9)));ctx.globalAlpha=(1-phase)*.85;ctx.fillStyle=i%3?'#ff8b21':'#fff2a6';ctx.beginPath();ctx.ellipse(px,py,size,size*(1.5+phase*2),Math.sin(time+i)*.3,0,Math.PI*2);ctx.fill()}
  for(let j=0;j<11;j++){ctx.globalAlpha=.35;ctx.strokeStyle='#ffd879';ctx.lineWidth=1.4;ctx.beginPath();for(let k=0;k<=40;k++){const a=k/40*Math.PI*2,rr=r*(.65+Math.sin(a*4-time*3+j)*.12);const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;k?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.stroke()}
 }else if(element.id==='water'){
  ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();
  for(let j=0;j<13;j++){ctx.globalAlpha=.2+j%3*.12;ctx.strokeStyle=j%2?'#79e7ff':'#e0ffff';ctx.lineWidth=1.5+j%3;ctx.beginPath();for(let k=0;k<=50;k++){const px=x-r+k/50*r*2,py=y-r+j*r/6+Math.sin(k*.14+time*1.6+j*.5)*r*.13+Math.cos(k*.3-time+j)*r*.05;k?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.stroke()}ctx.restore();
  for(let j=0;j<12;j++){const a=time*.35+j*2.399,rr=r*(1.03+.1*Math.sin(time+j));ctx.globalAlpha=.5;ctx.fillStyle='#aeeeff';ctx.beginPath();ctx.arc(x+Math.cos(a)*rr,y+Math.sin(a)*rr,1.6+j%3,0,Math.PI*2);ctx.fill()}
 }else{
  for(let j=0;j<9;j++){const angle=j/9*Math.PI*2+time*.15,phase=Math.floor(time*7),end=r*(.8+.2*Math.sin(j+time));ctx.globalAlpha=.5+.2*Math.sin(time*3+j);ctx.strokeStyle=j%2?'#ba88ff':'#f4e7ff';ctx.lineWidth=j%2?1.3:2;ctx.shadowColor='#a075ff';ctx.shadowBlur=8;ctx.beginPath();for(let k=0;k<=8;k++){const length=k/8*end,offset=k===0?0:Math.sin(k*78.23+j*31.7+phase*5.1)*r*.1;const px=x+Math.cos(angle)*length+Math.sin(angle)*offset,py=y+Math.sin(angle)*length-Math.cos(angle)*offset;k?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.stroke()}ctx.shadowBlur=0;
 }
 ctx.globalAlpha=.5;ctx.strokeStyle=element.color;ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,r*1.025,0,Math.PI*2);ctx.stroke();ctx.restore();
}
