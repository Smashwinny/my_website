"""Deterministic initial-scene guard, separate from performance measurements.
Freeze application time and manually advance 3 frames. Hold optional streamed
scenery/companion requests so the same initial-state fixture is compared.
The normal benchmark separately exercises unmodified loading and real input.
"""
import asyncio,json,pathlib
from playwright.async_api import async_playwright
from PIL import Image,ImageChops
ROOT=pathlib.Path('perf/bench')
INIT="""window.__visual={now:1000,queue:new Map(),id:0};performance.now=()=>window.__visual.now;
window.requestAnimationFrame=f=>{const v=window.__visual;v.queue.set(++v.id,f);return v.id};
window.cancelAnimationFrame=id=>window.__visual.queue.delete(id);"""

async def capture(browser,url,label,width):
    ctx=await browser.new_context(viewport={'width':width,'height':900},device_scale_factor=1)
    page=await ctx.new_page();await page.add_init_script(INIT)
    # Hold post-ready enrichment; aborting would change warning UI.
    held=[]
    async def hold(route):held.append(route)
    await page.route('**/models/nature-web/**',hold)
    await page.route('**/models/traveler-web.vrm.bin',hold)
    await page.goto(url,wait_until='load')
    await page.wait_for_function("[...document.querySelectorAll('button')].some(b=>Object.keys(b).some(k=>k.startsWith('__reactProps$')))",polling=50)
    # Direct DOM click avoids Playwright's RAF-based stability wait in this fixture.
    await page.locator('.style-card-garden').evaluate('(button)=>button.click()')
    await page.wait_for_function("!!document.querySelector('.world canvas') && !document.querySelector('.world-loading,.asset-warning,.webgl-error')",polling=50,timeout=30000)
    for i in range(3):
        await page.evaluate("()=>{const v=window.__visual;v.now+=1000/60;const queue=[...v.queue.values()];v.queue.clear();for(const f of queue)f(v.now)}")
    content=await page.evaluate("({text:document.body.innerText,title:document.title,meta:[...document.querySelectorAll('meta')].map(m=>m.outerHTML),canonical:document.querySelector('link[rel=canonical]')?.outerHTML,structured:[...document.querySelectorAll('script[type=\"application/ld+json\"]')].map(s=>s.textContent),links:[...document.querySelectorAll('a')].map(a=>[a.textContent,a.getAttribute('href')])})")
    path=ROOT/f'visual-{label}-{width}.png'
    await page.screenshot(path=str(path),animations='disabled')
    await asyncio.gather(*(route.abort() for route in held),return_exceptions=True)
    await ctx.close();return path,content

async def main():
    results=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch(channel='msedge',headless=True)
        for width in [1440,390]:
            a,ca=await capture(browser,'http://127.0.0.1:3100','A',width)
            b,cb=await capture(browser,'http://127.0.0.1:3101','B',width)
            assert ca==cb,'visible text, links and SEO must be identical'
            ia,ib=Image.open(a).convert('RGB'),Image.open(b).convert('RGB')
            delta=ImageChops.difference(ia,ib)
            # 1 channel level tolerates GPU rounding; at most .1% pixels.
            changed=sum(max(pixel)>1 for pixel in delta.get_flattened_data())
            ratio=changed/(ia.width*ia.height)
            row={'width':width,'changed_pixels':changed,'ratio':ratio,'text_and_seo_identical':True,'pass':ratio<=.001}
            print(row,flush=True);results.append(row)
        await browser.close()
    (ROOT/'visual.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    assert all(r['pass'] for r in results),'visual regression exceeded .1% threshold'
asyncio.run(main())
