import { generateArchitecture } from './architecture.mjs';
/** Bounded, deterministic Web Forms analyzer. Not a semantic migration engine. */
const attr = (text) => {
  const out = {};
  const re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(text))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? '';
  return out;
};
const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const safeName = (s, fallback = 'field') => {
  const v = String(s || '').replace(/[^A-Za-z0-9_]/g, '_');
  return /^[A-Za-z_]/.test(v) ? v : `${fallback}_${v}`;
};
const pascal = (s) => safeName(s).split(/[_\-\s]+/).filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1)).join('');
const kebab = (s) => String(s || 'LegacyScreen').replace(/([a-z\d])([A-Z])/g, '$1-$2').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
const labelFor = (s) => String(s || '').replace(/^(txt|ddl|chk|btn|lbl|cbo|tb)(?=[A-Z])/, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim() || 'Field';

const supported = new Set(['textbox','dropdownlist','checkbox','button','label','requiredfieldvalidator','regularexpressionvalidator']);
const inputTypes = new Set(['textbox','dropdownlist','checkbox']);

export function analyze(aspx, codeBehind = '', name = 'LegacyScreen', architecture = null) {
  if (typeof aspx !== 'string' || !aspx.trim()) throw new Error('ASPX markup is required.');
  if (typeof codeBehind !== 'string') throw new Error('Code-behind must be text.');
  const tags = [];
  const tagRegex = /<asp:([A-Za-z][\w]*)\b([^>]*?)(\/?)>/gi;
  let match;
  while ((match = tagRegex.exec(aspx))) {
    const type = match[1].toLowerCase();
    if (type === 'listitem') continue;
    const attrs = attr(match[2]);
    const id = attrs.id || `anonymous_${tags.length + 1}`;
    const tag = { type, id, attributes: attrs, line: 1 + aspx.slice(0, match.index).split('\n').length - 1 };
    if (type === 'dropdownlist') {
      const close = new RegExp(`</asp:DropDownList\\s*>`, 'ig');
      close.lastIndex = tagRegex.lastIndex;
      const end = close.exec(aspx);
      const body = end ? aspx.slice(tagRegex.lastIndex, end.index) : '';
      const items = [...body.matchAll(/<asp:ListItem\b([^>]*?)\/?\s*>/gi)];
      tag.options = items.map(x => { const a = attr(x[1]); return { label: a.text || a.value || 'Option', value: a.value ?? a.text ?? '' }; });
    }
    tags.push(tag);
  }
  const validators = tags.filter(t => /validator$/.test(t.type));
  const fields = tags.filter(t => inputTypes.has(t.type)).map(t => {
    const linked = validators.filter(v => (v.attributes.controltovalidate || '').toLowerCase() === t.id.toLowerCase());
    const mode = (t.attributes.textmode || '').toLowerCase();
    return {
      id: safeName(t.id), originalId: t.id, label: labelFor(t.id), type: t.type,
      htmlType: mode === 'email' ? 'email' : mode === 'password' ? 'password' : mode === 'number' ? 'number' : 'text',
      multiline: mode === 'multiline', required: linked.some(v => v.type === 'requiredfieldvalidator'),
      pattern: linked.find(v => v.type === 'regularexpressionvalidator')?.attributes.validationexpression || '',
      options: t.options || [], line: t.line
    };
  });
  const buttons = tags.filter(t => t.type === 'button').map(t => ({ id: t.id, text: t.attributes.text || labelFor(t.id), event: t.attributes.onclick || null }));
  const handlers = [...codeBehind.matchAll(/(?:protected|private|public)\s+(?:async\s+)?(?:void|Task(?:<[^>]+>)?)\s+(\w+)\s*\(/g)].map(m => m[1]);
  const findings = [];
  const issue = (severity, title, detail) => findings.push({ severity, title, detail });
  const unknown = tags.filter(t => !supported.has(t.type) && !['panel','placeholder','literal'].includes(t.type));
  if (unknown.length) issue('high', 'Unsupported ASP.NET controls', `${[...new Set(unknown.map(t => t.type))].join(', ')} require a manual migration plan.`);
  if (/<(?:telerik:|rad:)|\bRadGrid\b|\bRadComboBox\b/i.test(aspx + codeBehind)) issue('high', 'Third-party component dependency', 'Telerik/RadControls require equivalent components and behavior tests.');
  if (/\b(?:SqlConnection|SqlCommand|ExecuteNonQuery|SELECT\s+.+FROM|INSERT\s+INTO)\b/i.test(codeBehind)) issue('high', 'Direct database access', 'Extract data access into validated, parameterized APIs and verify behavior.');
  if (/\b(?:Session\[|ViewState\[|Response\.Redirect|Server\.Transfer|IsPostBack)\b/.test(codeBehind)) issue('medium', 'Web Forms lifecycle dependency', 'Review navigation, persisted state and lifecycle logic before replacing it.');
  if (/\b(?:FormsAuthentication|HttpContext\.Current|User\.IsInRole)\b/.test(codeBehind)) issue('high', 'Authorization dependency', 'Preserve identity, role checks and server-side authorization rules.');
  const missingEvents = buttons.filter(b => b.event && !handlers.includes(b.event));
  if (missingEvents.length) issue('medium', 'Event handlers not found', `${missingEvents.map(b => b.event).join(', ')} were not located in the supplied code-behind.`);
  if (buttons.some(b => b.event)) issue('high', 'Server events need business logic', 'Button handlers are identified but their effects are NOT translated; the API intentionally returns 501.');
  if (validators.some(v => !['requiredfieldvalidator','regularexpressionvalidator'].includes(v.type))) issue('medium', 'Validator review needed', 'Some ASP.NET validators do not map automatically to Angular validators.');
  const ids = fields.map(f => f.id.toLowerCase());
  if (new Set(ids).size !== ids.length) issue('high', 'Duplicate form control IDs', 'Fields must be renamed to avoid Angular form collisions.');
  if (!fields.length) issue('medium', 'No supported inputs detected', 'This screen may need custom conversion or may not be a form.');
  issue('medium', 'Behavior parity unverified', 'Generation does not prove equivalent business logic, security, styling or accessibility.');
  const screenName = pascal(name.replace(/\.aspx$/i, '')) || 'LegacyScreen';
  const architectureResult = architecture ? generateArchitecture(architecture, aspx, codeBehind) : null;
  if (architectureResult) issue('high','API authorization mapping requires review','Declared module and Common API permissions are a proposed contract, not verified evidence of legacy behavior.');
  const report = {
    version: '0.2.0', title: name, screenName,
    apiArchitecture: architectureResult?.summary || null,
    stats: { totalControls: tags.length, supportedControls: tags.length - unknown.length, fields: fields.length, validators: validators.length, eventHandlers: handlers.length, lines: aspx.split('\n').length + codeBehind.split('\n').length },
    fields, buttons, handlers, findings,
    controlInventory: tags.map(({ type, id, line }) => ({ type, id, line, supported: supported.has(type) })),
    checklist: ['Compare original and generated screen using the same test data', 'Port and test all server-side business rules', 'Implement authentication and authorization', 'Inspect database access and transactions', 'Verify accessibility using keyboard and screen reader', 'Run end-to-end and regression tests', 'Have a developer sign off before production']
  };
  const files = {...generate(report), ...(architectureResult?.files || {})};
  if (architectureResult) {
    const slug = kebab(screenName), path = 'angular/' + slug + '.component.ts';
    let component = files[path];
    const binding = architectureResult.summary.screenBinding;
    if (binding) {
      const className = binding.module[0].toUpperCase() + binding.module.slice(1) + 'ApiClient';
      component = component.replace("import { HttpClient } from '@angular/common/http';\n", "import { "+className+" } from './api/"+kebab(binding.module)+".api-client';\n")
        .replace('private readonly http = inject(HttpClient);','private readonly moduleApi = inject('+className+');');
      if (binding.submitEndpoint) component=component.replace("this.http.post('/api/migration/"+slug+"', this.form.getRawValue()).subscribe({", "this.moduleApi."+binding.submitEndpoint+"(this.form.getRawValue()).subscribe({");
      if (binding.loadEndpoint) {
        component=component.replace('import { Component, inject }','import { Component, inject, OnInit }')
          .replace('export class '+screenName+'Component {','export class '+screenName+'Component implements OnInit {')
          .replace('  submitted = false;', "  records: unknown[] = [];\n  loading = false;\n  loadError = '';\n  submitted = false;")
          .replace('  submit(): void {', "  ngOnInit(): void {\n    this.loading = true;\n    this.moduleApi."+binding.loadEndpoint+"().subscribe({\n      next: response => {this.records = Array.isArray(response) ? response : []; this.loading = false;},\n      error: err => {this.loading = false; this.loadError = err.status===401 ? 'Sign in required' : err.status===403 ? 'Access denied' : 'Unable to load records';}\n    });\n  }\n  submit(): void {");
        files['angular/'+slug+'.component.html']=files['angular/'+slug+'.component.html'].replace('<form [formGroup]', '<p *ngIf="loading" role="status">Loading records…</p>\n<p *ngIf="loadError" role="alert">{{ loadError }}</p>\n<p *ngIf="!loading && !loadError && !records.length">No records found.</p>\n<ul *ngIf="!loading && records.length"><li *ngFor="let record of records">{{ record | json }}</li></ul>\n<form [formGroup]');
      }
    } else {
      component=component.replace("import { HttpClient } from '@angular/common/http';\n", '').replace('private readonly http = inject(HttpClient);','');
    }
    if (!binding?.submitEndpoint) {
      component=component.replace(/this\.http\.post\('\/api\/migration\/[^']+', this\.form\.getRawValue\(\)\)\.subscribe\(\{[\s\S]*?\n    \}\);/,"this.busy=false;\n    this.error='Bind an authorized write endpoint to enable submission.';");
    }
    files[path]=component;
    delete files['dotnet/'+screenName+'Controller.cs'];
    files['REVIEW.md'] += '\n- Review API_POLICY_MATRIX.json and ARCHITECTURE_REVIEW.md. No unsecured generic migration controller is emitted.\n';
  }
  return {report,files};
}

function generate(report) {
  const { screenName, fields, buttons } = report;
  const fileName = kebab(screenName);
  const className = `${screenName}Component`;
  const declarations = fields.map(f => `    ${JSON.stringify(f.id)}: new FormControl(${f.type === 'checkbox' ? 'false' : "''"}, { nonNullable: true, validators: [${[f.required ? 'Validators.required' : '', f.pattern ? `Validators.pattern(${JSON.stringify(f.pattern)})` : ''].filter(Boolean).join(', ')}] }),`).join('\n');
  const template = fields.map(f => {
    const id = escHtml(f.id), lab = escHtml(f.label);
    const error = f.required ? `<small class="error" *ngIf="submitted && form.controls['${id}'].hasError('required')">Required field</small>` : '';
    const patternError = f.pattern ? `<small class="error" *ngIf="submitted && form.controls['${id}'].hasError('pattern')">Invalid format</small>` : '';
    if (f.type === 'checkbox') return `  <label class="check"><input type="checkbox" formControlName="${id}" /> ${lab}</label>`;
    const control = f.type === 'dropdownlist' ? `<select id="${id}" formControlName="${id}">${f.options.map(o => `<option value="${escHtml(o.value)}">${escHtml(o.label)}</option>`).join('')}</select>` : f.multiline ? `<textarea id="${id}" formControlName="${id}" rows="4"></textarea>` : `<input id="${id}" type="${f.htmlType}" formControlName="${id}" />`;
    return `  <div class="field"><label for="${id}">${lab}${f.required ? ' *' : ''}</label>${control}${error}${patternError}</div>`;
  }).join('\n');
  const angularTs = `// Generated by ScreenShift: REVIEW business rules before deploying.\nimport { Component, inject } from '@angular/core';\nimport { CommonModule } from '@angular/common';\nimport { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';\nimport { HttpClient } from '@angular/common/http';\n\n@Component({\n  selector: 'app-${fileName}',\n  standalone: true,\n  imports: [CommonModule, ReactiveFormsModule],\n  templateUrl: './${fileName}.component.html',\n  styleUrl: './${fileName}.component.css'\n})\nexport class ${className} {\n  private readonly http = inject(HttpClient);\n  submitted = false;\n  busy = false;\n  error = '';\n  readonly form = new FormGroup({\n${declarations}\n  });\n\n  submit(): void {\n    this.submitted = true;\n    if (this.form.invalid || this.busy) return;\n    this.busy = true;\n    this.error = '';\n    // API implementation is a TODO. The generated .NET endpoint returns 501.\n    this.http.post('/api/migration/${fileName}', this.form.getRawValue()).subscribe({\n      next: () => { this.busy = false; },\n      error: () => { this.busy = false; this.error = 'Submission is not implemented yet.'; }\n    });\n  }\n}\n`;
  const angularHtml = `<!-- Generated by ScreenShift. Review labels, parity, layout and keyboard flow. -->\n<section class="legacy-migration"><h1>${escHtml(screenName.replace(/([a-z])([A-Z])/g, '$1 $2'))}</h1>\n<form [formGroup]="form" (ngSubmit)="submit()" novalidate>\n${template}\n  <p class="error" role="alert" *ngIf="error">{{ error }}</p>\n  <button type="submit" [disabled]="busy">${escHtml(buttons[0]?.text || 'Submit')}</button>\n</form></section>\n`;
  const angularCss = `.legacy-migration { max-width: 42rem; margin: 2rem auto; font-family: system-ui, sans-serif; }\n.field { display: grid; gap: .4rem; margin: 1rem 0; }\ninput:not([type=checkbox]), select, textarea { border: 1px solid #9ca3af; padding: .7rem; border-radius: .4rem; font: inherit; }\ninput:focus-visible, select:focus-visible, textarea:focus-visible, button:focus-visible { outline: 3px solid #2563eb; outline-offset: 2px; }\n.check { display: flex; gap: .5rem; align-items: center; margin: 1rem 0; }\n.error { color: #b91c1c; }\nbutton { padding: .75rem 1.3rem; border: 0; border-radius: .4rem; background: #123cda; color: white; cursor: pointer; }\nbutton:disabled { opacity: .6; }\n`;
  const props = fields.map(f => `    ${f.required ? '[Required]\n    ' : ''}public ${f.type === 'checkbox' ? 'bool' : 'string?'} ${pascal(f.id)} { get; set; }`).join('\n');
  const dtoName = `${screenName}Request`;
  const controller = `// Generated contract scaffold: deliberately does NOT implement legacy business rules.\nusing Microsoft.AspNetCore.Mvc;\nusing System.ComponentModel.DataAnnotations;\n\nnamespace ScreenShift.Generated;\n\npublic sealed class ${dtoName}\n{\n${props}\n}\n\n[ApiController]\n[Route("api/migration/${fileName}")]\npublic sealed class ${screenName}Controller : ControllerBase\n{\n    [HttpPost]\n    public IActionResult Submit([FromBody] ${dtoName} request)\n    {\n        // TODO: Port authorizations, validations, transactions, effects and tests.\n        return StatusCode(501, new { error = "Business logic migration required" });\n    }\n}\n`;
  const readme = `# ${screenName}: generated migration scaffold\n\n**Not production ready.** This is a control mapping and API contract, not a semantic translation.\n\n- Source Web Forms controls: ${report.stats.totalControls}\n- Input fields: ${report.stats.fields}\n- Findings requiring review: ${report.findings.length}\n- Generated API returns HTTP 501 until backend logic is implemented.\n- Configure Angular provideHttpClient() in the host application.\n- Add components to an Angular workspace; API controller to an ASP.NET Core project.\n- Confirm field names, server validation, authorization, responsive CSS and full functionality.\n`;
  return {
    [`angular/${fileName}.component.ts`]: angularTs,
    [`angular/${fileName}.component.html`]: angularHtml,
    [`angular/${fileName}.component.css`]: angularCss,
    [`dotnet/${screenName}Controller.cs`]: controller,
    'MIGRATION_REPORT.json': JSON.stringify(report, null, 2),
    'REVIEW.md': readme
  };
}