export const DRIVE_FILE_SCOPE='https://www.googleapis.com/auth/drive.file';
const ID_PATTERN=/^[A-Za-z0-9_-]{10,256}$/;

export function createSelectionManifest(documents,createdAt=new Date().toISOString()){
 if(!Array.isArray(documents)||documents.length<1||documents.length>500)throw Error('Vyber 1 až 500 položiek.');
 const ids=documents.map(item=>item?.id);
 if(ids.some(id=>typeof id!=='string'||!ID_PATTERN.test(id)))throw Error('Google Picker vrátil neplatné ID položky.');
 if(new Set(ids).size!==ids.length)throw Error('Google Picker vrátil duplicitné ID položky.');
 return {schema_version:1,selection_source:'google-picker',requested_scope:DRIVE_FILE_SCOPE,selected_file_ids:ids,created_at:createdAt};
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
 let accessToken='',tokenClient=null,busy=false;
 async function open(){
  if(!enabled)throw Error('Google Picker ešte nie je nakonfigurovaný.');
  if(!['https:','http:'].includes(location.protocol)||location.protocol==='http:'&&!['localhost','127.0.0.1'].includes(location.hostname))throw Error('Google Picker vyžaduje zabezpečenú HTTPS stránku.');
  if(busy)throw Error('Google Picker už prebieha.');busy=true;onStatus('Načítavam bezpečný výber Google Drive…');
  try{
   await Promise.all([
    loadScript('https://accounts.google.com/gsi/client',()=>Boolean(window.google?.accounts?.oauth2?.initTokenClient)),
    loadScript('https://apis.google.com/js/api.js',()=>Boolean(window.gapi?.load))
   ]);
   await loadPickerApi();
   tokenClient=window.google.accounts.oauth2.initTokenClient({client_id:clientId,scope:DRIVE_FILE_SCOPE,include_granted_scopes:false,error_callback:()=>{accessToken='';busy=false;onStatus('Google prihlásenie bolo zatvorené alebo zablokované.');},callback:response=>{
    if(response.error){busy=false;onStatus('Google autorizáciu sa nepodarilo dokončiť.');return;}
    const scopes=new Set(String(response.scope||'').split(/\s+/).filter(Boolean));
    if(!response.access_token||scopes.size!==1||!scopes.has(DRIVE_FILE_SCOPE)){busy=false;onStatus('Google neudelil presne oprávnenie drive.file. Výber sa zastavil.');return;}
    accessToken=response.access_token;
    try{
     const view=new window.google.picker.DocsView(window.google.picker.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(true);
     let picker;
     picker=new window.google.picker.PickerBuilder().addView(view).enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED).setOAuthToken(accessToken).setDeveloperKey(apiKey).setAppId(appId).setCallback(data=>{
      accessToken='';
      if(data.action===window.google.picker.Action.PICKED){try{const manifest=createSelectionManifest(data.docs||[]);onManifest(manifest);onStatus(`Pripravený výber ${manifest.selected_file_ids.length} položiek. Súbor ešte nie je odoslaný ani synchronizovaný.`);}catch(error){onStatus(error.message);}}
      else onStatus('Výber zrušený; žiadny súbor sa neodoslal.');
      picker?.setVisible(false);busy=false;
     }).build();
     picker.setVisible(true);onStatus('V Google okne vyber účet lady.fitness.he@gmail.com a iba požadované súbory alebo priečinky.');
    }catch{accessToken='';busy=false;onStatus('Google Picker sa nepodarilo otvoriť.');}
   }});
   tokenClient.requestAccessToken({prompt:'select_account consent',include_granted_scopes:false});
  }catch(error){busy=false;accessToken='';onStatus(error.message||'Google Picker sa nepodarilo otvoriť.');throw error;}
 }
 return {enabled,open};
}

export function downloadSelectionManifest(manifest){
 const validated=createSelectionManifest(manifest.selected_file_ids.map(id=>({id})),manifest.created_at);
 const blob=new Blob([JSON.stringify(validated,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='drive-picker-selection.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
}
