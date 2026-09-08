import type {AppearanceId} from './appearances';
export const worldStyles=[
 {id:'garden',name:'晴岚浮岛',reference:'原神风格',description:'明亮庭园 · 自由漫游 · 完整作品图鉴',discovery:false},
 {id:'mist',name:'雾隐山海',reference:'黑神话悟空风格',description:'东方幽境 · 浮岛跳跃 · 未知的前路',discovery:true},
 {id:'elements',name:'掌中万象',reference:'元素之力',description:'专属人物 · 动态元素球 · 滑动切换作品',discovery:false},
 {id:'mario',name:'马里奥探险',reference:'像素蘑菇王国',description:'横版闯关 · 跳跃顶砖 · 蘑菇发现作品',discovery:false},
 {id:'monument',name:'回声之庭',reference:'纪念碑谷风格',description:'等距建筑 · 旋转断桥 · 沿阶梯发现作品',discovery:false},
] as const;
export type WorldStyle=typeof worldStyles[number]['id'];
export function validWorldStyle(value:unknown):WorldStyle{return worldStyles.some(s=>s.id===value)?value as WorldStyle:'garden'}
export type WorldProps={onSelect:(n:number)=>void;onChat:()=>void;paused:boolean;chatOpen:boolean;playerAppearance:AppearanceId;companionAppearance:AppearanceId;playerSource:string;companionSource:string};
