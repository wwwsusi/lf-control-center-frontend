"""Real local HTTPS/cookie exchange with the synthetic handler; not production Safari verification."""
import asyncio,subprocess,tempfile,json,sys
from pathlib import Path
from playwright.async_api import async_playwright
async def main():
 with tempfile.TemporaryDirectory(prefix='lf-https-qa-') as temp:
  cert=str(Path(temp)/'cert.pem');key=str(Path(temp)/'key.pem')
  subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  server=subprocess.Popen(['node',str(Path(sys.argv[1])/'scripts/qa-server.mjs'),cert,key],stdout=subprocess.PIPE,text=True)
  try:
   origin=server.stdout.readline().strip();assert origin.startswith('https://localhost:')
   async with async_playwright() as p:
    browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=await browser.new_context(ignore_https_errors=True);page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    api=[];page.on('request',lambda r:api.append(r) if '/api/' in r.url else None)
    await page.goto(origin+'/control-center.html');await page.wait_for_function('window.lfDashboardDiagnostics')
    await page.wait_for_function("document.querySelector('#connection').textContent==='Odpojené'");assert (await page.evaluate('window.lfDashboardDiagnostics().items'))==0
    assert (await page.request.get(origin+'/api/dashboard')).status==401
    await page.get_by_role('button',name='Pripojiť službu',exact=True).click();assert await page.locator('#endpoint').is_disabled()
    await page.locator('#password').fill('synthetic-password');await page.get_by_role('button',name='Pripojiť',exact=True).click()
    await page.wait_for_function("window.lfDashboardDiagnostics().mode==='LIVE SUPABASE' && window.lfDashboardDiagnostics().items===37")
    await page.reload();await page.wait_for_function("window.lfDashboardDiagnostics && window.lfDashboardDiagnostics().mode==='LIVE SUPABASE' && window.lfDashboardDiagnostics().items===37")
    cookies=await context.cookies();cookie=next(c for c in cookies if c['name']=='__Secure-lf_session');assert cookie['httpOnly'] and cookie['secure'] and cookie['sameSite']=='Lax'
    assert '__Secure-lf_session' not in await page.evaluate('document.cookie')
    assert (await page.request.get(origin+'/api/dashboard')).status==200
    assert all(r.url.startswith(origin+'/api/') for r in api);assert all('authorization' not in r.headers for r in api)
    assert any('/api/inventory' in r.url for r in api);assert any('/api/events' in r.url for r in api)
    before=sum('/api/dashboard' in r.url for r in api);await page.get_by_role('button',name='Obnoviť report',exact=True).click();await page.wait_for_timeout(150);assert sum('/api/dashboard' in r.url for r in api)==before+1
    # A late authenticated response cannot undo logout during startup restore.
    held=asyncio.Event();release=asyncio.Event()
    async def delayed(route):
     response=await route.fetch();held.set();await release.wait();await route.fulfill(response=response)
    await page.route('**/api/dashboard',delayed)
    await page.reload(wait_until='domcontentloaded');await held.wait()
    await page.get_by_role('button',name='Pripojiť službu',exact=True).click()
    async with page.expect_response(lambda r:r.url.endswith('/api/logout')):
     await page.get_by_role('button',name='Odpojiť',exact=True).click()
    release.set();await page.wait_for_timeout(150);await page.unroute('**/api/dashboard',delayed)
    assert (await page.evaluate('window.lfDashboardDiagnostics().items'))==0
    assert await page.locator('#connection').inner_text()=='Odpojené'
    await page.get_by_role('button',name='Pripojiť službu',exact=True).click()
    await page.locator('#password').fill('synthetic-password');await page.get_by_role('button',name='Pripojiť',exact=True).click()
    await page.wait_for_function("window.lfDashboardDiagnostics().items===37")
    await page.request.post(origin+'/__qa/fail');await page.get_by_role('button',name='Obnoviť report',exact=True).click();await page.wait_for_timeout(150)
    text=await page.locator('#dashboard').inner_text();assert 'Synthetic NEXT action' in text and 'STALE / ERROR' in text
    await page.reload();await page.wait_for_function("window.lfDashboardDiagnostics && window.lfDashboardDiagnostics().error");assert 'Synthetic NEXT action' not in await page.locator('#dashboard').inner_text()
    await page.get_by_role('button',name='Pripojiť službu',exact=True).click();await page.get_by_role('button',name='Odpojiť',exact=True).click();await page.wait_for_timeout(150)
    assert not any(c['name']=='__Secure-lf_session' for c in await context.cookies());assert (await page.request.get(origin+'/api/dashboard')).status==401
    await page.reload();await page.wait_for_function('window.lfDashboardDiagnostics');await page.wait_for_timeout(200);assert 'Synthetic NEXT action' not in await page.locator('#dashboard').inner_text()
    assert not any('/api/report' in r.url for r in api)
    login=await page.request.post(origin+'/api/login',headers={'origin':origin},data={'password':'synthetic-password'});assert login.status==200;assert 'token' not in await login.json()
    await page.request.post(origin+'/__qa/expire');assert (await page.request.get(origin+'/api/dashboard')).status==401
    assert not errors,errors;await browser.close()
   print('PASS: startup anonymous, login, reload session restore, failure reload, logout reload; local HTTPS shell, relative API, real HttpOnly/Secure/Lax cookie, authenticated/anonymous dashboard, inventory/events, refresh retention, logout and expiry; no JS runtime errors. Not production Safari QA.')
  finally:server.terminate();server.wait(timeout=10)
asyncio.run(main())

