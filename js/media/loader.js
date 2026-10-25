import { isDesktop } from '../native.js';
import * as store from '../core/store.js';
import { hashKey } from '../audio/bufstore.js';
export const proxy = u => `https://wsrv.nl/?url=${encodeURIComponent(u)}&w=1920&h=1920&fit=inside&output=webp`;

const img = src => new Promise((ok, no) => {
  const i = new Image(), t = setTimeout(() => no(Error('timeout')), 15e3);
  i.crossOrigin = 'anonymous';
  i.onload = () => (clearTimeout(t), ok(i)); i.onerror = () => (clearTimeout(t), no(Error('load ' + src)));
  i.src = src;
});

// cache persistente das imagens (Cache Storage): recarregar a página não baixa de novo
// (no desktop: disco, sem limite de cota)
const C = !isDesktop && 'caches' in self ? caches.open('synapse-img-v1') : null;
export const cachedBlob = async u => isDesktop ? store.get('img:' + hashKey(u)) : (await (await C)?.match(u))?.blob();
export const putBlob = async (u, b) => isDesktop ? store.set('img:' + hashKey(u), b) : (await C)?.put(u, new Response(b));
async function cached(u) {
  const hit = await cachedBlob(u).catch(() => null);
  if (hit) return img(URL.createObjectURL(hit));
  for (const src of [u, proxy(u)]) {
    try { const r = await fetch(src, { mode: 'cors' }); if (!r.ok) continue; const b = await r.blob(); if (!b.type.startsWith('image/')) continue; putBlob(u, b); return img(URL.createObjectURL(b)); } catch { }
  }
  throw Error('load ' + u);
}
// tenta cache → direto (CORS) → proxy
export const loadImage = async u => /^(blob|data):/.test(u) ? img(u) : cached(u).catch(() => img(u).catch(() => img(proxy(u))));
