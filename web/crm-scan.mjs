// Client card scanning: external barcode reader (acts as a keyboard) and the device camera (tablet/PC, Safari and Chrome).
// A card carries only "LF1:<token>" — an opaque, revocable code; no name, contact or client id. Scanning just opens the profile; nothing is written.
import jsQR from './crm-vendor-jsqr.mjs';
const TOKEN=/^[0-9a-f]{32}$/i;
export const CARD_PREFIX='LF1:';
export const cardCode=token=>CARD_PREFIX+String(token).toLowerCase();
// Returns the card token for a scanned/typed card code, or null. Rejects anything that is not exactly LF1:<32 hex>.
export function parseCardCode(value){
 if(typeof value!=='string')return null;
 const v=value.trim();
 if(!v.toUpperCase().startsWith(CARD_PREFIX))return null;
 const token=v.slice(CARD_PREFIX.length);
 return TOKEN.test(token)?token.toLowerCase():null;
}
// Hardware readers type the code very fast and finish with Enter. Collect such bursts when no field has focus.
// Keystrokes slower than maxGap are treated as a person typing and are ignored.
export function attachReader({onCode,maxGap=60,doc=document}){
 let buffer='',last=0;
 const editable=t=>t&&(t.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(t.tagName));
 function key(e){
  if(e.ctrlKey||e.metaKey||e.altKey||editable(e.target))return;
  const now=Date.now();
  if(now-last>maxGap)buffer='';
  last=now;
  if(e.key==='Enter'){const id=parseCardCode(buffer);buffer='';if(id){e.preventDefault();onCode(id);}return;}
  if(e.key.length===1)buffer+=e.key;
 }
 doc.addEventListener('keydown',key,true);
 return ()=>doc.removeEventListener('keydown',key,true);
}
const cameraMessage=error=>{
 const n=error?.name;
 if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)return 'Tento prehliadač alebo spojenie nepodporuje kameru. Použi čítačku alebo vyhľadaj klientku podľa mena.';
 if(n==='NotAllowedError'||n==='SecurityError')return 'Prístup ku kamere je zablokovaný. Povoľ kameru pre túto stránku v nastaveniach prehliadača a skús znova.';
 if(n==='NotFoundError'||n==='OverconstrainedError')return 'Kamera sa nenašla. Použi čítačku alebo vyhľadaj klientku podľa mena.';
 if(n==='NotReadableError')return 'Kameru práve používa iná aplikácia. Zatvor ju a skús znova.';
 return 'Kameru sa nepodarilo spustiť. Skús znova alebo vyhľadaj klientku podľa mena.';
};
// Camera scanner. Always releases the camera on dispose/close; reports only valid card codes.
export function mountScanner({root,onCode,onClose}){
 let live=true,stream=null,timer=null,busy=false;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const box=el('section',undefined,'crm-card crm-scan');
 const video=el('video');video.setAttribute('playsinline','');video.muted=true;video.autoplay=true;
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 const note=el('p','Priblíž QR kód z karty ku kamere.','crm-note');note.setAttribute('role','status');
 const typed=el('form',undefined,'crm-search');const label=el('label','Alebo ho zadaj / načítaj čítačkou'),input=el('input');input.autocomplete='off';input.spellcheck=false;input.placeholder='LF1:…';label.append(input);
 const go=el('button','Otvoriť');go.type='submit';typed.append(label,go);
 const close=el('button','Zavrieť skenovanie');close.type='button';
 box.append(el('h3','Skenovanie karty'),video,note,typed,close);root.append(box);
 function stop(){clearInterval(timer);timer=null;if(stream){for(const t of stream.getTracks())t.stop();stream=null;}video.srcObject=null;}
 function found(value){const id=parseCardCode(value);if(!id){note.textContent='Tento kód nie je karta klientky Lady Fitness.';return false;}stop();onCode(id);return true;}
 function tick(){
  if(live&&!box.isConnected){dispose();return;} // screen was replaced: always release the camera
  if(!live||busy||video.readyState<2||!video.videoWidth)return;busy=true;
  try{const scale=Math.min(1,640/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);ctx.drawImage(video,0,0,canvas.width,canvas.height);
   const frame=ctx.getImageData(0,0,canvas.width,canvas.height),hit=jsQR(frame.data,frame.width,frame.height,{inversionAttempts:'dontInvert'});
   if(hit?.data)found(hit.data);}catch{}finally{busy=false;}
 }
 async function start(){
  try{
   if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Object.assign(Error('unsupported'),{name:'NotSupported'});
   stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});
   if(!live){stop();return;}
   video.srcObject=stream;await video.play().catch(()=>{});timer=setInterval(tick,120);
  }catch(error){if(live){note.textContent=cameraMessage(error);video.hidden=true;}}
 }
 typed.addEventListener('submit',e=>{e.preventDefault();found(input.value);});
 close.addEventListener('click',()=>{dispose();onClose();});
 function dispose(){live=false;stop();box.remove();}
 start();
 return {dispose,isActive:()=>live};
}

// Reception PIN on a computer keyboard: maps a key press to the keypad key it stands for, or null when the press must be left alone
// (shortcuts, held keys, typing into a form field, any other key).
export function pinKeyFor(e){
 if(!e||e.ctrlKey||e.metaKey||e.altKey||e.repeat||['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return null;
 if(/^[0-9]$/.test(e.key))return e.key;
 if(e.key==='Backspace')return '⌫';
 if(e.key==='Escape'||e.key==='Delete')return 'Zrušiť';
 return null;
}
