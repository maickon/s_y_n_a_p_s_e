import { loadImage } from '../media/loader.js';
import { searchImages } from '../media/search.js';
import { keywords } from './keywords.js';
import { norm } from './words.js';
import { clipMatrix } from '../ai/clip.js';
import { hash } from './script.js';

export const assets = []; // {id, src, img, tag, credit, origin}

export async function addAsset({ src, tag = '', credit = '', origin = 'url' }) {
  const a = assets.find(x => x.src === src);
  if (a) return a;
  const n = { id: Math.random().toString(36).slice(2), src, img: await loadImage(src), tag, credit, origin };
  assets.push(n);
  return n;
}
export const removeAsset = a => assets.splice(assets.indexOf(a), 1);

// linhas: "url" ou "palavra | url"
export const parseUrls = t => t.split('\n').map(l => l.trim()).filter(Boolean)
  .map(l => { const [a, b] = l.split('|').map(s => s.trim()); return b ? { tag: a, src: b } : { src: a }; })
  .filter(x => /^https?:\/\//.test(x.src));

const hit = (tag, text) => { const t = norm(tag); return t.length > 2 && text.split(/\s+/).some(w => { w = norm(w); return w.length > 2 && (w.startsWith(t) || t.startsWith(w)); }); };

// imagens por cena: tag -> busca -> CLIP/distribuição
export async function plan(tl, { search, clip, onStatus }) {
  const P = tl.map(() => []), used = new Set();
  for (const a of assets) if (a.tag && a.origin !== 'search') tl.forEach((s, i) => hit(a.tag, s.text) && (P[i].push(a), used.add(a)));

  if (search) for (const [i, s] of tl.entries()) {
    if (P[i].length) continue;
    onStatus?.(`BUSCANDO IMAGENS ${i + 1}/${tl.length}`);
    out: for (const kw of keywords(s.text, 3)) {
      for (const r of (await searchImages(kw).catch(() => [])).slice(0, 4)) {
        if (assets.some(x => x.src === r.src && used.has(x))) continue;
        try { const a = await addAsset({ ...r, tag: kw, origin: 'search' }); P[i].push(a); used.add(a); break out; } catch { }
      }
    }
  }

  const free = assets.filter(a => !used.has(a) && a.origin !== 'search'), E = tl.map((_, i) => i).filter(i => !P[i].length);
  if (!free.length) return P;
  let M = null;
  if (clip) try { onStatus?.('CLIP: ANALISANDO IMAGENS'); M = await clipMatrix(tl.map(s => s.text), free.map(a => a.img)); } catch (e) { console.warn('CLIP indisponível', e); }
  const left = new Set(free);
  // 1) cenas vazias recebem a melhor imagem livre
  for (const i of E) {
    if (!left.size) break;
    const a = M ? [...left].sort((x, y) => M[i][free.indexOf(y)] - M[i][free.indexOf(x)])[0] : [...left][0];
    P[i].push(a); left.delete(a);
  }
  // 2) sobras: melhor cena (CLIP) ou rodízio
  [...left].forEach((a, k) => {
    const j = free.indexOf(a), i = M ? M.reduce((b, r, q) => r[j] > M[b][j] ? q : b, 0) : (E.length ? E[k % E.length] : k % tl.length);
    P[i].push(a);
  });
  // 3) cenas ainda vazias reaproveitam imagens (rodízio)
  if (E.length > free.length) E.forEach((i, k) => P[i].length || P[i].push(free[k % free.length]));
  return P;
}

// segmentos de tempo por imagem
export function segments(tl, P, dur) {
  return tl.flatMap((s, i) => {
    const a = Math.max(0, s.start - .35), b = (tl[i + 1]?.start ?? dur + .35) - .35, n = P[i].length, d = (b - a) / n;
    return P[i].map((x, k) => ({ img: x.img, credit: x.credit, a: a + k * d, b: a + (k + 1) * d, seed: hash(s.text) + k * 7919 }));
  });
}
