import {privacySummary} from './crm-privacy-summary-data.mjs';
/** Candidate follows the existing CRM api(path,{body,signal}) injection convention. */
export function mountPrivacySummary(root,{api,onAuthFailure=()=>{}}){
 const doc=root.ownerDocument;let sequence=0,controller,disposed=false;
 const node=(tag,text,css)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=String(text);if(css)e.className=css;return e;};
 async function refresh(){const version=++sequence;controller?.abort();controller=new AbortController();root.replaceChildren(node('h2','Ochrana údajov'),node('p','Načítavam kontrolu uchovávania…','crm-note'));root.setAttribute('aria-busy','true');
  try{const data=await api('/api/crm/read',{body:{view:'PRIVACY_RETENTION_SUMMARY'},signal:controller.signal});if(disposed||version!==sequence)return;const summary=privacySummary(data);const grid=node('div',undefined,'crm-grid');
   for(const [key,title] of [['inactive_24_months','Bez aktivity 24 mesiacov'],['blocked_by_service_or_payment','Chránené záväzkom alebo permanentkou'],['needs_manual_privacy_review','Na ďalšie posúdenie']]){const card=node('section',undefined,'crm-card');card.append(node('h3',title),node('p',new Intl.NumberFormat('sk-SK').format(BigInt(summary[key])),'crm-privacy-count'));grid.append(card);}
   root.replaceChildren(node('h2','Ochrana údajov'),grid,node('p','Právne výnimky a úplnosť histórie ešte nie sú vyhodnotené. Počet „Na ďalšie posúdenie“ neznamená povolenie na anonymizáciu.','crm-privacy-banner'),node('p','Anonymizácia je vypnutá. Tento súhrn neobsahuje mená ani kontakty klientiek.','crm-note'));
  }catch(error){if(disposed||version!==sequence||error.name==='AbortError')return;root.replaceChildren(node('h2','Ochrana údajov'));if(['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'].includes(error.code)){root.append(node('p','Kontrola nie je dostupná pre túto reláciu.','crm-note'));onAuthFailure(error.code);return;}root.append(node('p','Súhrn sa nepodarilo načítať. Žiadny zásah sa nevykonal.','crm-note'));const retry=node('button','Skúsiť znova');retry.type='button';retry.onclick=refresh;root.append(retry);
  }finally{if(!disposed&&version===sequence)root.removeAttribute('aria-busy');}}
 refresh();return {refresh,dispose(){disposed=true;sequence++;controller?.abort();root.replaceChildren();root.removeAttribute('aria-busy');}};
}
