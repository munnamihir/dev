import { mkdir, readFile, writeFile, rename, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const base = process.env.SCREENSHIFT_DATA_DIR || path.join(process.cwd(), '.data');
const validId = (id) => /^[a-f0-9-]{36}$/.test(id);
const file = (id) => { if (!validId(id)) throw new Error('Invalid project ID'); return path.join(base, `${id}.json`); };
export async function createProject(name) {
  const clean = typeof name === 'string' ? name.trim().slice(0, 100) : '';
  if (!clean) throw new Error('Project name is required');
  await mkdir(base, { recursive: true, mode: 0o700 });
  const project = { id: randomUUID(), name: clean, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), aspx: '', codeBehind: '', result: null };
  await saveProject(project);
  return project;
}
export async function saveProject(project) {
  await mkdir(base, { recursive: true, mode: 0o700 });
  const destination = file(project.id);
  const temp = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(project), { encoding: 'utf8', mode: 0o600 });
  await rename(temp, destination);
}
export async function getProject(id) {
  try { return JSON.parse(await readFile(file(id), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
export async function listProjects() {
  await mkdir(base, { recursive: true, mode: 0o700 });
  const filenames = (await readdir(base)).filter(n => /^[a-f0-9-]{36}\.json$/.test(n));
  const projects = await Promise.all(filenames.map(async n => {
    try { const p = JSON.parse(await readFile(path.join(base, n), 'utf8'));
      return { id: p.id, name: p.name, updatedAt: p.updatedAt, createdAt: p.createdAt, status: p.result ? 'analyzed' : 'draft', fields: p.result?.report?.stats?.fields || 0, findings: p.result?.report?.findings?.length || 0 };
    } catch { return null; }
  }));
  return projects.filter(Boolean).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function deleteProject(id) {
  try { await unlink(file(id)); return true; }
  catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}