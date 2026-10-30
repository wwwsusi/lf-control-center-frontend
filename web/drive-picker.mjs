export const DRIVE_FILE_SCOPE='https://www.googleapis.com/auth/drive.file';
export const MAX_SELECTED_ITEMS=600;
export const REQUIRED_MIGRATION_ITEMS=544;
export const REQUIRED_MIGRATION_FILES=443;
export const REQUIRED_MIGRATION_FOLDERS=101;
const REQUIRED_MIGRATION_SHA256='bce5adca4c82198bf72a9583b76f53f29861b29d5768d93fb0a76e8d48d09e1a';
const SELECTION_STORAGE_KEY='lf-drive-picker-batch-selection-v1';
const ID_PATTERN=/^[A-Za-z0-9_-]{10,256}$/;
const DRIVE_FILES_API='https://www.googleapis.com/drive/v3/files/';
const INVENTORY_FIELDS='id,name,mimeType,parents,modifiedTime,webViewLink,trashed';

export function createSelectionManifest(documents,createdAt=new Date().toISOString()){
 if(!Array.isArray(documents)||documents.length<1||documents.length>MAX_SELECTED_ITEMS)throw Error(`Vyber 1 až ${MAX_SELECTED_ITEMS} položiek.`);
 const ids=documents.map(item=>item?.id);
 if(ids.some(id=>typeof id!=='string'||!ID_PATTERN.test(id)))throw Error('Google Picker vrátil neplatné ID položky.');
 if(new Set(ids).size!==ids.length)throw Error('Google Picker vrátil duplicitné ID položky.');
 return {schema_version:1,selection_source:'google-picker',requested_scope:DRIVE_FILE_SCOPE,selected_file_ids:ids,created_at:createdAt};
}

async function readSelectedMetadata(documents,accessToken,onProgress=()=>{}){
 const selection=createSelectionManifest(documents);
 const results=new Array(selection.selected_file_ids.length);
 let nextIndex=0,completed=0;
 async function worker(){
  while(true){
   const index=nextIndex++;
   if(index>=selection.selected_file_ids.length)return;
   const id=selection.selected_file_ids[index];let response;
   for(let attempt=0;attempt<3;attempt++){
    try{
     response=await fetch(DRIVE_FILES_API+encodeURIComponent(id)+'?fields='+encodeURIComponent(INVENTORY_FIELDS),{headers:{Authorization:'Bearer '+accessToken},signal:AbortSignal.timeout(20000),cache:'no-store'});
    }catch(error){if(attempt===2)throw Error('Google Drive metadata sa nepodarilo načítať. Skontroluj pripojenie a skús výber zopakovať.');await new Promise(resolve=>setTimeout(resolve,300*2**attempt));continue;}
    if(response.ok)break;
    if([429,500,502,503,504].includes(response.status)&&attempt<2){await new Promise(resolve=>setTimeout(resolve,300*2**attempt));continue;}
    if(response.status===401||response.status===403)throw Error(`Google Drive odmietol prístup k vybraným položkám (HTTP ${response.status}). Skontroluj účet a oprávnenie drive.file.`);
    throw Error(`Google Drive metadata sa nepodarilo načítať (HTTP ${response.status}).`);
   }
   let item;try{item=await response.json();}catch{throw Error('Google Drive vrátil neplatné metadata. Výber sa neuložil.');}
   if(item?.id!==id||typeof item?.name!=='string'||typeof item?.mimeType!=='string')throw Error('Google Drive vrátil neúplné metadata. Výber sa neuložil.');
   if(item.trashed)throw Error('Vybraná položka je v koši. Výber sa nepridal.');
   results[index]={id:item.id,name:item.name,mimeType:item.mimeType,parents:Array.isArray(item.parents)?item.parents:[],modifiedTime:item.modifiedTime||null,webViewLink:item.webViewLink||null,trashed:false};
   completed++;onProgress(completed,results.length);
  }
 }
 const workers=Array.from({length:Math.min(8,results.length)},()=>worker());
 const settled=await Promise.allSettled(workers),failure=settled.find(result=>result.status==='rejected');
 if(failure)throw failure.reason;
 return results;
}

export function migrationSelectionProgress(items){
 const list=Array.isArray(items)?items:[];
 const folders=list.filter(item=>item?.mimeType==='application/vnd.google-apps.folder').length;
 const files=list.length-folders;
 return {selected:list.length,files,folders,required:REQUIRED_MIGRATION_ITEMS,complete:false,exact:false};
}

