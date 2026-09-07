import type {AppearanceId} from './appearances';
export const worldStyles=[
 {id:'garden',name:'晴岚浮岛',reference:'原神风格',description:'明亮庭园 · 自由漫游 · 完整作品图鉴',discovery:false},
 {id:'mist',name:'雾隐山海',reference:'黑神话悟空风格',description:'东方幽境 · 浮岛跳跃 · 未知的前路',discovery:true},
] as const;
export type WorldStyle=typeof worldStyles[number]['id'];
export function validWorldStyle(value:unknown):WorldStyle{return worldStyles.some(s=>s.id===value)?value as WorldStyle:'garden'}
export type WorldProps={onSelect:(n:number)=>void;onChat:()=>void;paused:boolean;chatOpen:boolean;playerAppearance:AppearanceId;companionAppearance:AppearanceId;playerSource:string;companionSource:string};
