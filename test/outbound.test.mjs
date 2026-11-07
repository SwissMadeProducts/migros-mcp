import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertPublicDestination} from '../dist/public-http.js';
test('blocks non-retailer domains, internal targets, credentials, and unexpected routes',()=>{
  for(const url of ['https://example.com/collect','http://www.migros.ch/store/public/v1/stores/search','https://127.0.0.1/','https://169.254.169.254/latest/meta-data/','https://www.migros.ch.evil.example/store/public/v1/stores/search','https://www.migros.ch/account','https://user:pass@www.migros.ch/store/public/v1/stores/search','https://migusto.migros.ch/api/auth/login','https://www.migros.ch/store/public/v1/stores/search#fragment'])assert.throws(()=>assertPublicDestination(url,'GET'));
  assert.throws(()=>assertPublicDestination('https://www.migros.ch/onesearch-oc-seaapi/public/v5/search','GET'));
  assert.equal(assertPublicDestination('https://www.migros.ch/onesearch-oc-seaapi/public/v5/search','POST').hostname,'www.migros.ch');
  assert.equal(assertPublicDestination('https://migusto.migros.ch/de/rezepte/klassischer-risotto/85788','GET').hostname,'migusto.migros.ch');
});
