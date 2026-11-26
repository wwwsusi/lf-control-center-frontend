// The A4 client report, built only from DOM nodes. Client-entered text is always set as text, never parsed as markup.
import logo from './crm-logo.mjs';
import {SEGMENTS,RECOMMENDATIONS,VISCERAL_MAX,num,fmt,bmi,delta,summary,fatBands,BMI_BANDS,VISCERAL_BANDS,WATER_BANDS,bandPosition,PHYSIQUE} from './crm-body-model.mjs';
// Decorative figure; it does not change with the measured values.
const FIGURE="data:image/svg+xml;charset=utf-8,"+encodeURIComponent("<svg width='90' height='223' viewBox='0 -4 200 498' xmlns='http://www.w3.org/2000/svg'><defs><clipPath id='bodyclip'><path d='M90 62 L90 84 C82 88 66 91 54 96 C49 98 47 104 46 111 L55 140 C58 150 60 158 61 164 C63 176 67 186 67 197 C67 212 62 226 58 240 C56 252 56 266 59 280 C60 310 63 340 64 362 C64 380 60 392 61 408 C62 428 67 445 69 456 C67 466 62 475 59 481 C58 488 64 491 72 491 C80 491 86 489 88 483 C88 473 87 466 87 458 C88 440 89 425 89 410 C89 396 92 380 92 362 C93 335 96 300 97 280 C98 270 99 262 100 256 L100 58 Z' /><path d='M90 62 L90 84 C82 88 66 91 54 96 C49 98 47 104 46 111 L55 140 C58 150 60 158 61 164 C63 176 67 186 67 197 C67 212 62 226 58 240 C56 252 56 266 59 280 C60 310 63 340 64 362 C64 380 60 392 61 408 C62 428 67 445 69 456 C67 466 62 475 59 481 C58 488 64 491 72 491 C80 491 86 489 88 483 C88 473 87 466 87 458 C88 440 89 425 89 410 C89 396 92 380 92 362 C93 335 96 300 97 280 C98 270 99 262 100 256 L100 58 Z' transform='translate(200 0) scale(-1 1)'/></clipPath></defs><path d='M79 36 L121 36 C128 62 127 84 123 100 C112 94 88 94 77 100 C73 84 72 62 79 36 Z' fill='#e39cb8' stroke='#c9477b' stroke-width='1.2' stroke-linejoin='round'/><path d='M90 62 L90 84 C82 88 66 91 54 96 C49 98 47 104 46 111 L55 140 C58 150 60 158 61 164 C63 176 67 186 67 197 C67 212 62 226 58 240 C56 252 56 266 59 280 C60 310 63 340 64 362 C64 380 60 392 61 408 C62 428 67 445 69 456 C67 466 62 475 59 481 C58 488 64 491 72 491 C80 491 86 489 88 483 C88 473 87 466 87 458 C88 440 89 425 89 410 C89 396 92 380 92 362 C93 335 96 300 97 280 C98 270 99 262 100 256 L100 58 Z' fill='#fcf0f4' stroke='#fcf0f4' stroke-width='1' /><path d='M90 62 L90 84 C82 88 66 91 54 96 C49 98 47 104 46 111 L55 140 C58 150 60 158 61 164 C63 176 67 186 67 197 C67 212 62 226 58 240 C56 252 56 266 59 280 C60 310 63 340 64 362 C64 380 60 392 61 408 C62 428 67 445 69 456 C67 466 62 475 59 481 C58 488 64 491 72 491 C80 491 86 489 88 483 C88 473 87 466 87 458 C88 440 89 425 89 410 C89 396 92 380 92 362 C93 335 96 300 97 280 C98 270 99 262 100 256 L100 58 Z' fill='#fcf0f4' stroke='#fcf0f4' stroke-width='1' transform='translate(200 0) scale(-1 1)'/><g clip-path='url(#bodyclip)'><path d='M30 146 C60 138 90 144 100 144 L100 172 C90 173 74 176 30 170 Z' fill='#f3cbda' /><path d='M30 238 C60 238 90 240 100 241 L100 272 C86 266 68 258 54 252 L30 252 Z' fill='#f3cbda' /><path d='M30 146 C60 138 90 144 100 144 L100 172 C90 173 74 176 30 170 Z' fill='#f3cbda' transform='translate(200 0) scale(-1 1)'/><path d='M30 238 C60 238 90 240 100 241 L100 272 C86 266 68 258 54 252 L30 252 Z' fill='#f3cbda' transform='translate(200 0) scale(-1 1)'/></g><path d='M90 62 L90 84 C82 88 66 91 54 96 C49 98 47 104 46 111 L55 140 C58 150 60 158 61 164 C63 176 67 186 67 197 C67 212 62 226 58 240 C56 252 56 266 59 280 C60 310 63 340 64 362 C64 380 60 392 61 408 C62 428 67 445 69 456 C67 466 62 475 59 481 C58 488 64 491 72 491 C80 491 86 489 88 483 C88 473 87 466 87 458 C88 440 89 425 89 410 C89 396 92 380 92 362 C93 335 96 300 97 280 C98 270 99 262 100 256' fill='none' stroke='#c9477b' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round' /><path d='M90 62 L90 84 C82 88 66 91 54 96 C49 98 47 104 46 111 L55 140 C58 150 60 158 61 164 C63 176 67 186 67 197 C67 212 62 226 58 240 C56 252 56 266 59 280 C60 310 63 340 64 362 C64 380 60 392 61 408 C62 428 67 445 69 456 C67 466 62 475 59 481 C58 488 64 491 72 491 C80 491 86 489 88 483 C88 473 87 466 87 458 C88 440 89 425 89 410 C89 396 92 380 92 362 C93 335 96 300 97 280 C98 270 99 262 100 256' fill='none' stroke='#c9477b' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round' transform='translate(200 0) scale(-1 1)'/><path d='M92 90 C84 94 70 96 57 102' fill='none' stroke='#c9477b' stroke-width='1' opacity='.7' stroke-linecap='round' /><path d='M58 148 C72 140 90 144 100 144' fill='none' stroke='#c9477b' stroke-width='1' opacity='.7' stroke-linecap='round' /><path d='M60 170 C74 176 90 174 100 173' fill='none' stroke='#c9477b' stroke-width='1' opacity='.7' stroke-linecap='round' /><path d='M54 238 C76 238 90 240 100 241' fill='none' stroke='#c9477b' stroke-width='1' opacity='.7' stroke-linecap='round' /><path d='M54 252 C68 258 86 266 100 272' fill='none' stroke='#c9477b' stroke-width='1' opacity='.7' stroke-linecap='round' /><path d='M92 90 C84 94 70 96 57 102' fill='none' stroke='#c9477b' stroke-width='1' opacity='.7' stroke-linecap='round' transform='translate(200 0) scale(-1 1)'/><path d='M58 148 C72 140 90 144 100 144' fill='none' stroke='#c9477b' stroke-width='1' opacity='.7' stroke-linecap='round' transform='translate(200 0) scale(-1 1)'/><path d='M60 170 C74 176 90 174 100 173' fill='none' stroke='#c9477b' stroke-width='1' opacity='.7' stroke-linecap='round' transform='translate(200 0) scale(-1 1)'/><path d='M54 238 C76 238 90 240 100 241' fill='none' stroke='#c9477b' stroke-width='1' opacity='.7' stroke-linecap='round' transform='translate(200 0) scale(-1 1)'/><path d='M54 252 C68 258 86 266 100 272' fill='none' stroke='#c9477b' stroke-width='1' opacity='.7' stroke-linecap='round' transform='translate(200 0) scale(-1 1)'/><path d='M100 208 L100 216' stroke='#c9477b' stroke-width='1.2' opacity='.7' stroke-linecap='round'/><path d='M52 97 C46 99 43 106 42 117 C41 143 38 168 39 188 C40 213 43 238 46 255 C45 263 44 272 46 281 C47 288 52 288 53 282 C55 286 59 283 58 275 C60 267 60 258 60 250 C59 234 57 213 56 196 C54 182 59 172 61 164 L55 140 Z' fill='#fcf0f4' stroke='#fcf0f4' stroke-width='1' /><path d='M52 97 C46 99 43 106 42 117 C41 143 38 168 39 188 C40 213 43 238 46 255 C45 263 44 272 46 281 C47 288 52 288 53 282 C55 286 59 283 58 275 C60 267 60 258 60 250 C59 234 57 213 56 196 C54 182 59 172 61 164 L55 140 Z' fill='#fcf0f4' stroke='#fcf0f4' stroke-width='1' transform='translate(200 0) scale(-1 1)'/><path d='M52 97 C46 99 43 106 42 117 C41 143 38 168 39 188 C40 213 43 238 46 255 C45 263 44 272 46 281 C47 288 52 288 53 282 C55 286 59 283 58 275 C60 267 60 258 60 250 C59 234 57 213 56 196 C54 182 59 172 61 164' fill='none' stroke='#c9477b' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round' /><path d='M52 97 C46 99 43 106 42 117 C41 143 38 168 39 188 C40 213 43 238 46 255 C45 263 44 272 46 281 C47 288 52 288 53 282 C55 286 59 283 58 275 C60 267 60 258 60 250 C59 234 57 213 56 196 C54 182 59 172 61 164' fill='none' stroke='#c9477b' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round' transform='translate(200 0) scale(-1 1)'/><ellipse cx='100' cy='38' rx='22' ry='28' fill='#fcf0f4' stroke='#c9477b' stroke-width='1.4'/><path d='M78 40 A22 28 0 0 1 122 40 C118 29 108 24 100 24 C92 24 82 29 78 40 Z' fill='#e39cb8' stroke='#c9477b' stroke-width='1.2'/></svg>");
export const DISCLAIMER='Hodnoty sú orientačné a nenahrádzajú lekárske vyšetrenie.';
const NS='http://www.w3.org/2000/svg';
const el=(tag,cls,...children)=>{const n=document.createElement(tag);if(cls)n.className=cls;n.append(...children.filter(c=>c!==null&&c!==undefined&&c!==''));return n;};
const svg=(tag,attrs)=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
const skDay=v=>{const [y,m,d]=String(v).split('-').map(Number);return d+'. '+m+'. '+y;};
const h3=text=>el('h3','',text);
const pill=(tone,text)=>el('span','pill '+tone,text);
function change(current,previous,decimals,unit,good){
 const d=delta(current,previous,decimals);if(!d)return null;
 const tone=d.sign===0||!good?'neu':d.sign===good?'good':'warn';
 return pill(tone,d.text+(unit?' '+unit:''));
}
function donut(m,previous){
 const w=num(m.weight_kg),fat=num(m.fat_pct),R=82,C=2*Math.PI*R,arc=Number.isFinite(fat)?Math.max(0,Math.min(100,fat)):0;
 const ring=svg('svg',{viewBox:'0 0 200 200'});
 ring.append(svg('circle',{cx:100,cy:100,r:R,fill:'none',stroke:'#ece3e6','stroke-width':22}),svg('circle',{cx:100,cy:100,r:R,fill:'none',stroke:'#b0406f','stroke-width':22,'stroke-dasharray':(C*arc/100)+' '+C,transform:'rotate(-90 100 100)'}));
 const center=el('div','c',el('span','','Hmotnosť'),el('b','',fmt(w,1)+' ',el('small','','kg')));
 const d=delta(w,num(previous?.weight_kg),1);
 if(d)center.append(pill('bw',(d.sign<0?'↓ ':d.sign>0?'↑ ':'±')+d.text.slice(1)+' kg'),el('div','cap','oproti minulému meraniu'));
 else if(!previous)center.append(pill('neu','prvé meranie'));
 return el('div','',el('div','donut',ring,center));
}
function scale(title,sub,valueText,bands,value){
 const at=bandPosition(bands,value),columns='repeat('+bands.length+',1fr)';
 const bar=el('div','rgbar'),names=el('div','rgn');bar.style.gridTemplateColumns=names.style.gridTemplateColumns=columns;
 if(at){const mark=el('span','mk');mark.style.left=at.percent+'%';bar.append(mark);}
 for(const [i,b] of bands.entries()){const cell=el('div','',b.label);cell.style.background=b.color;bar.append(cell);names.append(el('span',at?.index===i?'on':'',b.name));}
 return el('div','rg',el('div','rgh',el('b','',title),el('span','',sub),el('em','',valueText)),bar,names);
}
function segmentCard(m,key,name){
 const kg=num(m['seg_'+key+'_muscle_kg']),pc=num(m['seg_'+key+'_fat_pct']),max=key==='tr'?30:key==='la'||key==='ra'?4:14;
 const line=(text,value,limit,cls)=>{const fill=el('i',cls);fill.style.width=(Number.isFinite(value)?Math.min(100,value/limit*100):0)+'%';return el('div','sl',el('span','',text),el('div','bar',fill));};
 return el('div','sc',el('b','',name),line(fmt(kg,1)+' kg',kg,max,'m'),line(fmt(pc,1)+' %',pc,50,'f'));
}
export function buildReport({name,measurement:m,previous=null}){
 const w=num(m.weight_kg),f=num(m.fat_pct),mu=num(m.muscle_kg),wa=num(m.water_pct),b=num(m.bone_kg),v=num(m.visceral),age=num(m.age_years),index=bmi(m),p=k=>num(previous?.[k]);
 const root=el('div','lf-report');
 const brand=el('img','logoimg');brand.src=logo;brand.alt='Lady Fitness';
 root.append(el('div','hd',el('div','tx',el('div','kicker','ANALÝZA TELESNEJ KOMPOZÍCIE'),el('div','ttl','BODY COMPOSITION REPORT')),brand,el('div','tag','…krok po kroku bližšie k žene, ktorou chceš byť…')));
 const info=(label,value)=>el('div','',el('small','',label),el('b','',value));
 root.append(el('div','info',info('Klientka',name),info('Dátum merania',skDay(m.measured_on)),info('Výška',fmt(num(m.height_cm),Number.isInteger(num(m.height_cm))?0:1)+' cm'),info('Vek',fmt(age,0)+' rokov')));
 const row=(label,value,mark)=>el('div','crow',el('span','',label),el('b','',value),mark);
 const more=(label,value)=>el('div','mrow',el('span','',label),el('b','',...[].concat(value)));
 const physique=num(m.physique),rating=el('div','mrow tall',el('span','','Physique Rating'),el('b','',Number.isFinite(physique)?physique+'/9':'–'),PHYSIQUE[physique]?el('div','mnote',PHYSIQUE[physique]):null);
 root.append(el('div','main',donut(m,previous),
  el('div','',h3('Zloženie tela'),el('div','comp',row('Telesný tuk',fmt(f,1)+' %',change(f,p('fat_pct'),1,'%',-1)),row('Svalová hmota',fmt(mu,1)+' kg',change(mu,p('muscle_kg'),1,'kg',1)),row('Voda v tele',fmt(wa,1)+' %',change(wa,p('water_pct'),1,'%',1)),row('Kostná hmota',fmt(b,1)+' kg',change(b,p('bone_kg'),1,'kg',0)))),
  el('div','more',h3('Ďalšie hodnoty'),more('BMI',fmt(index,1)),more('Viscerálny tuk',[fmt(v,Number.isInteger(v)?0:1)+' ',Number.isFinite(v)?pill(v<=VISCERAL_MAX?'good':'warn',v<=VISCERAL_MAX?'v norme':'zvýšený'):null].filter(Boolean)),
   more('Bazálny metabolizmus',Number.isFinite(num(m.bmr_kcal))?fmt(num(m.bmr_kcal),0)+' kcal':'–'),more('Metabolický vek',Number.isFinite(num(m.metabolic_age))?fmt(num(m.metabolic_age),0)+' rokov':'–'),rating)));
 const fat=fatBands(age);
 root.append(el('div','ranges',h3('Kde sa nachádzaš'),el('div','rgrid',scale('Telesný tuk','(vek '+fat.group+')',fmt(f,1)+' %',fat.bands,f),scale('BMI','',fmt(index,1),BMI_BANDS,index),
  scale('Viscerálny tuk','',fmt(v,Number.isInteger(v)?0:1),VISCERAL_BANDS,v),scale('Voda v tele','(štandardné pásmo)',fmt(wa,1)+' %',WATER_BANDS,wa))));
 const names=Object.fromEntries(SEGMENTS),column=(...items)=>el('div','segcol',...items);
 const dot=(color,text)=>{const i=el('i','');i.style.background=color;return el('span','',i,text);};
 const figure=el('img','');figure.src=FIGURE;figure.alt='';figure.width=90;figure.height=223;
 const card=k=>segmentCard(m,k,names[k]);
 const compare=el('div','cmp',h3('Porovnanie s predchádzajúcim meraním'));
 if(!previous){const note=el('p','cmp-first','Toto je prvé meranie a slúži ako východiskový bod. Porovnanie uvidíš v reporte z ďalšieho merania.');compare.append(note);}
 else for(const [label,key,decimals,unit,good] of [['Hmotnosť','weight_kg',1,'kg',0],['Telesný tuk','fat_pct',1,'%',-1],['Svalová hmota','muscle_kg',1,'kg',1],['Voda v tele','water_pct',1,'%',1],['Viscerálny tuk','visceral',0,'',-1]])
  compare.append(el('div','cr',el('span','',label),change(num(m[key]),p(key),decimals,unit,good)??pill('neu','chýba údaj')));
 root.append(el('div','seg',el('div','',h3('Segmentálna analýza'),el('div','legend',dot('#b0406f','Svalová hmota (kg)'),dot('#f3b8cc','Tuk (%)')),
  el('div','segw',column(card('la'),card('tr'),card('ll')),el('div','sil',figure),column(card('ra'),el('div',''),card('rl')))),compare));
 const texts=Object.fromEntries(RECOMMENDATIONS),list=[...(m.recommendation_codes??[]).map(c=>texts[c]).filter(Boolean),...(m.custom_recommendation?[m.custom_recommendation]:[])].slice(0,5);
 root.append(el('div','eval',el('div','evl',h3('Vyhodnotenie'),el('div','sum',el('i','','✓'),el('div','',el('b','','Zhrnutie: '),summary(m,previous)))),
  el('div','evr',h3('Odporúčania trénerky'),...list.map(t=>el('div','rec',el('i','','✓'),el('span','',t))))));
 root.append(el('div','disc',DISCLAIMER));
 return root;
}
