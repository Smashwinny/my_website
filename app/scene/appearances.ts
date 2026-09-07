export const appearances=[
 {id:'original',name:'林间旅人',description:'原色长发 · 轻装',hair:null,cloth:null,accent:'#96b99b',accessory:'none'},
 {id:'moon',name:'月光精灵',description:'银发 · 星环与双翼',hair:'#f3e6d1',cloth:'#b7bce4',accent:'#e6bc70',accessory:'wings'},
 {id:'sage',name:'森野学者',description:'青灰发 · 贝雷帽',hair:'#567d76',cloth:'#617d68',accent:'#d1b880',accessory:'beret'},
 {id:'rose',name:'暮色信使',description:'玫瑰发 · 星环与双翼',hair:'#a56f89',cloth:'#886e9c',accent:'#ebc8a4',accessory:'wings'},
] as const;
export type AppearanceId=typeof appearances[number]['id'];
export function validAppearance(value:unknown,fallback:AppearanceId):AppearanceId{return appearances.some(p=>p.id===value)?value as AppearanceId:fallback}
