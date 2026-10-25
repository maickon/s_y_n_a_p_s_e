// Armazenamento persistente: IndexedDB no navegador; no desktop, arquivos no disco (sem limite de cota)
import { isDesktop, call } from '../native.js';
import { encode, decode } from './codec.js';
const db = new Promise((ok, no) => {
  const r = indexedDB.open('synapse', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
});
const tx = async (mode, fn) => { const d = await db; return new Promise((ok, no) => { const t = d.transaction('kv', mode), q = fn(t.objectStore('kv')); t.oncomplete = () => ok(q?.result); t.onerror = () => no(t.error); }); };
const idb = { get: k => tx('readonly', s => s.get(k)), set: (k, v) => tx('readwrite', s => s.put(v, k)), del: k => tx('readwrite', s => s.delete(k)) };
const disk = {
  get: async k => decode(await call('kv_get', { key: k })),
  set: async (k, v) => call('kv_set', new Uint8Array(await encode(v).arrayBuffer()), { headers: { key: encodeURIComponent(k) } }),
  del: k => call('kv_del', { key: k })
};
// 1º uso do desktop: copia tudo do IndexedDB para o disco
const ready = isDesktop && (async () => {
  if (await disk.get('mig-disk')) return;
  const keys = await tx('readonly', s => s.getAllKeys()).catch(() => []);
  for (const k of keys) await disk.set(k, await idb.get(k));
  await disk.set('mig-disk', 1);
})().catch(e => console.warn('migração', e));
const B = isDesktop ? disk : idb, w = f => async (...a) => (await ready, f(...a));
export const get = w(k => B.get(k).catch(() => undefined));
export const set = w((k, v) => B.set(k, v).catch(e => console.warn('store', e)));
export const del = w(k => B.del(k).catch(() => { }));

// salva/restaura os campos marcados com data-persist
export async function bindForm(onRestore) {
  const els = [...document.querySelectorAll('[data-persist]')], saved = await get('form') || {};
  for (const e of els) if (e.id in saved) e.type === 'checkbox' ? e.checked = saved[e.id] : e.value = saved[e.id];
  onRestore?.(els);
  const save = () => set('form', Object.fromEntries(els.map(e => [e.id, e.type === 'checkbox' ? e.checked : e.value])));
  let t; els.forEach(e => e.addEventListener(e.tagName === 'TEXTAREA' || e.type === 'text' ? 'input' : 'change', () => { clearTimeout(t); t = setTimeout(save, 300); }));
}
