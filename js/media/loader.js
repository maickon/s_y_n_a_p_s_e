import { isDesktop, call } from '../native.js';
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

// --- vídeo: baixado inteiro como Blob (desktop: nativo, sem CORS; web: fetch com CORS) e cacheado ---
const VMAX = 60e6;
async function videoBlob(src) {
  const k = 'vid:' + hashKey(src), hit = await store.get(k).catch(() => null);
  if (hit instanceof Blob) return hit;
  const b = isDesktop ? new Blob([await call('http_bytes', { url: src })]) : await fetch(src, { mode: 'cors' }).then(r => r.ok ? r.blob() : Promise.reject(Error('HTTP ' + r.status)));
  if (!b.size || b.size > VMAX) throw Error('vídeo grande demais');
  store.set(k, b); return b;
}
// -> { el (HTMLVideoElement mudo), canvas (quadro atual, .src = miniatura), w, h, dur, blob }
export async function loadVideo(src, blob, thumb) {
  blob ??= await videoBlob(src);
  const url = URL.createObjectURL(blob), el = document.createElement('video');
  Object.assign(el, { muted: true, playsInline: true, preload: 'auto' });
  await new Promise((ok, no) => { el.onloadeddata = ok; el.onerror = () => no(Error('formato de vídeo não suportado')); setTimeout(() => no(Error('tempo esgotado')), 25e3); el.src = url; });
  const k = Math.min(1, 1280 / el.videoWidth), c = Object.assign(document.createElement('canvas'), { width: Math.round(el.videoWidth * k), height: Math.round(el.videoHeight * k) });
  c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
  const t = Object.assign(document.createElement('canvas'), { width: 320, height: Math.round(320 * c.height / c.width) }); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
  c.src = thumb || t.toDataURL('image/jpeg', .7); // miniatura para grade/timeline/editor
  return { el, canvas: c, w: el.videoWidth, h: el.videoHeight, dur: el.duration, blob, url };
}
