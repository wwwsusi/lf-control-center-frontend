import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../web/crm-catalogue.mjs',import.meta.url),'utf8');
test('best-seller ordering is enabled and uses units_sold_90d with an empty-state note',()=>{
 assert(src.includes("['popular','Najpredávanejšie · 90 dní',false]"));
 assert(src.includes('units_sold_90d'));
 assert(src.includes("sortMode==='popular'"));
 assert(src.includes('zatiaľ nie sú žiadne potvrdené predaje'));
 assert(!src.includes('zatiaľ nedostupné'));
});
