const $=id=>document.getElementById(id);
const state={files:[],report:null};
const supported=/\.(?:aspx|ascx|cs|ts|tsx|js|jsx|html)$/i;
const excluded=/(?:^|\/)(?:\.git|node_modules|bin|obj|dist|build|coverage|\.next|\.vs)(?:\/|$)|(?:secret|credential|password|token|private[-_]?key|appsettings|\.env)/i;
function add(parent,tag,value,className=''){
 const el=document.createElement(tag);el.textContent=String(value);
 if(className)el.className=className;parent.append(el);return el;
}
function item(id,heading,detail,badge){
 const el=add($(id),'div','','record');
 add(el,'strong',heading);add(el,'small',detail);
 if(badge)add(el,'span',badge,'pill');
}
function selection(message){$('selection').textContent=message;$('analyze').disabled=state.files.length===0}
async function request(url,init){
 const response=await fetch(url,init);const data=await response.json();
 if(!response.ok)throw new Error(data.error||'Request failed: '+response.status);return data;
}
async function select(files){
 let total=0,skipped=0;const collected=[];
 for(const file of files){
  const path=file.webkitRelativePath||file.name;
  if(!supported.test(path)||excluded.test(path)||file.size>150000){skipped++;continue}
  if(collected.length>=200||total+file.size>1250000){skipped++;continue}
  collected.push({path,content:await file.text()});total+=file.size;
 }
 state.files=collected;state.report=null;$('results').hidden=true;
 selection(collected.length+' files ready · '+Math.round(total/1024)+' KB'+(skipped?' · '+skipped+' skipped':'')+'.\nNo files sent to external services.');
}
for(const id of ['folder','files']){
 $(id).addEventListener('change',async event=>{
  try{await select(Array.from(event.target.files||[]))}
  catch(e){state.files=[];selection(e.message)}
 });
}
$('sample').addEventListener('click',async()=>{
 try{selection('Loading synthetic example…');const data=await request('/api/discovery/sample');
  state.files=data.files;selection(data.files.length+' synthetic files loaded. Modules: COOP and Common API.');
 }catch(e){state.files=[];selection(e.message)}
});
function render(report){
 state.report=report;$('results').hidden=false;
 for(const id of ['metrics','modules','edges','findings','inventory'])$(id).replaceChildren();
 for(const [label,name] of [['Files','files'],['Modules','modules'],['Screens','screens'],['API calls','apiCalls'],['Matched','matched']]){
  const metric=add($('metrics'),'div','','metric');add(metric,'strong',report.summary[name]);add(metric,'span',label);
 }
 if(!report.modules.length)add($('modules'),'p','No module candidates');
 for(const mod of report.modules)item('modules',mod.name,mod.fileCount+' files · '+mod.screenCount+' screens · '+mod.controllerCount+' controllers',mod.kind==='common'?'COMMON API':'MODULE');
 if(!report.edges.length)add($('edges'),'p','No literal API connections detected.');
 for(const edge of report.edges)item('edges',edge.method+' '+edge.route,edge.from+':'+edge.line+(edge.to?' → '+edge.to:' · Endpoint not proven'),edge.status.toUpperCase());
 if(!report.findings.length)add($('findings'),'p','No local review findings. Not a security audit.');
 for(const finding of report.findings)item('findings',finding.code,finding.path+' — '+finding.message,finding.severity.toUpperCase());
 for(const file of report.files)item('inventory',file.path,file.kind+' · '+file.authEvidence.length+' authorization references · '+file.endpointEvidence.length+' endpoint references',file.module);
 $('results').scrollIntoView({behavior:'smooth',block:'start'});
}
$('analyze').addEventListener('click',async()=>{
 const button=$('analyze');button.disabled=true;button.textContent='Analyzing…';
 try{const report=await request('/api/discovery/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({files:state.files})});render(report)}
 catch(e){selection(e.message)}
 finally{button.textContent='Analyze architecture ↗';button.disabled=state.files.length===0}
});
$('export').addEventListener('click',()=>{
 if(!state.report)return;
 const blob=new Blob([JSON.stringify(state.report,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='screenshift-discovery.json';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),500);
});
