import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { discoverApplication } from '../lib/discovery.mjs';
const fixture=JSON.parse(await readFile(new URL('../samples/discovery.json',import.meta.url),'utf8'));
test('discovers module/Common API, screen, controller and matched routes',()=>{
 const r=discoverApplication(fixture);
 assert.equal(r.summary.files,7); assert.equal(r.summary.matched,2);
 assert.equal(r.summary.screens,1);assert.equal(r.summary.controllers,2);
 assert.equal(r.modules.find(x=>x.key==='common').kind,'common');
 assert.ok(r.files.find(x=>x.path.includes('TripsController')).authEvidence.length>0);
 assert.equal(r.files.find(x=>x.path.includes('LookupRepository')).dboReferences[0].object,'Region');
});
test('labels unmatched routes unresolved',()=>{
 const r=discoverApplication({files:[{path:'src/app/modules/coop/trips.service.ts',content:"http.get('/api/coop/missing')"}]});
 assert.equal(r.edges[0].status,'unresolved');
 assert.ok(r.findings.some(x=>x.code==='UNRESOLVED_API'));
});
test('rejects hidden, absolute, secret, traversal paths, size and duplication',()=>{
 for(const path of ['../outside.cs','/tmp/out.cs','C:\\temp\\out.cs','private-key.ts','src/.env.cs','node_modules/a.ts'])
  assert.throws(()=>discoverApplication({files:[{path,content:'sample'}]}),{status:400});
 const f={path:'src/app/modules/coop/file.ts',content:'x'};
 assert.throws(()=>discoverApplication({files:[f,f]}),/Duplicate/);
 assert.throws(()=>discoverApplication({files:[{...f,content:'x'.repeat(150001)}]}),/150 KB/);
 assert.throws(()=>discoverApplication({files:Array(201).fill(f)}),/1–200/);
});
test('never resolves dynamic interpolated URLs as certain routes',()=>{
 const dynamic='http.get(' + String.fromCharCode(96) + '/api/coop/$' + '{id}' + String.fromCharCode(96) + ')';
 const r=discoverApplication({files:[{path:'src/app/modules/coop/file.ts',content:dynamic}]});
 assert.equal(r.summary.matched,0);
});
test('warns on anonymous or unverified local authorization',()=>{
 const r=discoverApplication({files:[
  {path:'COOP.API/Controllers/OpenController.cs',content:'[ApiController][AllowAnonymous][Route("api/coop")] class OpenController : ControllerBase { [HttpGet("open")] }'},
  {path:'Common.API/Controllers/ItemsController.cs',content:'[ApiController][Route("api/common")] class ItemsController : ControllerBase { [HttpGet("items")] }'}
 ]});
 assert.ok(r.findings.some(x=>x.code==='ANONYMOUS_ENDPOINT'));
 assert.ok(r.findings.some(x=>x.code==='POLICY_UNVERIFIED'));
});