export async function isExactMigrationSelection(items){
 const progress=migrationSelectionProgress(items);
 if(progress.selected!==REQUIRED_MIGRATION_ITEMS||progress.files!==REQUIRED_MIGRATION_FILES||progress.folders!==REQUIRED_MIGRATION_FOLDERS||!globalThis.crypto?.subtle)return false;
 const ids=items.map(item=>item.id);
 if(ids.some(id=>typeof id!=='string'||!ID_PATTERN.test(id))||new Set(ids).size!==ids.length)return false;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode([...ids].sort().join('\n')));
 const actual=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
 return actual===REQUIRED_MIGRATION_SHA256;
}

export async function createMetadataSnapshot(results){
 const observedAt=new Date().toISOString(),ids=new Set(results.map(item=>item.id));
 const nodes=results.map(item=>({id:'drive:'+item.id,name:item.name,source:'Google Drive',mime:item.mimeType,modified:item.modifiedTime,url:item.webViewLink,parents:item.parents,verified:true,metadataOnly:true,coverage:'metadata'}));
 const edges=[];
 for(const item of results)for(const parentId of item.parents){if(ids.has(parentId))edges.push({source:'drive:'+parentId,target:'drive:'+item.id,kind:'containment',evidence:[`Google Drive metadata parents[] · ${observedAt}`]});}
 const missingParentLinks=results.reduce((count,item)=>count+item.parents.filter(parentId=>!ids.has(parentId)).length,0);
 const progress=migrationSelectionProgress(results),exact=await isExactMigrationSelection(results);
 return {format:'lf-operating-snapshot',version:1,generated_at:observedAt,metadata_only:true,content_read:false,uploaded:false,selection_source:'google-picker',requested_scope:DRIVE_FILE_SCOPE,selected_count:results.length,selected_file_ids:results.map(item=>item.id),items:results,graph:{schema_version:1,updated_at:observedAt,coverage:{original_imported:false,scope:`Google Drive · metadata iba pre ${results.length} používateľom vybraných položiek · obsah súborov sa nečítal · ${missingParentLinks} rodičovských väzieb smeruje mimo výberu`,selected_count:results.length,selected_files:progress.files,selected_folders:progress.folders,missing_parent_links:missingParentLinks,complete:exact},nodes,edges}};
}

function loadScript(src,ready){
 return new Promise((resolve,reject)=>{
  if(ready()){resolve();return;}
  const existing=[...document.scripts].find(script=>script.src===src);
  const script=existing||document.createElement('script');let timer;
  const finish=(error)=>{clearTimeout(timer);script.removeEventListener('load',loaded);script.removeEventListener('error',failed);error?reject(error):resolve();};
  const loaded=()=>ready()?finish():finish(Error('Google knižnica sa nenačítala.'));
  const failed=()=>finish(Error('Google služba nie je dostupná.'));
  script.addEventListener('load',loaded,{once:true});script.addEventListener('error',failed,{once:true});
  timer=setTimeout(()=>finish(Error('Časový limit Google knižnice.')),15000);
  if(!existing){script.src=src;script.async=true;script.defer=true;document.head.append(script);}
 });
}

function loadPickerApi(){
 return new Promise((resolve,reject)=>{
  try{window.gapi.load('picker',{callback:resolve,onerror:()=>reject(Error('Google Picker sa nenačítal.')),ontimeout:()=>reject(Error('Časový limit Google Picker.')),timeout:15000});}
  catch{reject(Error('Google Picker sa nenačítal.'));}
 });
}

