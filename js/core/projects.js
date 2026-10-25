import * as store from './store.js';

// Projetos: cada um é um snapshot das chaves do espaço de trabalho no IndexedDB
const WS = ['form', 'imgs', 'music', 'wm', 'vigs', 'ws'];
export const list = async () => await store.get('projects') || [];
const saveList = l => store.set('projects', l.sort((a, b) => b.updated - a.updated));
export const newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export async function snapshot(id, meta = {}) {
  const data = {};
  for (const k of WS) data[k] = await store.get(k);
  await store.set('proj:' + id, data);
  const l = await list(), i = l.findIndex(p => p.id === id), old = l[i] || { id, created: Date.now() };
  const p = { ...old, ...meta, name: old.renamed ? old.name : meta.name || old.name, updated: Date.now() };
  i < 0 ? l.push(p) : l[i] = p;
  await saveList(l);
}
// carrega o projeto no espaço de trabalho e recarrega o app
export async function open(id) {
  const d = await store.get('proj:' + id) || {};
  for (const k of WS) d[k] === undefined ? await store.del(k) : await store.set(k, d[k]);
  await store.set('curProject', id); location.reload();
}
export async function create(seed) { for (const k of WS) await store.del(k); if (seed) await store.set('form', seed); await store.set('curProject', newId()); location.reload(); }
export async function remove(id) { await store.del('proj:' + id); await store.del('mix:' + id); await saveList((await list()).filter(p => p.id !== id)); }
export async function rename(id, name) { const l = await list(), p = l.find(x => x.id === id); if (p) { p.name = name; p.renamed = true; await saveList(l); } }
export async function duplicate(id) {
  const n = newId(), l = await list(), p = l.find(x => x.id === id);
  await store.set('proj:' + n, await store.get('proj:' + id));
  l.push({ ...p, id: n, name: p.name + ' (cópia)', renamed: true, created: Date.now(), updated: Date.now() }); await saveList(l);
}
