const state = { projects: [], project: null, view: 'overview', file: null };
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const d = date => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
async function api(path, options) {
  const response = await fetch(path, options ? { ...options, headers: { 'Content-Type': 'application/json' } } : undefined);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}
function notice(message, error = false) {
  const toast = $('toast'); toast.textContent = message; toast.hidden = false; toast.classList.toggle('error-toast', error);
  clearTimeout(notice.timer); notice.timer = setTimeout(() => toast.hidden = true, 5200);
}
function show(view) {
  state.view = view;
  for (const name of ['overview','studio','report','artifacts']) $(`${name}-view`).hidden = name !== view;
  document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b.dataset.view === view); b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false'); });
  $('current-view').textContent = ({overview:'Overview',studio:'Migration studio',report:'Analysis report',artifacts:'Generated code'})[view];
  if (view === 'report') renderReport(); if (view === 'artifacts') renderFiles();
  history.replaceState(null, '', `#${view}`);
  window.scrollTo({ top: 0, behavior: 'instant' });
}
async function loadProjects() {
  state.projects = (await api('/api/projects')).projects;
  $('m-projects').textContent = state.projects.length;
  $('m-analyzed').textContent = state.projects.filter(p=>p.status==='analyzed').length;
  $('m-fields').textContent = state.projects.reduce((n,p)=>n+p.fields,0);
  $('m-findings').textContent = state.projects.reduce((n,p)=>n+p.findings,0);
  const list = $('project-list');
  if (!state.projects.length) { list.innerHTML = `<div class="empty-projects"><span class="empty-icon">◇</span><h3>Your next migration starts here.</h3><p>Create a new project or open the sample to experience ScreenShift.</p><button type="button" class="btn btn-outline" id="empty-sample">Open sample →</button></div>`; $('empty-sample').addEventListener('click', trySample); return; }
  list.innerHTML = state.projects.map(p=>`<article class="project-card"><div class="project-icon">⌘</div><div class="project-status">${p.status === 'analyzed' ? '<span class="status-ok">● ANALYZED</span>' : '<span class="status-draft">○ DRAFT</span>'}</div><h3>${esc(p.name)}</h3><p>Updated ${esc(d(p.updatedAt))}</p><div class="project-bottom"><span>${p.fields} fields · ${p.findings} findings</span><button type="button" class="open-project" data-id="${esc(p.id)}" aria-label="Open ${esc(p.name)}">↗</button></div></article>`).join('') + `<button type="button" id="new-project-card" class="add-card"><span>+</span><strong>New migration</strong><small>Start from a blank screen</small></button>`;
  document.querySelectorAll('.open-project').forEach(b=>b.addEventListener('click',()=>openProject(b.dataset.id)));
  $('new-project-card').addEventListener('click', newDialog);
}
function newDialog() { $('project-name').value = ''; $('project-dialog').showModal(); $('project-name').focus(); }
async function createProject(name) {
  const { project } = await api('/api/projects',{method:'POST',body:JSON.stringify({name})});
  await loadProjects(); await openProject(project.id); notice(`Created “${project.name}”`);
  return project;
}
async function openProject(id) {
  state.project = (await api(`/api/projects/${id}`)).project;
  $('studio-project-name').textContent = state.project.name;
  $('studio-project-meta').textContent = `Created ${d(state.project.createdAt)} · ${state.project.result ? 'Analysis available' : 'Not analyzed yet'}`;
  $('aspx-input').value = state.project.aspx || '';
  $('codebehind-input').value = state.project.codeBehind || '';
  updateLines(); renderStudioResults(); show('studio');
}
async function trySample() {
  try {
    const sample = await api('/api/sample');
    const p = await createProject(sample.name);
    $('aspx-input').value = sample.aspx; $('codebehind-input').value = sample.codeBehind; updateLines();
    notice('Synthetic sample loaded. Click Analyze & generate.');
  } catch(e) { notice(e.message, true); }
}
async function importSample() {
  try { const sample = await api('/api/sample'); $('aspx-input').value = sample.aspx; $('codebehind-input').value = sample.codeBehind; updateLines(); notice('Synthetic example imported.'); }
  catch (e) { notice(e.message, true); }
}
function updateLines() { $('aspx-lines').textContent = `${$('aspx-input').value.split('\n').length} lines`; $('cs-lines').textContent = `${$('codebehind-input').value.split('\n').length} lines`; }
async function analyzeProject() {
  if (!state.project) return notice('Create or open a project first.', true);
  const button = $('run-analysis'); button.disabled = true; button.textContent = 'Analyzing…';
  try {
    const { project } = await api(`/api/projects/${state.project.id}/analyze`, {method:'POST',body:JSON.stringify({aspx:$('aspx-input').value,codeBehind:$('codebehind-input').value})});
    state.project = project; renderStudioResults(); await loadProjects(); notice('Analysis complete — review generated artifacts and findings.');
  } catch (e) { notice(e.message, true); }
  finally { button.disabled = false; button.innerHTML = 'Analyze &amp; generate <span aria-hidden="true">↗</span>'; }
}
function renderStudioResults() {
  const root = $('studio-results'); const r = state.project?.result?.report;
  if (!r) { root.className = 'empty-result'; root.innerHTML = '<div class="empty-icon">◎</div><strong>Ready when you are</strong><p>Analyze your markup to see mapped fields, findings, and generated files.</p>'; return; }
  root.className = 'result-complete';
  root.innerHTML = `<div class="complete-indicator">✓ <span>Analysis completed</span></div><div class="result-summary"><div><strong>${r.stats.totalControls}</strong><small>Controls detected</small></div><div><strong>${r.stats.fields}</strong><small>Form fields</small></div><div><strong>${r.findings.length}</strong><small>Review findings</small></div></div><div class="result-links"><button type="button" id="go-report">View findings ↗</button><button type="button" id="go-artifacts">Explore code ↗</button></div>`;
  $('go-report').addEventListener('click',()=>show('report')); $('go-artifacts').addEventListener('click',()=>show('artifacts'));
}
const emptyState = (heading, desc) => `<div class="page-empty"><div class="empty-icon">◎</div><h3>${heading}</h3><p>${desc}</p><button class="btn btn-primary" id="empty-go-studio" type="button">Open migration studio ↗</button></div>`;
function setEmpty(root, heading, desc) { root.innerHTML = emptyState(heading,desc); $('empty-go-studio').addEventListener('click',()=>show('studio')); }
function renderReport() {
  const root = $('report-body'), r = state.project?.result?.report;
  if (!r) return setEmpty(root, 'No report generated yet', 'Import a legacy ASPX screen and run an analysis to generate the engineering report.');
  const stat = r.stats;
  root.innerHTML = `<div class="report-meta card"><div><div class="overline">SCREEN UNDER REVIEW</div><h2>${esc(state.project.name)}</h2><p>Generated ${esc(d(state.project.updatedAt))} · Rule-based inventory</p></div><span class="review-pill">⚠ REVIEW REQUIRED</span></div><div class="metric-grid report-metrics"><div class="metric"><div class="metric-label">Controls mapped</div><div class="metric-number">${stat.totalControls}</div></div><div class="metric"><div class="metric-label">Form inputs</div><div class="metric-number">${stat.fields}</div></div><div class="metric"><div class="metric-label">Validators</div><div class="metric-number">${stat.validators}</div></div><div class="metric"><div class="metric-label">Identified methods</div><div class="metric-number">${stat.eventHandlers}</div></div></div><div class="report-columns"><div class="card report-section"><div class="overline">EVIDENCE / 01</div><h3>Review findings <span class="count">${r.findings.length}</span></h3><div class="finding-list">${r.findings.map(f=>`<div class="finding"><span class="severity ${esc(f.severity)}">${esc(f.severity)}</span><div><strong>${esc(f.title)}</strong><p>${esc(f.detail)}</p></div></div>`).join('')}</div></div><div class="card report-section"><div class="overline">EVIDENCE / 02</div><h3>Control inventory <span class="count">${r.controlInventory.length}</span></h3><div class="inventory">${r.controlInventory.map(c=>`<div><code>${esc(c.id)}</code><span>${esc(c.type)}</span><b class="${c.supported ? 'state-supported' : 'state-review'}">${c.supported ? 'Mapped' : 'Review'}</b></div>`).join('')}</div></div></div><div class="card report-section checklist"><div class="overline">ENGINEERING / GO-NO GO</div><h3>Review checklist</h3><p>Complete these independently before treating a migration as production-ready.</p>${r.checklist.map(c=>`<label><input type="checkbox" /> <span>${esc(c)}</span></label>`).join('')}</div>`;
}
function renderFiles() {
  const root = $('files-body'), files = state.project?.result?.files;
  $('download-zip').disabled = !files;
  if (!files) return setEmpty(root, 'No artifacts yet', 'Analyze your screen to create Angular components, a .NET API contract and migration notes.');
  const names = Object.keys(files);
  const selected = state.file && names.includes(state.file) ? state.file : names[0]; state.file = selected;
  root.innerHTML = `<div class="artifact-layout"><div class="artifact-list" role="tablist" aria-label="Generated files">${names.map(f=>`<button type="button" role="tab" aria-selected="${f===selected}" class="artifact-tab ${f===selected ? 'selected' : ''}" data-file="${esc(f)}"><span>◇</span> ${esc(f)}</button>`).join('')}</div><div class="artifact-preview"><div class="preview-bar"><span id="preview-name">${esc(selected)}</span><button type="button" id="copy-file" class="copy-button">Copy code</button></div><pre><code id="code-content"></code></pre></div></div>`;
  $('code-content').textContent = files[selected];
  document.querySelectorAll('.artifact-tab').forEach(b=>b.addEventListener('click',()=>{state.file=b.dataset.file;renderFiles();}));
  $('copy-file').addEventListener('click',async()=>{try { await navigator.clipboard.writeText(files[state.file]); notice('Code copied to clipboard.'); } catch { notice('Copy unavailable in this browser.', true); }});
}
function init() {
  $('today').textContent = d(new Date().toISOString());
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
  $('brand').addEventListener('click', e=>{e.preventDefault();show('overview');});
  ['new-project-top','new-project-hero'].forEach(id=>$(id).addEventListener('click',newDialog));
  ['try-sample-hero'].forEach(id=>$(id).addEventListener('click',trySample));
  $('refresh-projects').addEventListener('click',()=>loadProjects().catch(e=>notice(e.message,true)));
  $('project-form').addEventListener('submit',async e=>{e.preventDefault();const name=$('project-name').value.trim(); if(!name)return; $('project-dialog').close(); try {await createProject(name);}catch(err){notice(err.message,true);}});
  $('close-dialog').addEventListener('click',()=>$('project-dialog').close()); $('cancel-dialog').addEventListener('click',()=>$('project-dialog').close());
  $('load-sample').addEventListener('click',importSample);
  $('run-analysis').addEventListener('click',analyzeProject);
  $('download-zip').addEventListener('click',()=>{ if (state.project?.result) window.location.assign(`/api/projects/${state.project.id}/download`); });
  ['aspx-input','codebehind-input'].forEach(id=>$(id).addEventListener('input',updateLines));
  for(const [id,field] of [['aspx-file','aspx-input'],['cs-file','codebehind-input']])$(id).addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>1000000){notice('Maximum file size: 1 MB',true);return;}$(field).value=await f.text();updateLines();notice(`Imported ${f.name}`);});
  loadProjects().catch(e=>notice(e.message,true));
  const hash = location.hash.slice(1); if(['overview','studio','report','artifacts'].includes(hash))show(hash);
}
init();