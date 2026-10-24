import { loadImage } from '../media/loader.js';
import { searchImages } from '../media/search.js';
import { keywords } from './keywords.js';
import { norm } from './words.js';
import { clipMatrix } from '../ai/clip.js';

export const assets = []; // {id, src, img, tag, credit, origin}

export async function addAsset({ src, tag = '', credit = '', origin = 'url', id }) {
  const a = assets.find(x => x.src === src);
  if (a) return a;
  const n = { id: id || Math.random().toString(36).slice(2), src, img: await loadImage(src), tag, credit, origin };
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
// assunto geral: palavras-chave mais frequentes no roteiro
export function topicOf(tl) {
  const c = {};
  tl.forEach(s => keywords(s.text, 4).forEach(k => { const n = norm(k).slice(0, 6); c[n] = c[n] || [k, 0]; c[n][1]++; }));
  return Object.values(c).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, 2).map(x => x[0]).join(' ');
}
export const autoQuery = text => keywords(text, 2).join(' ');
export const CANDS = {}; // candidatas por cena: { q, list }

// busca e devolve candidatas ranqueadas para uma cena (com cache)
export async function searchScene(i, q, topic, ar) {
  if (CANDS[i]?.q === q) return CANDS[i].list;
  let list = await searchImages({ q, topic }, ar).catch(() => []);
  if (!list.length && q.includes(' ')) list = await searchImages({ q: q.split(' ')[0], topic }, ar).catch(() => []);
  CANDS[i] = { q, list }; return list;
}

export async function plan(tl, { search, clip, onStatus, ar = 16 / 9, queries = [] }) {
  const P = tl.map(() => []), used = new Set(), topic = topicOf(tl);
  for (const a of assets) if (a.tag && a.origin !== 'search') tl.forEach((s, i) => hit(a.tag, s.text) && (P[i].push(a), used.add(a)));

  // busca todas as cenas em paralelo; a escolha (sem repetir imagem) é sequencial
  if (search) { let k = 0; await Promise.all(tl.map((s, i) => !P[i].length && searchScene(i, queries[i] || autoQuery(s.text), topic, ar).finally(() => onStatus?.(`BUSCANDO IMAGENS ${++k}/${tl.length}`)))); }
  if (search) for (const [i, s] of tl.entries()) {
    if (P[i].length) continue;
    onStatus?.(`BUSCANDO IMAGENS ${i + 1}/${tl.length}`);
    const q = queries[i] || autoQuery(s.text);
    for (const r of (await searchScene(i, q, topic, ar)).slice(0, 5)) {
      if (assets.some(x => x.src === r.src && used.has(x))) continue;
      try { const a = await addAsset({ src: r.src, credit: r.credit, tag: q, origin: 'search' }); P[i].push(a); used.add(a); break; } catch { }
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