export function configureDrivePicker({config={},onStatus=()=>{},onManifest=()=>{}}={}){
 const clientId=typeof config.clientId==='string'?config.clientId.trim():'';
 const apiKey=typeof config.apiKey==='string'?config.apiKey.trim():'';
 const appId=typeof config.appId==='string'?config.appId.trim():'';
 const enabled=Boolean(clientId&&apiKey&&appId);
 let accessToken='',tokenExpiresAt=0,tokenClient=null,busy=false,preparePromise=null;
 const accumulatedItems=new Map();
 try{
  const saved=JSON.parse(sessionStorage.getItem(SELECTION_STORAGE_KEY)||'null');
  if(saved?.selection_source==='google-picker'&&saved?.requested_scope===DRIVE_FILE_SCOPE&&Array.isArray(saved.items)&&saved.items.length<=MAX_SELECTED_ITEMS){
   for(const item of saved.items){if(typeof item?.id==='string'&&ID_PATTERN.test(item.id)&&typeof item.name==='string'&&typeof item.mimeType==='string'&&!item.trashed&&!accumulatedItems.has(item.id))accumulatedItems.set(item.id,{id:item.id,name:item.name,mimeType:item.mimeType,parents:Array.isArray(item.parents)?item.parents:[],modifiedTime:item.modifiedTime||null,webViewLink:item.webViewLink||null,trashed:false});}
  }
 }catch{}
 const progress=()=>migrationSelectionProgress([...accumulatedItems.values()]);
 function saveSelection(){try{sessionStorage.setItem(SELECTION_STORAGE_KEY,JSON.stringify({selection_source:'google-picker',requested_scope:DRIVE_FILE_SCOPE,items:[...accumulatedItems.values()]}));return true;}catch{return false;}}
 function resetSelection(){accumulatedItems.clear();try{sessionStorage.removeItem(SELECTION_STORAGE_KEY);}catch{}onManifest(null,progress(),false,false);onStatus('Výber vymazaný. Začni novú dávku v Google Drive Pickeri.');}
 async function handlePicked(data){
  const documents=data?.docs||[];createSelectionManifest(documents);
  const fresh=documents.filter(item=>!accumulatedItems.has(item.id));
  if(!fresh.length){
   const all=[...accumulatedItems.values()],snapshot=all.length?await createMetadataSnapshot(all):null,exact=snapshot?.graph.coverage.complete===true;
   onManifest(exact?snapshot:null,progress(),exact,true);
   onStatus(exact?'Presná zhoda je obnovená. Stiahni úplný snapshot.':`V tejto dávke neboli nové položky. Stále vybrané: ${accumulatedItems.size}/${REQUIRED_MIGRATION_ITEMS}.`);
   return;
  }
  onStatus(`Načítavam metadata novej dávky (${fresh.length}); predchádzajúce dávky zostávajú zachované…`);
  const metadata=await readSelectedMetadata(fresh,accessToken,(done,total)=>onStatus(`Načítavam metadata novej dávky: ${done}/${total}…`));
  for(const item of metadata)accumulatedItems.set(item.id,item);
  const persisted=saveSelection(),all=[...accumulatedItems.values()],snapshot=await createMetadataSnapshot(all),state=progress(),exact=snapshot.graph.coverage.complete===true;
  onManifest(snapshot,state,exact,persisted);
  if(exact)onStatus(`Presná zhoda: 544/544 položiek (443 súborov + 101 priečinkov). Úplný metadata snapshot je pripravený na lokálne stiahnutie. Obsah súborov sa nečítal ani nič sa neodoslalo.`);
  else if(state.selected>=REQUIRED_MIGRATION_ITEMS)onStatus(`Vybraných ${state.selected} položiek, ale výber sa nezhoduje presne so schválenou migráciou 443 súborov + 101 priečinkov. Snapshot sa nedá stiahnuť; vymaž výber a zopakuj ho po dávkach.`);
  else onStatus(`Dávka pridaná: ${metadata.length} nových. Spolu ${state.selected}/${state.required} (súbory ${state.files}/${REQUIRED_MIGRATION_FILES}, priečinky ${state.folders}/${REQUIRED_MIGRATION_FOLDERS}). Pokračuj ďalšou dávkou; priečinok sám nepridá svoje deti.${persisted?' Výber sa drží v tejto karte.':' Výber sa drží len do obnovenia stránky.'}`);
 }
 function showPicker(){
  try{
   const view=new window.google.picker.DocsView(window.google.picker.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(true);
   let picker;
   picker=new window.google.picker.PickerBuilder().addView(view).enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED).setMaxItems(MAX_SELECTED_ITEMS).setOAuthToken(accessToken).setDeveloperKey(apiKey).setAppId(appId).setCallback(async data=>{
    const responseKey=window.google.picker.Response?.ACTION;
    const action=(responseKey&&data?.[responseKey])||data?.action;
    const actionName=typeof action==='string'?action.toLowerCase():'';
    if(actionName==='loaded'){onStatus(`Picker pripravený. Vyber jednu dávku, potvrď Select a zopakuj pre ďalší priečinok. Dávky sa spoja. Aktuálne ${accumulatedItems.size}/${REQUIRED_MIGRATION_ITEMS}.`);return;}
    if(actionName==='picked'||action===window.google.picker.Action.PICKED){try{await handlePicked(data);}catch(error){onStatus(error.message||'Metadata dávky sa nepodarilo načítať; dávka sa nepridala.');}}
    else if(actionName==='cancel'||action===window.google.picker.Action.CANCEL)onStatus(`Picker zatvorený. Doterajší výber zostáva zachovaný: ${accumulatedItems.size}/${REQUIRED_MIGRATION_ITEMS}.`);
    else if(actionName==='error'||action===window.google.picker.Action.ERROR)onStatus('Google Picker oznámil chybu. Skontroluj API kľúč a pripojenie; predchádzajúce dávky zostávajú zachované.');
    else {onStatus('Google Picker poslal neukončujúcu udalosť. Výber zostáva otvorený; predchádzajúce dávky zostávajú zachované.');return;}
    picker?.setVisible(false);busy=false;
   }).build();
   picker.setVisible(true);onStatus(`Vyber dávku súborov/priečinkov a klikni Select. Potom zopakuj pre ďalší priečinok; dávky sa spoja. Vybrané ${accumulatedItems.size}/${REQUIRED_MIGRATION_ITEMS}.`);
  }catch{accessToken='';tokenExpiresAt=0;busy=false;onStatus('Google Picker sa nepodarilo otvoriť.');}
 }
 if(accumulatedItems.size){
  const restored=[...accumulatedItems.values()];
  createMetadataSnapshot(restored).then(snapshot=>{const exact=snapshot.graph.coverage.complete===true;onManifest(exact?snapshot:null,progress(),exact,true);if(exact)onStatus('Obnovený výber je úplný. Stiahni snapshot alebo vymaž dávky.');}).catch(()=>onManifest(null,progress(),false,true));
 }else onManifest(null,progress(),false,false);
 function prepare(){
  if(!enabled)return Promise.reject(Error('Google Picker ešte nie je nakonfigurovaný.'));
  if(!['https:','http:'].includes(location.protocol)||location.protocol==='http:'&&!['localhost','127.0.0.1'].includes(location.hostname))return Promise.reject(Error('Google Picker vyžaduje zabezpečenú HTTPS stránku.'));
  if(preparePromise)return preparePromise;
  preparePromise=Promise.all([
   loadScript('https://accounts.google.com/gsi/client',()=>Boolean(window.google?.accounts?.oauth2?.initTokenClient)),
   loadScript('https://apis.google.com/js/api.js',()=>Boolean(window.gapi?.load))
  ]).then(loadPickerApi).then(()=>{
   tokenClient=window.google.accounts.oauth2.initTokenClient({client_id:clientId,scope:DRIVE_FILE_SCOPE,include_granted_scopes:false,error_callback:()=>{accessToken='';tokenExpiresAt=0;busy=false;onStatus('Google prihlásenie bolo zatvorené alebo zablokované. Doterajšie dávky zostávajú zachované.');},callback:response=>{
    if(response.error){busy=false;onStatus('Google autorizáciu sa nepodarilo dokončiť.');return;}
    const scopes=new Set(String(response.scope||'').split(/\s+/).filter(Boolean));
    if(!response.access_token||scopes.size!==1||!scopes.has(DRIVE_FILE_SCOPE)){busy=false;onStatus('Google neudelil presne oprávnenie drive.file. Výber sa zastavil.');return;}
    accessToken=response.access_token;
    tokenExpiresAt=Date.now()+Math.max(60,Number(response.expires_in)||3600)*1000;
    showPicker();
   }});
  }).catch(error=>{preparePromise=null;onStatus(error.message||'Google Picker sa nepodarilo pripraviť.');throw error;});
  return preparePromise;
 }
 function open(){
  if(!enabled){onStatus('Google Picker ešte nie je nakonfigurovaný.');return;}
  if(!tokenClient){onStatus('Google Picker sa ešte pripravuje. Skús to o chvíľu.');return;}
  if(busy){onStatus('Google Picker už prebieha.');return;}
  busy=true;
  if(accessToken&&Date.now()<tokenExpiresAt-30000){showPicker();return;}
  onStatus('Otváram bezpečné prihlásenie Google…');
  try{
   // Must be called directly from the user's click; do not await script loading here.
   tokenClient.requestAccessToken({prompt:'select_account consent',include_granted_scopes:false});
  }catch{busy=false;accessToken='';tokenExpiresAt=0;onStatus('Google prihlásenie sa nepodarilo otvoriť. Skontroluj blokovanie vyskakovacích okien.');}
 }
 return {enabled,prepare,open,resetSelection};
}

export function downloadSelectionManifest(manifest){
 const items=Array.isArray(manifest.items)?manifest.items:null;
 if(!items||items.length<1||items.length>MAX_SELECTED_ITEMS||items.some(item=>typeof item?.id!=='string'||!ID_PATTERN.test(item.id)||typeof item.name!=='string'||typeof item.mimeType!=='string')||new Set(items.map(item=>item.id)).size!==items.length)throw Error('Inventár vybraných položiek je neplatný.');
 const validated=manifest;
 if(validated.format!=='lf-operating-snapshot'||validated.version!==1||!validated.graph||!Array.isArray(validated.graph.nodes)||!Array.isArray(validated.graph.edges)||validated.graph.nodes.length!==items.length)throw Error('Snapshot vybraných položiek je neúplný.');
 if(validated.graph.coverage?.complete!==true||items.length!==REQUIRED_MIGRATION_ITEMS)throw Error('Výber ešte presne nezodpovedá schválenému inventáru 544 položiek. Neúplný výber sa nedá stiahnuť.');
 const blob=new Blob([JSON.stringify(validated,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='lf-drive-selected-metadata-snapshot.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
}
