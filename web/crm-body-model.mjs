// Pure rules of the body composition measurement: form fields, input checks and the texts and ranges of the client report.
// The limits only reject typing errors and mirror the server; the report ranges come from the Tanita BC-545N fact sheet (BMI: WHO).
export const SEGMENTS=[['la','Ľavá ruka'],['ra','Pravá ruka'],['tr','Trup'],['ll','Ľavá noha'],['rl','Pravá noha']];
// [key, label, min, max, decimals, required]
export const MAIN_FIELDS=[
 ['age_years','Vek (roky)',18,100,0,true],['height_cm','Výška (cm)',100,220,1,true],['weight_kg','Hmotnosť (kg)',30,250,1,true],
 ['fat_pct','Telesný tuk (%)',3,75,1,false],['muscle_kg','Svalová hmota (kg)',10,120,1,false],['water_pct','Voda v tele (%)',20,80,1,false],
 ['bone_kg','Kostná hmota (kg)',0.5,10,1,false],['visceral','Viscerálny tuk',1,59,1,false],['bmr_kcal','Bazálny metabolizmus (kcal)',500,5000,0,false],
 ['metabolic_age','Metabolický vek',12,90,0,false],['physique','Physique Rating (1–9)',1,9,0,false]];
export const SEGMENT_FIELDS=SEGMENTS.flatMap(([s,name])=>[['seg_'+s+'_muscle_kg',name+': svaly (kg)',0.1,60,1,false],['seg_'+s+'_fat_pct',name+': tuk (%)',1,75,1,false]]);
export const FIELDS=[...MAIN_FIELDS,...SEGMENT_FIELDS];
export const RECOMMENDATIONS=[
 ['r1','Pokračovať v silovom tréningu 3× týždenne.'],['r2','Zamerať sa na spevnenie stredu tela.'],['r3','Udržať dostatočný príjem bielkovín.'],
 ['r4','Sledovať progres a zopakovať meranie o 4 týždne.'],['r5','Zaradiť pravidelnú chôdzu alebo kardio.'],['r6','Dbať na pitný režim počas dňa.'],
 ['r7','Pridať cviky na spodnú časť tela.'],['r8','Dbať na dostatok spánku a regeneráciu.']];
