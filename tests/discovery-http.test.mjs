import test from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../server.mjs';

test('discovery UI, sample, analysis and path validation over HTTP',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 try{
  const page=await fetch(origin+'/discovery');
  assert.equal(page.status,200);
  assert.match(await page.text(),/Select source folder/);
  const js=await fetch(origin+'/discovery.js');
  assert.equal(js.status,200);
  const sampleResponse=await fetch(origin+'/api/discovery/sample');
  assert.equal(sampleResponse.status,200);
  const sample=await sampleResponse.json();
  assert.equal(sample.files.length,7);
  const reportResponse=await fetch(origin+'/api/discovery/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sample)});
  assert.equal(reportResponse.status,200);
  const report=await reportResponse.json();
  assert.equal(report.summary.matched,2);
  assert.equal(report.summary.modules,2);
  const bad=await fetch(origin+'/api/discovery/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({files:[{path:'../bad.cs',content:'x'}]})});
  assert.equal(bad.status,400);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
