import {createHash} from 'node:crypto';
export const CORE=Object.freeze(['CREATE_CUSTOMER','CHECK_IN','CREATE_SALE','CONFIRM_SALE','CREATE_PAYMENT','CONFIRM_PAYMENT']);
export const OWNER_OPERATIONS=Object.freeze(['OPEN_DAY','CANCEL_SALE']);
export const BLOCKED=Object.freeze(['CANCEL_VISIT','CANCEL_ENTITLEMENT','REFUND_PAYMENT','CONFIRM_DAY']);
export class SafeError extends Error {constructor(code){super(code);this.safeCode=code;}}
export const fail=code=>{throw new SafeError(code);};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const isUuid=v=>typeof v==='string'&&uuid.test(v);
const fingerprint=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const rev=v=>typeof v==='string'&&/^[1-9][0-9]{0,17}$/.test(v);
const text=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n&&!/[\u0000-\u001f]/.test(v);
export const money=v=>typeof v==='string'&&/^(0|[1-9][0-9]{0,11})\.[0-9]{2}$/.test(v);
const integer=v=>typeof v==='string'&&/^[1-9][0-9]{0,8}$/.test(v);
export function object(v,keys,required=keys){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k))||required.some(k=>!Object.hasOwn(v,k)))fail('VALIDATION_ERROR');}
function fields(p,spec,optional=[]){object(p,Object.keys(spec),Object.keys(spec).filter(k=>!optional.includes(k)));for(const [k,fn] of Object.entries(spec)){if(Object.hasOwn(p,k)&&!fn(p[k]))fail('VALIDATION_ERROR');}}
const nullableId=v=>v===null||isUuid(v),nullableRev=v=>v===null||rev(v);
// Fixed catalogue union: exactly one UUID; callers never choose SQL identifiers.
export const catalogueKey=v=>v.product_id!==undefined&&v.product_id!==null?'product:'+v.product_id:'service:'+v.service_id;
function catalogueReference(v,quantity=false){
 fields(v,{service_id:isUuid,product_id:isUuid,...(quantity?{quantity:integer}:{}),catalogue_fingerprint:fingerprint},['service_id','product_id']);
 if(Object.hasOwn(v,'service_id')===Object.hasOwn(v,'product_id'))fail('VALIDATION_ERROR');
}
export function validate(body){
 object(body,['request_id','operation_type','payload']);if(!isUuid(body.request_id)||typeof body.operation_type!=='string')fail('VALIDATION_ERROR');
 const p=body.payload;
 if(BLOCKED.includes(body.operation_type)){object(p,[]);return body;}
 switch(body.operation_type){
 case 'OPEN_DAY':fields(p,{business_date:v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v,expected_revision:nullableRev});break;
 case 'CANCEL_SALE':fields(p,{sale_id:isUuid,business_date:v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v,expected_revision:rev,line_fingerprint:fingerprint,reason_code:v=>['ENTRY_ERROR','CATALOGUE_CHANGED'].includes(v)});break;
 case 'CREATE_CUSTOMER':fields(p,{name:v=>text(v,200),phone:v=>v===null||text(v,50),email:v=>v===null||text(v,320)},['phone','email']);break;
 case 'CHECK_IN':fields(p,{customer_id:nullableId,customer_revision:nullableRev,admission_id:isUuid,admission_revision:rev,entitlement_id:nullableId,entitlement_revision:nullableRev,sale_item_id:nullableId,sale_revision:nullableRev});if((p.customer_id===null)!==(p.customer_revision===null)||(p.entitlement_id===null)!==(p.entitlement_revision===null)||(p.sale_item_id===null)!==(p.sale_revision===null))fail('VALIDATION_ERROR');break;
 case 'CREATE_SALE':fields(p,{customer_id:nullableId,customer_revision:nullableRev,lines:v=>Array.isArray(v)&&v.length>0&&v.length<=25});if((p.customer_id===null)!==(p.customer_revision===null))fail('VALIDATION_ERROR');for(const line of p.lines)catalogueReference(line,true);if(new Set(p.lines.map(catalogueKey)).size!==p.lines.length)fail('VALIDATION_ERROR');break;
 case 'CONFIRM_SALE':fields(p,{sale_id:isUuid,expected_revision:rev,customer_revision:nullableRev,line_fingerprint:fingerprint,catalogue:v=>Array.isArray(v)&&v.length>0&&v.length<=25});for(const cat of p.catalogue)catalogueReference(cat);if(new Set(p.catalogue.map(catalogueKey)).size!==p.catalogue.length)fail('VALIDATION_ERROR');break;
 case 'CREATE_PAYMENT':fields(p,{sale_id:isUuid,sale_revision:rev,method:v=>['CASH','CARD','BANK_TRANSFER'].includes(v),amount:money});if(p.amount==='0.00')fail('VALIDATION_ERROR');break;
 case 'CONFIRM_PAYMENT':fields(p,{payment_id:isUuid,expected_revision:rev,sale_revision:rev});break;
 default:fail('FORBIDDEN');
 }
 return body;
}
export function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return typeof v==='string'?v.normalize('NFC'):v;}
export const digest=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(canonical(v))).digest('hex');
export const requestHash=(body,actor)=>digest({version:'lf-crm-1',actor,operation_type:body.operation_type,payload:body.payload});
export function safeCode(e){if(e instanceof SafeError)return e.safeCode;
 const message=e?.message||'';
 if(message==='REVISION_CONFLICT')return 'REVISION_CONFLICT';
 if(message==='REQUEST_CONFLICT')return 'REQUEST_CONFLICT';
 if(message==='ENTITLEMENT_EXHAUSTED')return 'ENTITLEMENT_EXHAUSTED';
 if(['55P03','40P01','40001'].includes(e?.code))return 'RETRYABLE_CONCURRENCY';
 if(message.endsWith('_BLOCKED')||['DAY_NOT_OPEN','PRICE_MISSING','CATALOG_ELIGIBILITY_BLOCKED','ADMISSION_MISMATCH'].includes(message))return 'POLICY_BLOCKED';
 if(['CATALOG_CHANGED','UNIT_MISSING_OR_CHANGED'].includes(message))return 'REVISION_CONFLICT';
 if(['23503','23505','23514','P0001','P0002'].includes(e?.code))return 'BUSINESS_REJECTED';
 return 'INTERNAL_ERROR';
}
export const statusFor=code=>({AUTH_REQUIRED:401,FORBIDDEN:403,VALIDATION_ERROR:400,REQUEST_CONFLICT:409,REVISION_CONFLICT:409,ENTITLEMENT_EXHAUSTED:422,POLICY_BLOCKED:422,BUSINESS_REJECTED:422,RETRYABLE_CONCURRENCY:503,READBACK_UNAVAILABLE:503,AUTH_PROVIDER_UNAVAILABLE:503,INTERNAL_ERROR:500})[code]||500;
