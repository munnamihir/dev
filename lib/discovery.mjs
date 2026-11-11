import { createHash } from 'node:crypto';
/** ScreenShift v0.3: bounded static topology analysis. Source is never executed. */
const ext=/\.(?:aspx|ascx|cs|ts|tsx|js|jsx|html)$/i;
const forbidden=/(?:^|\/)(?:\.git|node_modules|bin|obj|dist|build|coverage|\.next|\.vs)(?:\/|$)/i;
const secrets=/(?:^|[\/._-])(?:secret|credential|password|token|private[-_]?key|connection[-_]?string|appsettings|\.env)(?:$|[._-])/i;
const fail=msg=>{const e=new Error(msg);e.status=400;throw e};
const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
const line=(s,i)=>s.slice(0,i).split('\n').length;
const key=s=>String(s).replace(/[^a-z0-9]/gi,'').toLowerCase();
const scan=(s,re,fn)=>Array.from(s.matchAll(re)).slice(0,120).map(m=>({...fn(m),line:line(s,m.index)}));
function moduleOf(path){
 const dirs=path.split('/').slice(0,-1);
 for(const d of dirs){const m=/^([A-Za-z][\w-]*)\.API$/i.exec(d);if(m)return m[1]}
 for(let i=0;i<dirs.length-1;i++)if(/^(modules|areas|features)$/i.test(dirs[i]))return dirs[i+1];
 return dirs.find(x=>!/^(src|app|apps|pages|views|components|controllers|services|api|shared|commonlib|public|web|frontend|backend|rfp|rfp\.web|legacy|modern|core|lib)$/i.test(x))||'Unclassified';
}
function kind(path,s){
 if(/\.(?:aspx|ascx)$/i.test(path)||/\.component\.html$/i.test(path)||(/\.tsx?$/i.test(path)&&/@Component\s*\(/.test(s)))return 'screen';
 if(/\.cs$/i.test(path)&&(/\[ApiController\]/.test(s)||/Controller\.cs$/i.test(path)))return 'api-controller';
 if(/\.aspx\.cs$/i.test(path))return 'code-behind';
 if(/\.(?:ts|js)$/i.test(path)&&(/\.service\./.test(path)||/@Injectable/.test(s)))return 'api-client';
 return 'source';
}
export function discoverApplication(input){
 if(!Array.isArray(input?.files)||!input.files.length||input.files.length>200)fail('Provide 1–200 source files');
 let total=0;const seen=new Set();
 const files=input.files.map((f,i)=>{
  if(typeof f?.path!=='string'||typeof f.content!=='string')fail('Each file needs a path and content');
  if(f.path.startsWith('/')||/^[A-Za-z]:[\\/]/.test(f.path)||f.path.includes('\0'))fail('Absolute path rejected');
  const path=f.path.replace(/\\/g,'/').replace(/\/+/g,'/');
  if(!path||path.length>280||!ext.test(path)||path.split('/').some(p=>!p||p==='..'||p==='.'||p.startsWith('.'))||forbidden.test(path)||secrets.test(path))fail('Unsupported or sensitive path ('+(i+1)+')');
  if(seen.has(path.toLowerCase()))fail('Duplicate path: '+path);
  seen.add(path.toLowerCase());
  const size=Buffer.byteLength(f.content,'utf8');total+=size;
  if(size>150000)fail('Source file exceeds 150 KB');
  if(total>1500000)fail('Selection exceeds 1.5 MB');
  return {path,source:f.content};
 });
 const docs=files.map(({path,source})=>{
  const type=kind(path,source),module=moduleOf(path);
  const authEvidence=scan(source,/\[(Authorize|AllowAnonymous)(?:\s*\(([^\]\r\n]{0,250})\))?\]|(?:RequireAuthorization|IsInRole|HasClaim|HasPermission|AuthenticationStateProvider|User\.Identity)\b/g,m=>({kind:m[1]||m[0],detail:(m[2]||'').slice(0,180)}));
  const dboReferences=scan(source,/\b(?:dbo|\[dbo\])\s*\.\s*(?:\[([A-Za-z0-9_]+)\]|([A-Za-z0-9_]+))/gi,m=>({schema:'dbo',object:m[1]||m[2]}));
  const prefix=/\[Route\s*\(\s*"([^"\r\n]+)"\s*\)\s*\]/i.exec(source)?.[1]||null;
  const name=path.split('/').at(-1).replace(/Controller\.cs$/i,'');
  const base=prefix?.replace(/\[controller\]/gi,name).replace(/^\/+|\/+$/g,'');
  const endpointEvidence=type==='api-controller'?scan(source,/\[(HttpGet|HttpPost|HttpPut|HttpPatch|HttpDelete)(?:\s*\(\s*"([^"\r\n]*)"\s*\))?\s*\]/g,m=>({method:m[1].slice(4).toUpperCase(),route:base?'/'+[base,(m[2]||'').replace(/^\/+|\/+$/g,'')].filter(Boolean).join('/'):null,confidence:base?'high':'low'})):[];
  const apiCalls=scan(source,/['"\x60](\/api\/[A-Za-z0-9_{}./-]+)['"\x60]/g,m=>({route:m[1],method:'UNKNOWN'}));
  const direct=scan(source,/\.(get|post|put|patch|delete)\s*(?:<[^>\r\n]{0,80}>)?\s*\(\s*['"\x60](\/api\/[A-Za-z0-9_{}./-]+)['"\x60]/gi,m=>({route:m[2],method:m[1].toUpperCase()}));
  for(const d of direct){const c=apiCalls.find(x=>x.line===d.line&&x.route===d.route);if(c)c.method=d.method;else apiCalls.push(d)}
  return {path,hash:hash(source),module,kind:type,authEvidence,dboReferences,endpointEvidence,apiCalls};
 });
 const modules=[...new Set(docs.map(f=>key(f.module)))].map(k=>{
  const members=docs.filter(f=>key(f.module)===k);
  return {key:k,name:members[0].module,kind:k==='common'?'common':'module',fileCount:members.length,screenCount:members.filter(f=>f.kind==='screen').length,controllerCount:members.filter(f=>f.kind==='api-controller').length,files:members.map(f=>f.path)};
 }).sort((a,b)=>a.name.localeCompare(b.name));
 const indexed=docs.flatMap(f=>f.endpointEvidence.map(e=>({...e,module:f.module,path:f.path})));
 const edges=[],findings=[];
 for(const f of docs){
  for(const c of f.apiCalls){
   const matches=indexed.filter(e=>e.route&&e.route.toLowerCase()===c.route.toLowerCase()&&(c.method==='UNKNOWN'||c.method===e.method));
   const dest=matches.length===1?matches[0]:null,status=dest?'matched':matches.length>1?'ambiguous':'unresolved';
   edges.push({from:f.path,fromModule:f.module,to:dest?.path||null,toModule:dest?.module||null,route:c.route,method:c.method,line:c.line,status,confidence:dest?'high':'low'});
   if(!dest)findings.push({severity:'review',code:'UNRESOLVED_API',path:f.path,message:'Cannot prove matching backend for '+c.route+' at line '+c.line});
  }
  if(f.kind==='api-controller'&&f.endpointEvidence.length&&!f.authEvidence.some(a=>/Authorize|AllowAnonymous|RequireAuthorization/.test(a.kind)))findings.push({severity:'review',code:'POLICY_UNVERIFIED',path:f.path,message:'Local authorization annotation absent; global policies may apply.'});
  if(f.authEvidence.some(a=>a.kind==='AllowAnonymous'))findings.push({severity:'review',code:'ANONYMOUS_ENDPOINT',path:f.path,message:'Review intentionally anonymous API behavior.'});
  if(f.dboReferences.length&&key(f.module)!=='common')findings.push({severity:'info',code:'DBO_REFERENCE',path:f.path,message:'dbo schema does not establish Common API ownership or permissions.'});
 }
 if(!indexed.length)findings.push({severity:'info',code:'NO_ENDPOINTS',path:'(project)',message:'No attributed API endpoint discovered.'});
 return {version:1,engine:'heuristic-static',summary:{files:docs.length,modules:modules.length,screens:docs.filter(f=>f.kind==='screen').length,controllers:docs.filter(f=>f.kind==='api-controller').length,apiCalls:edges.length,matched:edges.filter(e=>e.status==='matched').length,reviewFindings:findings.filter(f=>f.severity==='review').length},modules,files:docs,edges,findings,caveats:['Static evidence only: module names, endpoints and permissions require verification.','Dynamic URLs, inherited authorization, gateway rewrites and import graphs are not resolved.','Each backend service must independently authorize API requests.','A dbo SQL schema reference is not a Common API access grant.','Source is never executed or persisted by this endpoint.']};
}
