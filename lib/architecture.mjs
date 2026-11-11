// ScreenShift API topology generator. Declarative, bounded and fail-closed.
const valid = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const perm = /^[A-Za-z][A-Za-z0-9_.:/-]{0,99}$/;
const route = /^\/(?:[A-Za-z0-9_-]+|\{[A-Za-z][A-Za-z0-9_]*\})(?:\/(?:[A-Za-z0-9_-]+|\{[A-Za-z][A-Za-z0-9_]*\}))*$/;
const up = x => x.charAt(0).toUpperCase()+x.slice(1);
const kebab = x => x.replace(/([a-z0-9])([A-Z])/g,'$1-$2').replace(/_/g,'-').toLowerCase();
const bad = x => {const e=new Error('Invalid architecture: '+x);e.status=400;throw e;};
export function generateArchitecture(raw, aspx='',codeBehind='') {
  if(!raw || typeof raw!=='object' || Array.isArray(raw) || raw.version!==1)bad('version must be 1');
  if(JSON.stringify(raw).length>100000)bad('manifest exceeds 100KB');
  if(raw.auth?.provider!=='oidc')bad('OIDC provider is required');
  const pc=raw.auth.permissionClaim||'permission', rc=raw.auth.roleClaim||'role';
  if(!valid.test(pc)||!valid.test(rc))bad('invalid claim name');
  if(!Array.isArray(raw.modules)||!raw.modules.length||raw.modules.length>16)bad('provide 1–16 modules');
  const modules=[],keys=new Set(),basePaths=new Set();
  for(const m of raw.modules){
    if(!valid.test(m?.key||'')||keys.has(m.key.toLowerCase()))bad('invalid or duplicate module key');
    if(!['module','common'].includes(m.kind))bad('invalid module kind');
    if(typeof m.basePath!=='string'||!/^\/api\/[A-Za-z0-9_/-]+$/.test(m.basePath)||m.basePath.includes('//')||m.basePath.endsWith('/')||basePaths.has(m.basePath.toLowerCase()))bad('invalid or duplicate relative /api basePath');
    if(!Array.isArray(m.endpoints)||!m.endpoints.length||m.endpoints.length>32)bad('provide 1–32 endpoints per module');
    keys.add(m.key.toLowerCase());basePaths.add(m.basePath.toLowerCase());
    const names=new Set(),routes=new Set();
    const endpoints=m.endpoints.map(e=>{
      if(!valid.test(e?.name||'')||names.has(e.name))bad('invalid or duplicate endpoint name');
      if(!['GET','POST','PUT','PATCH','DELETE'].includes(e.method)||!route.test(e.path||''))bad('invalid endpoint method or path');
      if(!perm.test(e.permission||''))bad('every endpoint needs explicit permission');
      if(e.sourceSchema && (!valid.test(e.sourceSchema)||(m.kind!=='common'&&e.sourceSchema==='dbo')))bad('dbo shared access belongs in Common API');
      if(routes.has(e.method+' '+e.path))bad('duplicate endpoint route');
      const roles=e.allowedRoles||[];
      if(!Array.isArray(roles)||roles.length>16||!roles.every(x=>valid.test(x)))bad('invalid role alternatives');
      const params=[...e.path.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(x=>x[1]);
      if(new Set(params).size!==params.length||params.includes('body'))bad('invalid route params');
      names.add(e.name);routes.add(e.method+' '+e.path);
      return {name:e.name,path:e.path,method:e.method,permission:e.permission,roles,sourceSchema:e.sourceSchema||null,params};
    });
    modules.push({key:m.key,kind:m.kind,basePath:m.basePath,endpoints});
  }
  if(modules.filter(m=>m.kind==='common').length>1||modules.reduce((n,m)=>n+m.endpoints.length,0)>64)bad('too many Common APIs or endpoints');
  const b=raw.screenBinding;let screenBinding=null;
  if(b){
    const m=modules.find(x=>x.key===b.module);
    const read=m?.endpoints.find(x=>x.name===b.loadEndpoint);
    const write=m?.endpoints.find(x=>x.name===b.submitEndpoint);
    if(!m||(!read&&!write))bad('unknown screen binding');
    if(b.loadEndpoint&&(!read||read.method!=='GET'||read.params.length))bad('loadEndpoint must reference parameterless GET');
    if(b.submitEndpoint&&(!write||!['POST','PUT','PATCH'].includes(write.method)||write.params.length))bad('submitEndpoint must reference parameterless write');
    screenBinding={module:m.key,loadEndpoint:read?.name||null,submitEndpoint:write?.name||null};
  }
  const files={};
  files['angular/core/auth/auth.port.ts']="import { InjectionToken } from '@angular/core';\nexport interface AuthPort { isAuthenticated():boolean; hasPermission(permission:string):boolean; getAccessToken():Promise<string|null>; }\nexport const AUTH_PORT=new InjectionToken<AuthPort>('SCREENSHIFT_AUTH_PORT');\n// Connect an audited OIDC adapter. This is a contract, not an implemented login.";
  files['angular/core/auth/permission.guard.ts']="import { inject } from '@angular/core';\nimport { CanActivateFn, Router } from '@angular/router';\nimport { AUTH_PORT } from './auth.port';\nexport const permissionGuard:CanActivateFn=route=>{const a=inject(AUTH_PORT), r=inject(Router);if(!a.isAuthenticated())return r.parseUrl('/sign-in');const p=route.data['permission'];return typeof p==='string'&&a.hasPermission(p)?true:r.parseUrl('/forbidden');};\n// Client route guards are UX ONLY; APIs must authorize independently.";
  files['angular/core/http/auth.interceptor.ts']="import { inject } from '@angular/core';\nimport { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';\nimport { from, switchMap, throwError } from 'rxjs';\nimport { AUTH_PORT } from '../auth/auth.port';\nexport const authInterceptor:HttpInterceptorFn=(req,next)=>{if(!req.url.startsWith('/api/'))return next(req);return from(inject(AUTH_PORT).getAccessToken()).pipe(switchMap(token=>token?next(req.clone({setHeaders:{Authorization:'Bearer '+token}})):throwError(()=>new HttpErrorResponse({status:401,statusText:'Authentication required'}))));};";
  const matrix=[],policies=new Map();
  for(const m of modules){
    const className=up(m.key),apiMethods=[],controllerActions=[];
    for(const e of m.endpoints){
      matrix.push({module:m.key,kind:m.kind,method:e.method,path:m.basePath+e.path,permission:e.permission,sourceSchema:e.sourceSchema,allowedRoles:e.roles});
      if(policies.has(e.permission)&&JSON.stringify(policies.get(e.permission))!==JSON.stringify(e.roles))bad('conflicting roles for permission '+e.permission);
      policies.set(e.permission,e.roles);
      const body=['POST','PUT','PATCH'].includes(e.method);
      const args=e.params.map(x=>x+': string');if(body)args.push('body: unknown');
      const url=JSON.stringify(m.basePath+e.path).replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g,'" + encodeURIComponent($1) + "');
      apiMethods.push('  '+e.name+'('+args.join(', ')+'):Observable<unknown>{\n    if(!this.auth.hasPermission('+JSON.stringify(e.permission)+'))return throwError(()=>new HttpErrorResponse({status:403,statusText:"Access denied"}));\n    return this.http.request<unknown>('+JSON.stringify(e.method)+', '+url+(body?',{body}':'')+');\n  }');
      const cargs=e.params.map(x=>'[FromRoute] string '+x);if(body)cargs.push('[FromBody] JsonElement body');
      controllerActions.push('  [Http'+up(e.method.toLowerCase())+'('+JSON.stringify(e.path.slice(1))+')]\n  [Authorize(Policy='+JSON.stringify(e.permission)+')]\n  public IActionResult '+up(e.name)+'('+cargs.join(', ')+'){\n    // TODO: port validated business logic and per-resource authorization.\n    return StatusCode(501,new {error="Migration not implemented"});\n  }');
    }
    files['angular/api/'+kebab(m.key)+'.api-client.ts']="// REVIEW API DTOs and response shapes; clients use unknown until validated.\nimport { Injectable,inject } from '@angular/core';\nimport { HttpClient,HttpErrorResponse } from '@angular/common/http';\nimport { Observable,throwError } from 'rxjs';\nimport { AUTH_PORT } from '../core/auth/auth.port';\n@Injectable({providedIn:'root'})\nexport class "+className+"ApiClient{\n private readonly http=inject(HttpClient);\n private readonly auth=inject(AUTH_PORT);\n"+apiMethods.join('\n')+"\n}";
    files['dotnet/'+className+'Controller.cs']="using Microsoft.AspNetCore.Mvc;\nusing Microsoft.AspNetCore.Authorization;\nusing System.Text.Json;\nnamespace ScreenShift.Generated;\n[ApiController][Authorize][Route("+JSON.stringify(m.basePath.slice(1))+")]\npublic sealed class "+className+"Controller:ControllerBase{\n"+controllerActions.join('\n')+"\n}";
  }
  const rules=[...policies].map(([p,roles])=>'options.AddPolicy('+JSON.stringify(p)+',policy=>policy.RequireAuthenticatedUser().RequireAssertion(ctx=>ctx.User.HasClaim('+JSON.stringify(pc)+','+JSON.stringify(p)+')'+(roles.length?'||new[]{'+roles.map(JSON.stringify).join(',')+'}.Any(role=>ctx.User.IsInRole(role))':'')+'));').join('\n');
  files['dotnet/SecurityRegistration.cs']="using Microsoft.AspNetCore.Authentication.JwtBearer;\nusing Microsoft.IdentityModel.Tokens;\nusing Microsoft.Extensions.DependencyInjection;\nusing Microsoft.Extensions.Configuration;\nusing System.Linq;\nnamespace ScreenShift.Generated;\npublic static class SecurityRegistration{\n public static IServiceCollection AddScreenShiftSecurity(this IServiceCollection services,IConfiguration config){\n  var issuer=config[\"Authentication:Authority\"]??throw new InvalidOperationException(\"Missing issuer\");\n  var audience=config[\"Authentication:Audience\"]??throw new InvalidOperationException(\"Missing audience\");\n  services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o=>{o.Authority=issuer;o.Audience=audience;o.RequireHttpsMetadata=true;o.TokenValidationParameters=new TokenValidationParameters{ValidateIssuer=true,ValidateAudience=true,ValidateLifetime=true,RequireSignedTokens=true,RoleClaimType="+JSON.stringify(rc)+"};});\n  services.AddAuthorization(options=>{\n"+rules+"\n});return services;}\n}\n// Register in EACH module and Common API: AddScreenShiftSecurity, UseAuthentication, UseAuthorization, MapControllers.";
  const src=aspx+'\n'+codeBehind;
  const signals={roleChecks:(src.match(/\bIsInRole\b|\bAuthorize\b/g)||[]).length,commonApi:(src.match(/Common\.API|CommonAPI|CommonApi/g)||[]).length,dbo:(src.match(/\bdbo\.|\[dbo\]\./g)||[]).length};
  files['API_POLICY_MATRIX.json']=JSON.stringify({matrix,signals},null,2);
  files['ARCHITECTURE_REVIEW.md']="# Architecture review required\n\nEach module API and the Common API must enforce OIDC authentication and server-side policy checks. Clients may preflight permissions but never confer access. Tokens only go to same-origin /api/ routes. Schema dbo is descriptive, not permission to query a database. Configure trusted issuer/audience, gateway, token storage strategy, role claims, resource ownership, request/response DTOs and data access. All generated business endpoints return 501 until reviewed. No employer source should be uploaded publicly.";
  return {files,summary:{modules:modules.length,endpoints:matrix.length,commonApis:modules.filter(x=>x.kind==='common').length,matrix,signals,screenBinding}};
}