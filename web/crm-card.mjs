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
export function mountCard({root,customer,onBack}){
 let live=true;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 root.replaceChildren();
 const wrap=el('section',undefined,'crm-card crm-card-screen');
 wrap.append(el('h2','Karta klientky'),el('p','Vytlač kartu na papier (približne veľkosť vizitky) a odovzdaj ju klientke. Pri ďalšej návšteve stačí kartu naskenovať.','crm-note'));
 const card=el('div',undefined,'crm-print-card');
 const img=el('img',undefined,'pc-logo');img.src=logo;img.alt='Lady Fitness';
 const qr=qrSvg(cardCode(customer.id));qr.classList.add('pc-qr');
 const grid=el('div',undefined,'pc-grid');grid.append(img,el('span',customer.name,'pc-name'),qr,el('span',CARD_MOTTO,'pc-motto'));card.append(grid);
 const actions=el('div',undefined,'crm-profile-actions');
 const print=el('button','Vytlačiť kartu');print.type='button';print.addEventListener('click',()=>{if(live)window.print();});
 const back=el('button','Späť ku klientke');back.type='button';back.addEventListener('click',()=>{if(live)onBack();});
 actions.append(print,back);wrap.append(card,actions);root.append(wrap);
 return {dispose(){live=false;root.replaceChildren();}};
}
