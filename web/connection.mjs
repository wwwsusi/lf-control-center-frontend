// One canonical client, with a locked same-origin profile for the private activation shell.
export function connectionProfile(config){
 if(config.connectionMode==='same-origin'){
  if(config.eventServiceUrl)throw Error('Same-origin profil nesmie mať vzdialenú adresu služby.');
  return Object.freeze({sameOrigin:true});
 }
 if(config.connectionMode&&config.connectionMode!=='remote')throw Error('Neznámy profil napojenia.');
 return Object.freeze({sameOrigin:false});
}
export function resolveEndpoint(value,profile){
 if(profile.sameOrigin)return '';
 const u=new URL(value),loop=['127.0.0.1','localhost','[::1]'].includes(u.hostname);
 if(u.username||u.password||u.search||u.hash||(!loop&&u.protocol!=='https:')||!['http:','https:'].includes(u.protocol))throw Error('Služba potrebuje HTTPS; HTTP je povolené iba na localhost.');
 return u.origin;
}
export function viewerOptions(profile,token){return {credentials:profile.sameOrigin||!token?'include':'omit',headers:!profile.sameOrigin&&token?{Authorization:'Bearer '+token}:{}};}

// Display only known application errors; never expose arbitrary provider text.
export async function loginFailureMessage(response){
 if(response.status===409){
  try{if((await response.json()).code==='SESSION_LIMIT_REACHED')return 'Súčasne môže byť prihlásených najviac 5 zariadení alebo prehliadačov. Odhlás sa na inom zariadení alebo počkaj, kým jeho prihlásenie vyprší.';}catch{}
 }
 return 'Prihlásenie zlyhalo: HTTP '+response.status;
}
