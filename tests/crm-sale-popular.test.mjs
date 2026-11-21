import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import test from 'node:test';
test('purchase picker offers a working best-selling sort',()=>{
 const src=readFileSync(new URL('../web/crm-sale.mjs',import.meta.url),'utf8');
 assert(!src.includes('zatiaľ nedostupné'));
 assert(src.includes("sort='top'")&&src.includes('units_sold_90d'));
});
