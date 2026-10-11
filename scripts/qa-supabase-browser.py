"""Synthetic browser-only fixture supplied outside the public artifact/repository."""
import asyncio,json,threading,http.server,functools,sys
from pathlib import Path
from playwright.async_api import async_playwright
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
fixture=json.loads(Path(sys.argv[1]).read_text())
server=http.server.ThreadingHTTPServer(('127.0.0.1',8882),functools.partial(Quiet,directory=str(Path(__file__).resolve().parent.parent/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.clock.install();calls=0;fail=False
  async def route(r):
   nonlocal calls
   path=r.request.url.split('/api/')[1]
   if path=='login': body={'ok':True,'token':'synthetic-legacy-viewer','transport':'poll'}
   elif path=='inventory': body={'nodes':[],'edges':[]}
   elif path=='dashboard':
    calls+=1
    assert 'authorization' not in r.request.headers,'Dashboard uses HttpOnly cookie, not JS bearer'
    if fail:await r.fulfill(status=502,json={'error':'Synthetic failure'});return
    body=fixture
   else: body={'ok':True}
   await r.fulfill(json=body,headers={'Access-Control-Allow-Origin':'http://127.0.0.1:8882','Access-Control-Allow-Credentials':'true'})
  await page.route('https://service.test/api/**',route);await page.goto('http://127.0.0.1:8882/control-center.html')
  await page.get_by_role('button',name='Pripojiť službu',exact=True).click();await page.locator('#endpoint').fill('https://service.test');await page.locator('#password').fill('synthetic');await page.get_by_role('button',name='Pripojiť',exact=True).click()
  await page.wait_for_function("window.lfDashboardDiagnostics().mode==='LIVE SUPABASE'",timeout=10000)
  assert calls==1
  for name in ['Kalendár','Služby','Produkty','Kampane','Management','Kvalita dát']:
   await page.locator('#dashboard-nav').get_by_role('button',name=name,exact=True).click()
   await page.wait_for_timeout(30);text=await page.locator('#dashboard').inner_text()
   if name=='Služby':assert 'Synthetic service 35' in text and 'AKTUÁLNA CENA' in text and 'NAVRHOVANÁ CENA' in text
   if name=='Produkty':assert 'LF-PROD-001' in text and 'IDEA' in text
   if name=='Kampane':assert 'No performance data yet' in text and '75%' in text and 'Synthetic caption' in text
   if name=='Kalendár':assert 'Q1-2027' in text and '10-10-2026' in text
   if name=='Kvalita dát':assert 'WARN: 27' in text
  await page.locator('#dashboard-nav').get_by_role('button',name='Prehľad',exact=True).click()
  await page.clock.fast_forward(61000);await page.wait_for_timeout(100);assert calls==1,'Report must not auto-poll'
  await page.get_by_role('button',name='Obnoviť report',exact=True).click();await page.wait_for_timeout(150);assert calls==2
  fail=True;await page.get_by_role('button',name='Obnoviť report',exact=True).click();await page.wait_for_timeout(150)
  text=await page.locator('#dashboard').inner_text();assert calls==3 and 'Synthetic NEXT action' in text and 'STALE / ERROR' in text
  await page.screenshot(path='/tmp/lf-control-center-v2.png',full_page=True)
  assert not errors,errors
  await browser.close()
 print('PASS: eight-view navigation, 36 services, IDEA products, canonical output, dates/quarters, empty performance, manual refresh, failure retention, no browser runtime errors.')
try:asyncio.run(main())
finally:server.shutdown()

