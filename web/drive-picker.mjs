export const DRIVE_FILE_SCOPE='https://www.googleapis.com/auth/drive.file';
export const MAX_SELECTED_ITEMS=600;
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
   results[index]={id:item.id,name:item.name,mimeType:item.mimeType,parents:Array.isArray(item.parents)?item.parents:[],modifiedTime:item.modifiedTime||null,webViewLink:item.webViewLink||null,trashed:Boolean(item.trashed)};
   completed++;onProgress(completed,results.length);
  }
 }
 const workers=Array.from({length:Math.min(8,results.length)},()=>worker());
 const settled=await Promise.allSettled(workers),failure=settled.find(result=>result.status==='rejected');
 if(failure)throw failure.reason;
 const ids=new Set(results.map(item=>item.id)),observedAt=new Date().toISOString();
 const nodes=results.map(item=>({id:'drive:'+item.id,name:item.name,source:'Google Drive',mime:item.mimeType,modified:item.modifiedTime,url:item.webViewLink,parents:item.parents,verified:true,metadataOnly:true,coverage:'metadata'}));
 const edges=[];
 for(const item of results)for(const parentId of item.parents){if(ids.has(parentId))edges.push({source:'drive:'+parentId,target:'drive:'+item.id,kind:'containment',evidence:[`Google Drive metadata parents[] · ${observedAt}`]});}
 const missingParentLinks=results.reduce((count,item)=>count+item.parents.filter(parentId=>!ids.has(parentId)).length,0);
 return {format:'lf-operating-snapshot',version:1,generated_at:observedAt,metadata_only:true,content_read:false,uploaded:false,selection_source:'google-picker',requested_scope:DRIVE_FILE_SCOPE,selected_count:results.length,selected_file_ids:results.map(item=>item.id),items:results,graph:{schema_version:1,updated_at:observedAt,coverage:{original_imported:false,scope:`Google Drive · metadata iba pre ${results.length} používateľom vybraných položiek · obsah súborov sa nečítal · ${missingParentLinks} rodičovských väzieb smeruje mimo výberu`,selected_count:results.length,missing_parent_links:missingParentLinks,complete:false},nodes,edges}};
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
 let accessToken='',tokenClient=null,busy=false,preparePromise=null;
 function prepare(){
  if(!enabled)return Promise.reject(Error('Google Picker ešte nie je nakonfigurovaný.'));
  if(!['https:','http:'].includes(location.protocol)||location.protocol==='http:'&&!['localhost','127.0.0.1'].includes(location.hostname))return Promise.reject(Error('Google Picker vyžaduje zabezpečenú HTTPS stránku.'));
  if(preparePromise)return preparePromise;
  preparePromise=Promise.all([
   loadScript('https://accounts.google.com/gsi/client',()=>Boolean(window.google?.accounts?.oauth2?.initTokenClient)),
   loadScript('https://apis.google.com/js/api.js',()=>Boolean(window.gapi?.load))
  ]).then(loadPickerApi).then(()=>{
   tokenClient=window.google.accounts.oauth2.initTokenClient({client_id:clientId,scope:DRIVE_FILE_SCOPE,include_granted_scopes:false,error_callback:()=>{accessToken='';busy=false;onStatus('Google prihlásenie bolo zatvorené alebo zablokované.');},callback:response=>{
    if(response.error){busy=false;onStatus('Google autorizáciu sa nepodarilo dokončiť.');return;}
    const scopes=new Set(String(response.scope||'').split(/\s+/).filter(Boolean));
    if(!response.access_token||scopes.size!==1||!scopes.has(DRIVE_FILE_SCOPE)){busy=false;onStatus('Google neudelil presne oprávnenie drive.file. Výber sa zastavil.');return;}
    accessToken=response.access_token;
    try{
     const view=new window.google.picker.DocsView(window.google.picker.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(true);
     let picker;
     picker=new window.google.picker.PickerBuilder().addView(view).enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED).setMaxItems(MAX_SELECTED_ITEMS).setOAuthToken(accessToken).setDeveloperKey(apiKey).setAppId(appId).setCallback(async data=>{
      const responseKey=window.google.picker.Response?.ACTION;
      const action=(responseKey&&data?.[responseKey])||data?.action;
      const actionName=typeof action==='string'?action.toLowerCase():'';
      // Google Picker also emits `loaded` while its dialog is opening. Keep the
      // dialog alive until the user picks, cancels, or an actual error occurs.
      if(actionName==='loaded'){
       onStatus('Picker je pripravený. Samotný výber priečinka nezahŕňa jeho obsah; pre úplnú mapu vyber aj požadované súbory a priečinky.');
       return;
      }
      if(actionName==='picked'||action===window.google.picker.Action.PICKED){try{const documents=data?.docs||[];createSelectionManifest(documents);onStatus(`Načítavam metadata iba pre ${documents.length} výslovne vybraných položiek…`);const manifest=await readSelectedMetadata(documents,accessToken,(done,total)=>onStatus(`Načítavam metadata vybraných položiek: ${done}/${total}…`));onManifest(manifest);onStatus(`Hotovo: metadata ${manifest.selected_count} vybraných položiek sú pripravené na lokálne stiahnutie. Obsah sa nečítal ani nič neodoslalo.`);}catch(error){onStatus(error.message||'Metadata vybraných položiek sa nepodarilo načítať.');}}
      else if(actionName==='cancel'||action===window.google.picker.Action.CANCEL)onStatus('Výber zrušený; žiadny súbor sa neodoslal.');
      else if(actionName==='error'||action===window.google.picker.Action.ERROR)onStatus('Google Picker oznámil chybu. Skontroluj, či je Google Picker API zapnuté a či API kľúč povoľuje lf-control-center.vercel.app aj docs.google.com/*; nič sa neodoslalo.');
      else {onStatus('Google Picker poslal neukončujúcu udalosť. Výber zostáva otvorený; vyber súbory alebo zavri okno.');return;}
      accessToken='';
      picker?.setVisible(false);busy=false;
     }).build();
     picker.setVisible(true);onStatus('Vyber iba požadované položky. Výber priečinka nevyberie jeho súbory; na zmapovanie obsahu vyber súbory aj priečinky.');
    }catch{accessToken='';busy=false;onStatus('Google Picker sa nepodarilo otvoriť.');}
   }});
  }).catch(error=>{preparePromise=null;onStatus(error.message||'Google Picker sa nepodarilo pripraviť.');throw error;});
  return preparePromise;
 }
 function open(){
  if(!enabled){onStatus('Google Picker ešte nie je nakonfigurovaný.');return;}
  if(!tokenClient){onStatus('Google Picker sa ešte pripravuje. Skús to o chvíľu.');return;}
  if(busy){onStatus('Google Picker už prebieha.');return;}
  busy=true;onStatus('Otváram bezpečné prihlásenie Google…');
  try{
   // Must be called directly from the user's click; do not await script loading here.
   tokenClient.requestAccessToken({prompt:'select_account consent',include_granted_scopes:false});
  }catch{busy=false;accessToken='';onStatus('Google prihlásenie sa nepodarilo otvoriť. Skontroluj blokovanie vyskakovacích okien.');}
 }
 return {enabled,prepare,open};
}

export function downloadSelectionManifest(manifest){
 const items=Array.isArray(manifest.items)?manifest.items:null;
 if(!items||items.length<1||items.length>MAX_SELECTED_ITEMS||items.some(item=>typeof item?.id!=='string'||!ID_PATTERN.test(item.id)||typeof item.name!=='string'||typeof item.mimeType!=='string')||new Set(items.map(item=>item.id)).size!==items.length)throw Error('Inventár vybraných položiek je neplatný.');
 const validated=manifest;
 if(validated.format!=='lf-operating-snapshot'||validated.version!==1||!validated.graph||!Array.isArray(validated.graph.nodes)||!Array.isArray(validated.graph.edges)||validated.graph.nodes.length!==items.length)throw Error('Snapshot vybraných položiek je neúplný.');
 const blob=new Blob([JSON.stringify(validated,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='lf-drive-selected-metadata-snapshot.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
}
