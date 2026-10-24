// Armazenamento persistente (IndexedDB) de configurações e arquivos
const db = new Promise((ok, no) => {
  const r = indexedDB.open('synapse', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
});
const tx = async (mode, fn) => { const d = await db; return new Promise((ok, no) => { const t = d.transaction('kv', mode), q = fn(t.objectStore('kv')); t.oncomplete = () => ok(q?.result); t.onerror = () => no(t.error); }); };
export const get = k => tx('readonly', s => s.get(k)).catch(() => undefined);
export const set = (k, v) => tx('readwrite', s => s.put(v, k)).catch(e => console.warn('store', e));
export const del = k => tx('readwrite', s => s.delete(k)).catch(() => { });

// salva/restaura os campos marcados com data-persist
export async function bindForm(onRestore) {
  const els = [...document.querySelectorAll('[data-persist]')], saved = await get('form') || {};
  for (const e of els) if (e.id in saved) e.type === 'checkbox' ? e.checked = saved[e.id] : e.value = saved[e.id];
  onRestore?.(els);
  const save = () => set('form', Object.fromEntries(els.map(e => [e.id, e.type === 'checkbox' ? e.checked : e.value])));
  let t; els.forEach(e => e.addEventListener(e.tagName === 'TEXTAREA' || e.type === 'text' ? 'input' : 'change', () => { clearTimeout(t); t = setTimeout(save, 300); }));
}
