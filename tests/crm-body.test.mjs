import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import test from 'node:test';
import {FIELDS,parseField,readValues,summary,delta,bmi,fatBands,bandPosition,VISCERAL_BANDS} from '../web/crm-body-model.mjs';
const field=k=>FIELDS.find(f=>f[0]===k);
test('input: comma accepted, typing errors and under-age refused, optional empty is null',()=>{
 assert.deepEqual(parseField(field('weight_kg'),' 68,4 '),{value:'68.4'});
 assert.deepEqual(parseField(field('fat_pct'),''),{value:null});
 for(const [k,v] of [['weight_kg','684'],['weight_kg',''],['weight_kg','68,45'],['age_years','17'],['bmr_kcal','1420,5'],['fat_pct','abc'],['height_cm','1,65']])assert.ok(parseField(field(k),v).error,k+' '+v);
 const {values,errors}=readValues({age_years:'35',height_cm:'165',weight_kg:'68,4'});
 assert.equal(errors.length,0);assert.equal(Object.keys(values).length,21);assert.equal(values.seg_tr_fat_pct,null);
});
test('summary distinguishes first measurement, missing values and a real change',()=>{
 const now={fat_pct:'29.5',muscle_kg:'45.2',visceral:'6'};
 assert.match(summary(now,null),/Prvé meranie/);
 assert.match(summary(now,{fat_pct:null,muscle_kg:'44.3'}),/niektoré hodnoty chýbajú/);
 assert.doesNotMatch(summary(now,{fat_pct:null}),/Prvé meranie/);
 assert.match(summary(now,{fat_pct:'31.6',muscle_kg:'44.3'}),/znížiť telesný tuk.*Celková skladba tela sa zlepšuje/);
 assert.match(summary({visceral:'14'},null),/nad odporúčaným rozsahom/);
});
test('differences, BMI and range position',()=>{
 assert.deepEqual(delta(68.4,70.2,1),{sign:-1,text:'−1,8'});assert.deepEqual(delta(2.5,2.5,1),{sign:0,text:'±0,0'});assert.equal(delta(1,NaN,1),null);
 assert.equal(bmi({weight_kg:'68.4',height_cm:'165'}).toFixed(1),'25.1');
 assert.equal(fatBands(35).group,'20–39');assert.equal(fatBands(40).group,'40–59');assert.equal(fatBands(60).group,'60–79');
 assert.equal(bandPosition(VISCERAL_BANDS,12.5).index,0);assert.equal(bandPosition(VISCERAL_BANDS,13).index,1);assert.equal(bandPosition(VISCERAL_BANDS,NaN),null);
});
test('body screens keep nothing in the browser and never parse markup',()=>{
 const src=['crm-body.mjs','crm-body-report.mjs','crm-body-model.mjs'].map(f=>readFileSync(new URL('../web/'+f,import.meta.url),'utf8')).join('\n');
 assert(!/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|indexedDB|fonts\.googleapis|cdnjs/.test(src));
 for(const type of ['RECORD_BODY_CONSENT','WITHDRAW_BODY_CONSENT','RECORD_BODY_MEASUREMENT','VOID_BODY_MEASUREMENT'])assert(src.includes("'"+type+"'"),type);
});
