import asyncio,json,threading,http.server,functools,os,tempfile
from pathlib import Path
from playwright.async_api import async_playwright
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',8879),functools.partial(Quiet,directory=str(Path(__file__).resolve().parents[1]/'dist')))
threading.Thread(target=server.serve_forever,daemon=True).start()
output=Path(os.environ.get('LF_QA_OUTPUT',tempfile.mkdtemp(prefix='lf-compact-synthetic-')));output.mkdir(parents=True,exist_ok=True)
async def run():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce');errors=[];requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
  await page.goto('http://127.0.0.1:8879/control-center.html');await page.wait_for_function('window.lfDashboardDiagnostics')
  assert await page.locator('html').get_attribute('data-theme')=='dark'
  projection=await page.evaluate('''async()=>{const {demoProjection}=await import('./dashboard-demo.mjs');const d=demoProjection();const source=d.sources[0];source.provider='github';source.role='now';
   const item=(id,kind,title,fields={},related_ids=[],links=[])=>({id,kind,title,fields,related_ids,links,conflicts:[],source_id:source.id,provenance:{owner:'SYNTHETIC',anchor:id,identity:'synthetic'}});
   d.items=d.items.filter(i=>!['task','service','campaign','output','decision'].includes(i.kind));
   for(let n=0;n<22;n++)d.items.push(item('task:'+n,'task','DEMO · '+['Overiť pripravenosť','Potvrdiť koncept','Vyhodnotiť pilot'][n%3]+' '+(n+1),{priority:n<5?'P0':n<10?'P1':'P2',task_status:n%2?'NEZAČATÉ':'V PRÍPRAVE',owner:'Demo owner',next_step:'Overiť konkrétny ďalší krok podľa schváleného procesu.',category:['LF FB kampaň / FB post','LF management','LF Git management'][n%3],added_at:n<7?'2026-10-0'+(n+1):'TBD',due:'TBD'}));
   for(const [n,status] of ['ACTIVE','ACTIVE','ACTIVE','PREPARING','PILOT','IDEA','PROPOSED','PAUSED','RETIRED'].entries())d.items.push(item('LF-SVC-SYNTHETIC-'+n,'service','DEMO · Služba '+(n+1),{lifecycle:status,availability:n===0?'Nie':n<3?'Áno':'TBD',price:n<3?'10 €':'TBD',summary:'Syntetická služba na overenie tabuľky a dostupnosti.'}));
   d.items.push(item('decision:business','decision','DEMO · Vybrať variant pilotu',{decision_type:'business',why_needed:'Dva alternatívne koncepty',what_blocks:'Spustenie pilotu',blocking:true}));
   d.items.push(item('gap:supplier','data_gap','DEMO · Dodávateľ MISSING',{open_questions:'Supplier MISSING'}));
   const brief={role:'brief',url:'https://github.com/wwwsusi/lady-fitness-core/blob/main/synthetic-brief.md'};
   for(const [n,status]of ['DRAFT','PREPARING','READY','RUNNING','COMPLETED'].entries())d.items.push(item('campaign:'+n,'campaign','DEMO · Kampaň '+(n+1),{lifecycle:status,objective:'Podporiť návštevnosť syntetického pilotu.',start:'TBD',next_step:'Overiť doloženú pripravenosť.',publication:'NOT_PUBLISHED',results:'MISSING'},[],n===0?[]:[brief]));
   for(const [n,status]of ['DRAFT','READY','PUBLISHED_REPORTED'].entries())d.items.push(item('output:'+n,'output','DEMO · FB post '+(n+1),{objective:'Pozvať na syntetický pilot.',channel:'FACEBOOK',creative:n===0?'DRAFT':'READY',approval:n===0?'NOT APPROVED':'APPROVED',publication:n===2?'PUBLISHED_REPORTED':'NOT_PUBLISHED',platform_verification:'NOT_PERFORMED'},['campaign:'+(n+1)],n===0?[]:[{role:'asset',url:'https://drive.google.com/file/d/synthetic-poster/view'}]));
   d.items.push(item('LF-PROP-SYNTHETIC','idea','DEMO · Retail návrh',{evidence_status:'PROPOSED',summary:'Syntetický produktový návrh.',proposed_price:'TBD'}));
   d.sources.push({id:'coverage:campaign-details',role:'coverage',title:'Pokrytie detailných campaign briefs',status:'missing'});return d;}''')
  bundle={'format':'lf-operating-snapshot','version':1,'graph':{'nodes':[{'id':'synthetic:file','name':'SYNTHETIC GRAPH'}],'edges':[]},'dashboard':projection}
  await page.locator('#import').set_input_files({'name':'synthetic-compact.json','mimeType':'application/json','buffer':json.dumps(bundle).encode()})
  await page.wait_for_function('window.lfDashboardDiagnostics().items>20')
  root=page.locator('#dashboard')
  titles=await root.locator('.overview-stack>.dash-group>h3').all_text_contents()
  assert titles==['Executive Summary','Aktuálny smer','Dôležité teraz','NEXT STEPS','LAST BUSINESS DIRECTION CHANGES','NEW NOW items ADDED'],titles
  for title in ['Executive Summary','Aktuálny smer']:
   width=await root.locator('[data-title="'+title+'"]').evaluate('(el)=>el.getBoundingClientRect().width');assert width>1300,width
  assert await root.locator('[data-title="Dôležité teraz"] .task-row').count()==5
  assert await root.locator('[data-title="NEXT STEPS"] .task-row').count()==5
  assert await root.locator('[data-title="PENDING DECISIONS"]').count()==0
  assert await root.locator('[data-title="NEW PRODUCTS / SERVICES ADDED"]').count()==0
  for title in ['Dôležité teraz','NEXT STEPS']:
   assert await root.locator('[data-title="'+title+'"] .now-category').count()==3
  latest=root.locator('[data-title="NEW NOW items ADDED"]')
  assert await latest.locator('.task-row').count()==5
  assert '7. 10. 2026' in await latest.locator('.task-row').first.inner_text()
  assert 'Pokrytie detailných campaign briefs' not in await root.locator('.data-status').inner_text()
  assert 'DEMO · nedostupný zdroj' in await root.locator('.data-status').inner_text()
  await page.screenshot(path=str(output/'lf-compact-overview.png'),full_page=True)
  await page.get_by_role('button',name='Show all NOW →',exact=True).click();assert await root.locator('.task-row').count()==22
  await root.locator('.card-title').first.click();assert await page.locator('#dashboard-detail').is_visible();assert 'Dátum pridania' in await page.locator('#dashboard-detail').inner_text();await page.get_by_role('button',name='Zavrieť',exact=True).click()
  await page.screenshot(path=str(output/'lf-compact-now.png'),full_page=True)
  await page.get_by_role('button',name='Služby',exact=True).click()
  for name,count in [('Aktívne služby',3),('Služby v príprave a pilote',2),('Nápady a návrhy služieb',2)]:
   table=page.get_by_role('table',name=name,exact=True);assert await table.locator('tbody tr').count()==count
   assert await table.locator('th').all_text_contents()==['Názov','Popis','Cena','Lifecycle','Aktuálne dostupná']
  assert 'Nie' in await page.get_by_role('table',name='Aktívne služby',exact=True).inner_text()
  assert 'Cenník · aktuálny vs. navrhovaný' not in await root.inner_text()
  assert await page.get_by_role('table',name='Nové retailové návrhy').count()==1
  await page.screenshot(path=str(output/'lf-compact-services.png'),full_page=True)
  await page.get_by_role('button',name='Kampane a obsah',exact=True).click()
  for title,tone in [('DRAFT','danger'),('PREPARING','warning'),('READY','info'),('RUNNING','success')]:
   group=root.locator('[data-title="'+title+'"]');assert await group.get_attribute('data-tone')==tone;assert await group.locator('.campaign-row').count()==1
  assert 'CAMPAIGN BRIEF MISSING' in await root.locator('[data-title="DRAFT"]').inner_text()
  assert await page.get_by_role('table',name='FB POSTS',exact=True).locator('th').all_text_contents()==['Cieľ FB postu','MD popis / brief','Plagát / obrázok','Status','Campaign','Publication']
  assert 'platformovo neoverené' in await page.get_by_role('table',name='FB POSTS',exact=True).inner_text()
  await page.screenshot(path=str(output/'lf-compact-campaigns.png'),full_page=True)
  # Light-mode colors, import persistence, desktop and mobile overflow.
  await page.locator('#theme-toggle').click();await page.reload();await page.wait_for_function('window.lfDashboardDiagnostics().items>20');assert await page.locator('html').get_attribute('data-theme')=='light'
  for section in ['Prehľad','NOW','Služby','Kampane a obsah','Nápady','Rozhodnutia','Kvalita dát','Súbory']:
   await page.get_by_role('button',name=section,exact=True).click();assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),section
  await page.get_by_role('button',name='Služby',exact=True).click();await page.set_viewport_size({'width':390,'height':844});assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth');await page.screenshot(path=str(output/'lf-compact-mobile.png'),full_page=True)
  await page.get_by_role('button',name='Prehľad',exact=True).click()
  async with page.expect_download() as download:
   await page.get_by_role('button',name='Export pre AI · JSON',exact=True).click()
  downloaded=await download.value;report=json.loads(Path(await downloaded.path()).read_text());assert len(report['items'])==len(projection['items']);assert report['snapshot_at']==projection['generated_at']
  assert not any('googleapis.com' in u or '/api/dashboard' in u for u in requests)
  assert not errors,errors
  await browser.close()
  print('PASS: stacked overview, max5 NOW/NEXT, business-only decisions, source names, NOW detail, service tables/availability, retail, lifecycle colors, FB table/evidence, light/dark persistence, desktop/mobile, map, AI export, zero runtime errors; synthetic screenshots.')
asyncio.run(run());server.shutdown()

