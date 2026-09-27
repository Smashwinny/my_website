"""Isolated cold-context scene benchmark. Reuses huashu-flash collection/statistics.
Never attaches to an existing browser/profile. Each run clicks a real theme button.
"""
import argparse, asyncio, importlib.util, json, pathlib, time
from playwright.async_api import async_playwright

skill = pathlib.Path.home()/'.codex/skills/huashu-flash/scripts/bench.py'
spec = importlib.util.spec_from_file_location('flash', skill)
flash = importlib.util.module_from_spec(spec)
spec.loader.exec_module(flash)
READY = "!!document.querySelector('.world canvas') && !document.querySelector('.world-loading,.scene-loading-note,.webgl-error,.asset-warning') && !!document.querySelector('.jump-button')"

async def run(browser,url,args,label,index):
    ctx=await browser.new_context(viewport={'width':args.width,'height':900})
    page=await ctx.new_page()
    cdp=await ctx.new_cdp_session(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.setCacheDisabled',{'cacheDisabled':True})
    await cdp.send('Network.emulateNetworkConditions',flash.PROFILES[args.profile])
    await page.add_init_script(flash.INIT_JS % READY)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    result={'url':url,'ok':True,'version':label}
    try:
        await page.goto(url,wait_until='commit',timeout=60000)
        await page.wait_for_function("[...document.querySelectorAll('button')].some(b=>Object.keys(b).some(k=>k.startsWith('__reactProps$') && typeof b[k]?.onClick==='function'))",timeout=30000)
        result['brotli_supported']=await page.evaluate("(()=>{try{new DecompressionStream('brotli');return true}catch{return false}})()")
        # Opening the catalog proves hydration, without initiating heavy assets.
        await page.get_by_role('button',name='先看作品图鉴 →').click()
        await page.get_by_role('dialog',name='作品图鉴',exact=True).wait_for()
        home_ready=await page.evaluate('performance.now()')
        await page.keyboard.press('Escape')
        button=page.get_by_role('button',name='晴岚浮岛' if args.scene=='garden' else '雾隐山海',exact=False)
        start=await page.evaluate('performance.now()')
        await button.click()
        await page.wait_for_function('window.__flash.ready !== null',timeout=90000)
        await page.wait_for_timeout(100)
        result.update(await page.evaluate(flash.COLLECT_JS))
        result['home_ready']=home_ready
        result['click_to_ready']=result['ready']-start
        result['resources']=await page.evaluate("performance.getEntriesByType('resource').map(r=>({name:r.name,start:r.startTime,end:r.responseEnd,bytes:r.transferSize,decoded:r.decodedBodySize,type:r.initiatorType}))")
        result['seo']=await page.evaluate("({title:document.title,description:document.querySelector('meta[name=description]')?.content,canonical:document.querySelector('link[rel=canonical]')?.href,links:[...document.querySelectorAll('a')].map(a=>[a.textContent,a.getAttribute('href')])})")
        # A rendered canvas and visible movement controls alone are not proof of
        # successful motion. Save and compare pixels around real key input.
        before=await page.locator('.world canvas').screenshot()
        await page.keyboard.down('w')
        await page.wait_for_timeout(350)
        await page.keyboard.press('Space')
        await page.wait_for_timeout(150)
        await page.keyboard.press('Space')
        await page.keyboard.up('w')
        after=await page.locator('.world canvas').screenshot()
        result['canvas_changed_after_input']=before!=after
        result['errors']=errors
        if errors or before==after: result['ok']=False
        if index==0:
            await page.screenshot(path=str(pathlib.Path(args.out).with_suffix(f'.{label}.{args.width}.png')))
    except Exception as e:
        result.update(ok=False,error=str(e)[:600],errors=errors)
        result['body']= (await page.locator('body').inner_text())[:1000]
    await ctx.close()
    print(label,index+1,result.get('click_to_ready'),result.get('error',''),flush=True)
    return result

async def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--url',required=True);ap.add_argument('--url-b')
    ap.add_argument('--scene',choices=['garden','mist'],default='garden')
    ap.add_argument('--runs',type=int,default=10);ap.add_argument('--width',type=int,default=1440)
    ap.add_argument('--profile',default='fast4g');ap.add_argument('--out',required=True)
    args=ap.parse_args(); urls={'A':args.url}
    if args.url_b: urls['B']=args.url_b
    result={'started':time.strftime('%Y-%m-%d %H:%M:%S'),'config':vars(args),'ready':READY,'results':{k:{'url':url,'runs':[]} for k,url in urls.items()}}
    async with async_playwright() as p:
        browser=await p.chromium.launch(channel='msedge',headless=True)
        for i in range(args.runs):
            for k in (list(urls) if i%2==0 else list(urls)[::-1]):
                result['results'][k]['runs'].append(await run(browser,urls[k],args,k,i))
        await browser.close()
    for row in result['results'].values():
        row['summary']=flash.summarize(row['runs'])
        for metric in ['click_to_ready','home_ready']:
            row['summary'][metric]={f'p{q}':flash.pct([r.get(metric) for r in row['runs'] if r['ok']],q) for q in [50,75,95]}
    result['finished']=time.strftime('%Y-%m-%d %H:%M:%S')
    pathlib.Path(args.out).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v['summary'] for k,v in result['results'].items()},ensure_ascii=False,indent=2))
asyncio.run(main())
