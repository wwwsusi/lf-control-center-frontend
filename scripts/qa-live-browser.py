import asyncio,json,threading,http.server,functools
from playwright.async_api import async_playwright
from pathlib import Path
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',8881),functools.partial(Quiet,directory=str(Path(__file__).resolve().parent.parent/'dist')));threading.Thread(target=server.serve_forever,daemon=True).start()
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=await b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.clock.install()
  await page.goto('http://127.0.0.1:8881/control-center.html')
  data=await page.evaluate("async()=>{const {demoProjection}=await import('./dashboard-demo.mjs');const d=demoProjection();d.items=d.items.filter(i=>i.kind==='task'||i.kind==='direction');d.sources=[d.sources[0]];d.sources[0].id='github:synthetic';d.sources[0].provider='github';d.sources[0].role='now';d.sources[0].revision='synthetic';for(const i of d.items){i.source_id=d.sources[0].id;i.title='LIVE SYNTHETIC '+i.title;i.fields.category='LF management';}return d;}")
  calls=0;fail=False
  async def route(r):
   nonlocal calls
   path=r.request.url.split('/api/')[1]
   if path=='login':body={'ok':True,'token':'synthetic-viewer','transport':'poll'}
   elif path=='inventory':body={'nodes':[],'edges':[]}
   elif path=='report':
    calls+=1
    assert r.request.headers.get('authorization')=='Bearer synthetic-viewer'
    if fail:await r.fulfill(status=502,json={'error':'synthetic failure'});return
    body=data
   else:body={'ok':True}
   await r.fulfill(json=body,headers={'Access-Control-Allow-Origin':'http://127.0.0.1:8881','Access-Control-Allow-Credentials':'true'})
  await page.route('https://service.test/api/**',route)
  await page.get_by_role('button',name='Pripojiť službu',exact=True).click();await page.locator('#endpoint').fill('https://service.test');await page.locator('#password').fill('synthetic');await page.get_by_role('button',name='Pripojiť',exact=True).click()
  await page.wait_for_function("window.lfDashboardDiagnostics().mode==='github-live' && window.lfDashboardDiagnostics().items===3",timeout=10000)
  assert 'LIVE SYNTHETIC' in await page.locator('#dashboard').inner_text();assert calls==1
  await page.clock.fast_forward(61000);await page.wait_for_timeout(100);assert calls==1,'Report refreshed automatically'
  await page.get_by_role('button',name='Obnoviť report',exact=True).click();await page.wait_for_timeout(150);assert calls==2
  fail=True;await page.get_by_role('button',name='Obnoviť report',exact=True).click();await page.wait_for_timeout(150);assert calls==3;assert 'LIVE SYNTHETIC' in await page.locator('#dashboard').inner_text();assert 'HTTP 502' in await page.locator('#dashboard').inner_text()
  await page.get_by_role('button',name='Pripojiť službu',exact=True).click();await page.get_by_role('button',name='Odpojiť',exact=True).click();assert await page.evaluate('window.lfDashboardDiagnostics().items')==0
  assert not errors,errors;await b.close()
 print('PASS: connect loads live GitHub report, authenticated refresh requests, failure retains last data, disconnect clears private report, zero runtime errors')
asyncio.run(main());server.shutdown()

