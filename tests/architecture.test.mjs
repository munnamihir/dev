import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analyze} from '../lib/engine.mjs';
import {generateArchitecture} from '../lib/architecture.mjs';
const fixture=JSON.parse(await readFile(new URL('../samples/architecture.json',import.meta.url),'utf8'));
const aspx=await readFile(new URL('../samples/CustomerRegistration.aspx',import.meta.url),'utf8');
test('generates module/Common API policy matrix and protected controllers',()=>{
 const {files,summary}=generateArchitecture(fixture);
 assert.equal(summary.modules,2);assert.equal(summary.endpoints,3);
 assert.match(files['dotnet/RegistrationsController.cs'],/Authorize\(Policy=/);
 assert.match(files['dotnet/SecurityRegistration.cs'],/ValidateAudience=true/);
 assert.match(files['angular/api/common.api-client.ts'],/common.lookup.read/);
});
test('binds form and read states to authorized module operations',()=>{
 const {files,report}=analyze(aspx,'','CustomerRegistration',fixture);
 const component=files['angular/customer-registration.component.ts'];
 assert.match(component,/moduleApi\.listRegistrations\(\)/);
 assert.match(component,/moduleApi\.submitRegistration\(this.form.getRawValue\(\)\)/);
 assert.equal(files['dotnet/CustomerRegistrationController.cs'],undefined);
 assert.equal(report.apiArchitecture.commonApis,1);
});
test('rejects missing permissions and untrusted absolute endpoints',()=>{
 const a=structuredClone(fixture);delete a.modules[0].endpoints[0].permission;
 assert.throws(()=>generateArchitecture(a),/explicit permission/);
 const b=structuredClone(fixture);b.modules[0].basePath='https://host.example';
 assert.throws(()=>generateArchitecture(b),/relative/);
});