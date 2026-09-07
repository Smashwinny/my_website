import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={metadataBase:new URL('https://geniusqi-world.q1162406339.chatgpt.site'),title:'GENIUSQI · 创作浮岛',description:'探索 Smashwinny 的 3D 作品浮岛，与小齐一起发现代码背后的想法。',openGraph:{images:['/og.png'],title:'GENIUSQI · 创作浮岛',description:'一个可以探索的个人作品世界。'},twitter:{images:['/og.png'],card:'summary_large_image',title:'GENIUSQI · 创作浮岛',description:'一个可以探索的个人作品世界。'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
