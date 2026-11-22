// Printable client card (85.6 × 54 mm) with a QR code "LF1:<client id>". No contact details on the card.
import qrcode from './crm-vendor-qrcode.mjs';
import {cardCode} from './crm-scan.mjs';
import logo from './crm-logo.mjs';
const NS='http://www.w3.org/2000/svg';
// QR built as SVG DOM nodes, never from markup strings. Error correction M survives scuffs on a paper card.
export function qrSvg(text,{quiet=4}={}){
 const qr=qrcode(0,'M');qr.addData(text);qr.make();
 const n=qr.getModuleCount(),size=n+quiet*2,svg=document.createElementNS(NS,'svg');
 svg.setAttribute('viewBox','0 0 '+size+' '+size);svg.setAttribute('role','img');svg.setAttribute('aria-label','QR kód karty klientky');svg.setAttribute('shape-rendering','crispEdges');
 const bg=document.createElementNS(NS,'rect');bg.setAttribute('width',size);bg.setAttribute('height',size);bg.setAttribute('fill','#fff');svg.append(bg);
 let d='';for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))d+='M'+(c+quiet)+' '+(r+quiet)+'h1v1h-1z';
 const path=document.createElementNS(NS,'path');path.setAttribute('d',d);path.setAttribute('fill','#000');svg.append(path);
 return svg;
}
export const CARD_MOTTO='…krok po kroku bližšie k žene, ktorou chceš byť…';
// Card screen. The QR carries an opaque, revocable code. "Vygenerovať nový QR kód" revokes the old one (the old paper card stops working).
// Issuing uses one request id per attempt, so an unverified result can be checked or repeated without creating a second code.
export function mountCard({root,api,customer,card=null,onBack,onIssued,onAuthFailure}){
 let live=true,busy=false,pending=null;const controller=new AbortController();
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(label,fn)=>{const b=el('button',label);b.type='button';b.addEventListener('click',fn);return b;};
 root.replaceChildren();
 const wrap=el('section',undefined,'crm-card crm-card-screen'),notice=el('p');notice.setAttribute('role','status');
 wrap.append(el('h2','Karta klientky'));
 const actions=el('div',undefined,'crm-profile-actions');
 const issue=button(card?'Vygenerovať nový QR kód':'Vygenerovať QR kód',()=>begin());
 const verify=button('Overiť výsledok',()=>send(true)),retry=button('Zopakovať tú istú požiadavku',()=>send(false)),back=button('Späť ku klientke',()=>{if(live&&!busy&&!pending)onBack();});
 verify.hidden=retry.hidden=true;
 if(card){
  wrap.append(el('p','Vytlač kartu na papier (približne veľkosť vizitky) a odovzdaj ju klientke. Pri ďalšej návšteve stačí kartu naskenovať.','crm-note'));
  const sheet=el('div',undefined,'crm-print-card');
  const img=el('img',undefined,'pc-logo');img.src=logo;img.alt='Lady Fitness';
  const qr=qrSvg(cardCode(card.token));qr.classList.add('pc-qr');
  const grid=el('div',undefined,'pc-grid');grid.append(img,el('span',customer.name,'pc-name'),qr,el('span',CARD_MOTTO,'pc-motto'));sheet.append(grid);
  const print=button('Vytlačiť kartu',()=>{if(live)window.print();});
  actions.append(print,issue);wrap.append(sheet);
 }else{
  wrap.append(el('p','Klientka zatiaľ nemá kartu s QR kódom. Vygeneruj kód a potom kartu vytlač.','crm-note'));
  actions.append(issue);
 }
 actions.append(back);wrap.append(actions,notice,verify,retry);root.append(wrap);
 function render(){if(!live)return;const lock=busy||!!pending;issue.disabled=lock;back.disabled=lock;verify.hidden=retry.hidden=!pending;verify.disabled=retry.disabled=busy;}
 function begin(){
  if(busy||pending)return;
  if(card&&!window.confirm('Vygenerovať nový QR kód? Pôvodný QR kód prestane fungovať a kartu bude treba vytlačiť znova.'))return;
  pending={request_id:crypto.randomUUID(),operation_type:'ISSUE_CARD',payload:{customer_id:customer.id,expected_revision:String(customer.revision)}};send(false);
 }
 function failure(error){
  if(!live||error.name==='AbortError')return;
  if(['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'].includes(error.code)){onAuthFailure(error.code);return;}
  if(['VALIDATION_ERROR','POLICY_BLOCKED','BUSINESS_REJECTED','REVISION_CONFLICT'].includes(error.code)){pending=null;notice.textContent=error.code==='REVISION_CONFLICT'?'Údaje klientky sa medzičasom zmenili. Vráť sa ku klientke a otvor kartu znova.':error.code==='POLICY_BLOCKED'?'Karty s QR kódom zatiaľ nie sú zapnuté.':'Kód sa nepodarilo vygenerovať. Skontroluj, či je klientka aktívna.';}
  else notice.textContent='Výsledok sa nepodarilo overiť. Over výsledok alebo zopakuj tú istú požiadavku.';
 }
 function complete(data){
  if(data.operation?.state==='REJECTED'){pending=null;notice.textContent='Kód sa nepodarilo vygenerovať. Skontroluj, či je klientka aktívna.';return;}
  if(data.operation?.state!=='COMPLETED'||data.operation?.target_type!=='customer')throw Error('UNVERIFIED');
  pending=null;onIssued();
 }
 async function send(check){
  if(!live||busy||!pending)return;busy=true;notice.textContent=check?'Overujem výsledok…':'Generujem kód…';render();
  try{const data=await api(check?'/api/crm/readback?request_id='+encodeURIComponent(pending.request_id):'/api/crm/operations',{...(check?{}:{body:pending}),signal:controller.signal});if(live)complete(data);}
  catch(error){failure(error);}finally{busy=false;render();}
 }
 render();
 return {hasPending:()=>busy||!!pending,dispose(){live=false;controller.abort();pending=null;root.replaceChildren();}};
}
