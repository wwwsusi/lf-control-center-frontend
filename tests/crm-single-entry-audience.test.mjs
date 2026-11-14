import test from 'node:test';import assert from 'node:assert/strict';
import {entryAudience,entryTitle} from '../web/crm-single-entry.mjs';
const adult={name:'Jednorazový vstup',category:'Dospelí'},student={name:'Jednorazový vstup',category:'Študenti do 18 rokov a seniori nad 60 rokov'};
test('the two single-entry services are told apart by audience',()=>{
 assert.equal(entryTitle(adult),'Jednorazový vstup · Dospelí');
 assert.equal(entryTitle(student),'Jednorazový vstup · Študent / senior');
 assert.notEqual(entryTitle(adult),entryTitle(student));
});
test('an unknown or missing category never breaks or hides the service name',()=>{
 assert.equal(entryTitle({name:'Jednorazový vstup',category:null}),'Jednorazový vstup');
 assert.equal(entryTitle({name:'Jednorazový vstup'}),'Jednorazový vstup');
 assert.equal(entryAudience({category:'Ženy'}),'Ženy');
});
