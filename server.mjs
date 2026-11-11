import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { analyze } from './lib/engine.mjs';
import { createProject, saveProject, getProject, listProjects, deleteProject } from './lib/store.mjs';
import { zipFiles } from './lib/zip.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const maxBody = 2 * 1024 * 1024;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const headers = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'Cache-Control': 'no-store'
};
function send(res, code, body, extra = {}) {
  res.writeHead(code, { ...headers, 'Content-Type': 'application/json; charset=utf-8', ...extra });
  res.end(JSON.stringify(body));
}
async function bodyJson(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) { const error = new Error('Content-Type must be application/json'); error.status = 415; throw error; }
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBody) { const error = new Error('Request exceeds 2 MiB'); error.status = 413; throw error; }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { const error = new Error('Invalid JSON'); error.status = 400; throw error; }
}
const idPattern = /^\/api\/projects\/([a-f0-9-]{36})(?:\/(analyze|download))?$/;
async function route(req,res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  if (pathname.startsWith('/api/')) {
    try {
      if (pathname === '/api/health' && req.method === 'GET') return send(res,200,{ok:true,version:'0.1.0',engine:'deterministic'});
      if (pathname === '/api/sample' && req.method === 'GET') {
        const aspx = await readFile(path.join(root, 'samples/CustomerRegistration.aspx'), 'utf8');
        const codeBehind = await readFile(path.join(root, 'samples/CustomerRegistration.aspx.cs'), 'utf8');
        return send(res, 200, { name: 'CustomerRegistration', aspx, codeBehind });
      }
      if (pathname === '/api/projects' && req.method === 'GET') return send(res,200,{projects: await listProjects()});
      if (pathname === '/api/projects' && req.method === 'POST') {
        const data = await bodyJson(req);
        const project = await createProject(data.name);
        return send(res,201,{project});
      }
      const m = idPattern.exec(pathname);
      if (m) {
        const [, id, action] = m;
        if (!action && req.method === 'DELETE') return send(res, await deleteProject(id) ? 200 : 404, { deleted: true });
        const project = await getProject(id);
        if (!project) return send(res,404,{error:'Project not found'});
        if (!action && req.method === 'GET') return send(res,200,{project});
        if (action === 'analyze' && req.method === 'POST') {
          const data = await bodyJson(req);
          if (typeof data.aspx !== 'string' || data.aspx.length > 1000000 || typeof data.codeBehind !== 'string' || data.codeBehind.length > 1000000) return send(res,400,{error:'ASPX and codeBehind must be text under 1,000,000 characters each'});
          project.aspx = data.aspx; project.codeBehind = data.codeBehind;
          project.result = analyze(data.aspx, data.codeBehind, project.name);
          project.updatedAt = new Date().toISOString();
          await saveProject(project);
          return send(res,200,{project});
        }
        if (action === 'download' && req.method === 'GET') {
          if (!project.result) return send(res,409,{error:'Analyze this project first'});
          const zip = zipFiles(project.result.files);
          res.writeHead(200,{...headers,'Content-Type':'application/zip','Content-Disposition':'attachment; filename="screenshift-migration.zip"','Content-Length':zip.length});
          return res.end(zip);
        }
      }
      return send(res,404,{error:'API route not found'});
    } catch (e) {
      const status = e.status || (['Project name is required','ASPX markup is required.','Invalid project ID'].includes(e.message) ? 400 : 500);
      if (status >= 500) console.error('API failure:', e);
      return send(res,status,{error:status >= 500 ? 'Internal error' : e.message});
    }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res,405,{error:'Method not allowed'});
  const assets = new Map([['/', 'index.html'], ['/app.js','app.js'], ['/style.css','style.css']]);
  const asset = assets.get(pathname);
  if (!asset) return send(res,404,{error:'Not found'});
  const bytes = await readFile(path.join(root, 'public', asset));
  res.writeHead(200,{...headers,'Content-Type':types[path.extname(asset)] || 'application/octet-stream'});
  res.end(req.method === 'HEAD' ? undefined : bytes);
}
export const server = http.createServer((req,res) => route(req,res).catch(e=>{ console.error(e); if(!res.headersSent)send(res,500,{error:'Internal server error'}); else res.end(); }));
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  server.listen(port,host,()=>console.log(`ScreenShift running at http://${host}:${port}`));
}