import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import test from 'node:test';
import qrcode from '../web/crm-vendor-qrcode.mjs';import jsQR from '../web/crm-vendor-jsqr.mjs';
test('card QR encodes exactly the card code and can be read back by the scanner library',()=>{
 const text='LF1:58c6f473-dfbc-4360-ad67-c9b97cd16338',qr=qrcode(0,'M');qr.addData(text);qr.make();
 const n=qr.getModuleCount(),scale=6,quiet=4,size=(n+quiet*2)*scale,px=new Uint8ClampedArray(size*size*4).fill(255);
 for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))for(let y=0;y<scale;y++)for(let x=0;x<scale;x++){const i=(((r+quiet)*scale+y)*size+(c+quiet)*scale+x)*4;px[i]=px[i+1]=px[i+2]=0;}
 assert.equal(jsQR(px,size,size)?.data,text);
});
test('card shows no contact details and the scanner releases the camera',()=>{
 const card=readFileSync(new URL('../web/crm-card.mjs',import.meta.url),'utf8'),scan=readFileSync(new URL('../web/crm-scan.mjs',import.meta.url),'utf8');
 assert(!/phone|email|\.tel/i.test(card));assert(!/innerHTML/.test(card+scan));
 assert(scan.includes('getTracks()')&&scan.includes('t.stop()'));
});
