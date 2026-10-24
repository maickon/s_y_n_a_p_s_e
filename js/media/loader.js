export const proxy = u => `https://wsrv.nl/?url=${encodeURIComponent(u)}&w=1920&h=1920&fit=inside&output=webp`;

const img = src => new Promise((ok, no) => {
  const i = new Image(), t = setTimeout(() => no(Error('timeout')), 15e3);
  i.crossOrigin = 'anonymous';
  i.onload = () => (clearTimeout(t), ok(i)); i.onerror = () => (clearTimeout(t), no(Error('load ' + src)));
  i.src = src;
});

// cache persistente das imagens (Cache Storage): recarregar a página não baixa de novo
const C = 'caches' in self ? caches.open('synapse-img-v1') : null;
async function cached(u) {
  const c = await C, hit = await c?.match(u);
  if (hit) return img(URL.createObjectURL(await hit.blob()));
  for (const src of [u, proxy(u)]) {
    try { const r = await fetch(src, { mode: 'cors' }); if (!r.ok) continue; const b = await r.blob(); if (!b.type.startsWith('image/')) continue; c?.put(u, new Response(b)); return img(URL.createObjectURL(b)); } catch { }
  }
  throw Error('load ' + u);
}
// tenta cache → direto (CORS) → proxy
export const loadImage = async u => /^(blob|data):/.test(u) ? img(u) : cached(u).catch(() => img(u).catch(() => img(proxy(u))));
