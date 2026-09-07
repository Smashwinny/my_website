'use client';
import{lazy,Suspense,type ComponentType}from'react';
import type{WorldProps,WorldStyle}from'./scene/world-styles';
const worlds:Record<WorldStyle,ComponentType<WorldProps>>={garden:lazy(()=>import('./world')),mist:lazy(()=>import('./mist-world')),elements:lazy(()=>import('./element-world'))};
export default function WorldView({style,...props}:WorldProps&{style:WorldStyle}){const Scene=worlds[style];return <Suspense fallback={<div className="world-loading" role="status"><span>正在走入另一重天地…</span><div className="asset-progress" role="progressbar" aria-label="场景准备中"><i className="indeterminate"/></div></div>}><Scene {...props}/></Suspense>}
