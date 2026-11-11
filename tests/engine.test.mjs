import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyze } from '../lib/engine.mjs';
import { zipFiles } from '../lib/zip.mjs';
const markup = await readFile(new URL('../samples/CustomerRegistration.aspx',import.meta.url),'utf8');
const code = await readFile(new URL('../samples/CustomerRegistration.aspx.cs',import.meta.url),'utf8');
test('sample extracts supported fields, required validations, and list items',()=>{
  const { report } = analyze(markup,code,'CustomerRegistration');
  assert.equal(report.stats.fields,4);
  assert.equal(report.fields.find(f=>f.id==='txtFullName').required,true);
  assert.equal(report.fields.find(f=>f.id==='ddlRegion').options.length,3);
  assert.ok(report.buttons.some(b=>b.event==='btnSubmit_Click'));
  assert.ok(report.handlers.includes('btnSubmit_Click'));
});
test('generates Angular standalone component with reactive validators',()=>{
  const { files } = analyze(markup,code,'CustomerRegistration');
  const ts = files['angular/customer-registration.component.ts'];
  assert.match(ts,/standalone: true/);
  assert.match(ts,/Validators.required/);
  assert.match(ts,/Validators.pattern/);
  assert.match(files['angular/customer-registration.component.html'],/formControlName="txtEmail"/);
  assert.match(files['dotnet/CustomerRegistrationController.cs'],/StatusCode\(501/);
});
test('flags unsupported controls, SQL and authorization',()=>{
  const { report } = analyze('<asp:GridView ID="Grid" runat="server" />','SqlConnection connection; FormsAuthentication.SignOut();','Legacy');
  assert.ok(report.findings.some(f=>f.title==='Unsupported ASP.NET controls'));
  assert.ok(report.findings.some(f=>f.title==='Direct database access'));
  assert.ok(report.findings.some(f=>f.title==='Authorization dependency'));
});
test('escapes untrusted HTML labels in generated template',()=>{
  const { files } = analyze('<asp:Button ID="save" Text="&quot; onclick=alert(1)" runat="server"/>','','Injection');
  assert.ok(files['angular/injection.component.html'].includes('onclick=alert(1)'));
  assert.ok(!files['angular/injection.component.html'].includes('Text="&quot;'));
});
test('ZIP starts with valid local header and contains all artifact files',()=>{
  const { files } = analyze(markup,code,'CustomerRegistration');
  const zip = zipFiles(files);
  assert.equal(zip.readUInt32LE(0),0x04034b50);
  assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length-12),Object.keys(files).length);
});
test('rejects bad archive paths and empty source',()=>{
  assert.throws(()=>zipFiles({'../secrets.txt':'x'}),/Unsafe/);
  assert.throws(()=>analyze(''),/required/);
});