export const IDLE_LIMIT_MS=15*60*1000;
export function idleRemaining(lastActivityAt,now=Date.now()){
 if(!Number.isFinite(lastActivityAt)||lastActivityAt<=0||!Number.isFinite(now))return 0;
 return Math.max(0,IDLE_LIMIT_MS-(now-lastActivityAt));
}
export function isTrustedUserActivity(event){return event?.isTrusted===true;}