export const DEFAULT_RECOMMENDATIONS=['r1','r3','r4'];
export const MAX_RECOMMENDATIONS=5;
export const num=v=>v===null||v===undefined||v===''?NaN:Number(v);
export const fmt=(n,d)=>Number.isFinite(n)?n.toFixed(d).replace('.',','):'–';
export function parseField([,label,min,max,decimals,required],input){
 const text=String(input??'').trim().replace(',','.');
 if(text==='')return required?{error:label+': údaj je povinný.'}:{value:null};
 if(!(decimals?/^\d{1,4}(\.\d)?$/:/^\d{1,4}$/).test(text))return {error:label+': zadaj '+(decimals?'číslo s najviac jedným desatinným miestom.':'celé číslo.')};
 const n=Number(text);
 if(n<min||n>max)return {error:label+': povolené je '+String(min).replace('.',',')+' až '+max+'. Skontroluj preklep.'};
 return {value:String(n)};
}
// Returns {values,errors}; errors is a list of {key,message}.
export function readValues(inputs){
 const values={},errors=[];
 for(const field of FIELDS){const r=parseField(field,inputs[field[0]]);if(r.error)errors.push({key:field[0],message:r.error});else values[field[0]]=r.value;}
 return {values,errors};
}
export const bmi=m=>{const w=num(m.weight_kg),h=num(m.height_cm);return w>0&&h>0?w/(h/100)**2:NaN;};
export function delta(current,previous,decimals){
 if(!Number.isFinite(current)||!Number.isFinite(previous))return null;
 const x=current-previous,zero=Math.abs(x)<10**-decimals/2;
 return {sign:zero?0:Math.sign(x),text:(zero?'±':x>0?'+':'−')+fmt(zero?0:Math.abs(x),decimals)};
}
export const VISCERAL_MAX=12;
// previous===null means there is no earlier valid measurement of this client in the CRM.
export function summary(current,previous){
 const text=[],f=num(current.fat_pct),m=num(current.muscle_kg),pf=num(previous?.fat_pct),pm=num(previous?.muscle_kg),v=num(current.visceral);
 const comparable=[f,m,pf,pm].every(Number.isFinite),df=f-pf,dm=m-pm,eps=0.05;
 if(!previous)text.push('Prvé meranie slúži ako východiskový bod. Pri ďalšom meraní uvidíš svoj progres.');
 else if(!comparable)text.push('Zmenu telesného tuku a svalovej hmoty nie je možné vyhodnotiť, niektoré hodnoty chýbajú.');
 else if(df<-eps&&dm>eps)text.push('Podarilo sa znížiť telesný tuk a zároveň zvýšiť svalovú hmotu.');
 else if(df<-eps)text.push('Telesný tuk klesol. Pri ďalšom meraní sledujeme, či sa udrží svalová hmota.');
 else if(dm>eps)text.push('Svalová hmota rastie. Telesný tuk sa zatiaľ nezmenšil.');
 else if(df>eps&&dm<-eps)text.push('Telesný tuk mierne stúpol a svalová hmota klesla. Pomôže pravidelný tréning a dodržiavanie plánu.');
 else text.push('Skladba tela sa oproti minulému meraniu výrazne nezmenila.');
 if(Number.isFinite(v))text.push(v<=VISCERAL_MAX?'Viscerálny tuk je v norme.':'Viscerálny tuk je nad odporúčaným rozsahom.');
 if(comparable&&df<-eps&&dm>eps)text.push('Celková skladba tela sa zlepšuje.');
 return text.join(' ');
}
const LOW='#dbe7f3',OK='#d6edc3',HIGH='#f9d8de',VERY='#f5b5c6';
const band=(lo,hi,color,label,name)=>({lo,hi,color,label,name});
export function fatBands(age){
 const [t,group]=age>=60?[[24,36,42],'60–79']:age>=40?[[23,34,40],'40–59']:[[21,33,39],'20–39'];
 return {group,bands:[band(10,t[0],LOW,'< '+t[0]+' %','nízky'),band(t[0],t[1],OK,t[0]+' – '+t[1]+' %','zdravý'),band(t[1],t[2],HIGH,t[1]+' – '+t[2]+' %','zvýšený'),band(t[2],t[2]+10,VERY,'> '+t[2]+' %','vysoký')]};
}
export const BMI_BANDS=[band(14,18.5,LOW,'< 18,5','podváha'),band(18.5,25,OK,'18,5 – 25','norma'),band(25,30,HIGH,'25 – 30','zvýšené'),band(30,38,VERY,'> 30','vysoké')];
export const VISCERAL_BANDS=[band(1,13,OK,'1 – 12','v norme'),band(13,25,HIGH,'13 a viac','zvýšený')];
export const WATER_BANDS=[band(35,45,LOW,'< 45 %','nižšia'),band(45,60,OK,'45 – 60 %','v norme'),band(60,70,HIGH,'> 60 %','vyššia')];
// Which band a value falls into and where the marker sits (0–100 % of the whole scale).
export function bandPosition(bands,value){
 if(!Number.isFinite(value))return null;
 let index=bands.findIndex(b=>value<b.hi);if(index<0)index=bands.length-1;
 const b=bands[index],part=Math.max(0,Math.min(1,(value-b.lo)/(b.hi-b.lo)));
 return {index,percent:(index+part)/bands.length*100};
}
export const PHYSIQUE={1:'Skrytý nadbytok tuku',2:'Stredný rám, nadbytok tuku',3:'Robustná postava',4:'Nízka svalová hmota',5:'Štandardná postava',6:'Svalnatá postava',7:'Nízky tuk, nízka svalová hmota',8:'Štíhla a svalnatá (atlétka)',9:'Veľmi svalnatá (atlétka)'};
