export function privacySummary(data){
 const names=['inactive_24_months','blocked_by_service_or_payment','needs_manual_privacy_review'];
 const parse=v=>{if(typeof v!=='string'||! /^(0|[1-9]\d{0,17})$/.test(v))throw Error('INVALID_PRIVACY_SUMMARY');return BigInt(v);};
 if(!data||data.actions?.anonymisation_enabled!==false||data.limitations?.legal_holds!=='NOT_CONNECTED'||data.limitations?.history_review!=='NOT_CONNECTED'||data.limitations?.anonymisation!=='NOT_IMPLEMENTED')throw Error('INVALID_PRIVACY_SUMMARY');
 const values=names.map(n=>parse(data.summary?.[n]));
 if(values[0]!==values[1]+values[2])throw Error('INVALID_PRIVACY_SUMMARY');
 return Object.freeze(Object.fromEntries(names.map((n,i)=>[n,values[i].toString()])));
}
