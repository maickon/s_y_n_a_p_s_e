// Entidades do roteiro (pessoas, lugares, obras, objetos) ligadas à Wikipedia + contexto entre cenas
import { keywords } from './keywords.js';
import { norm } from './words.js';

const API = l => `https://${l}.wikipedia.org/w/api.php?action=query&format=json&origin=*&`;
const get = u => fetch(u).then(r => r.ok ? r.json() : Promise.reject(r.status));
const CONN = new Set('de da do das dos e del van von di du la le'.split(' '));
const STOP = new Set('a o as os um uma e de da do em no na para por com que se ele ela eles elas isso este esta esse essa mas quando onde como hoje ontem durante depois antes então porém também ainda nunca sempre muito cada todo toda'.split(' '));
// pronomes/retomadas: pessoa ("ele", "o cientista") ou lugar ("lá", "a cidade")
const P_PES = /(^|\s)(ele|ela|eles|elas|dele|dela|deles|delas|seu|sua|seus|suas|o cientista|a cientista|o artista|o autor|a autora|o inventor|o pintor|o escritor|o rei|a rainha|o presidente|o jogador|o cantor|a cantora)(?=[\s,.;!?]|$)/i;
const P_LUG = /(^|\s)(lá|ali|nele|nela|neste local|o local|a cidade|o lugar|o país|a região|o monumento|a construção|o templo|o castelo)(?=[\s,.;!?]|$)/i;
const PERSON = /^(físic[oa]|cientista|ator|atriz|cantor|cantora|escritor|escritora|polític[oa]|jogador|futebolista|pintor|pintora|rei|rainha|president|músic[oa]|filósof[oa]|inventor|matemátic[oa]|empresári[oa]|imperador|imperatriz|general|papa|compositor|poeta|poetisa|explorador|astronauta|engenheir[oa]|médic[oa]|arquitet[oa]|químic[oa]|biólog[oa]|astrônom[oa]|historiador|militar|santo|santa|youtuber|apresentador|apresentadora|advogad[oa]|economista|psicólog[oa]|sociólog[oa]|teólog[oa]|religios[oa]|ativista|aviador|navegador|faraó|monarca|nobre|líder)\b/i; // descrição da Wikipedia começa pela profissão
const tk = s => (s || '').split(/[\s\-–—,.;:!?()"'«»]+/).map(norm).filter(w => w.length > 2 && !CONN.has(w) && !STOP.has(w));
const stem = w => w.slice(0, 5);
// todas as palavras do título aparecem no texto (tolerante a plural/flexão)
const inText = (title, txt) => { const T = tk(title.replace(/\s*\(.*\)$/, '')), S = new Set(tk(txt).map(stem)); return T.length > 0 && T.every(w => S.has(stem(w))); };

// nomes próprios: sequências capitalizadas (aceita conectivos: "Rio de Janeiro", "Leonardo da Vinci")
export function names(text) {
  const out = [], ws = text.split(/\s+/);
  for (let i = 0; i < ws.length; i++) {
    const clean = w => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!/^\p{Lu}/u.test(clean(ws[i]))) continue;
    const start = i === 0 || /[.!?:]$/.test(ws[i - 1]), seq = [clean(ws[i])];
    let j = i + 1;
    while (j < ws.length && !/[.!?,;:]$/.test(ws[j - 1])) {
      const w = clean(ws[j]);
      if (/^\p{Lu}/u.test(w)) { seq.push(w); j++; }
      else if (CONN.has(w.toLowerCase()) && j + 1 < ws.length && /^\p{Lu}/u.test(clean(ws[j + 1]))) { seq.push(w); j++; }
      else break;
    }
    const n = seq.join(' ');
    if (!(start && seq.length === 1 && STOP.has(n.toLowerCase()))) out.push({ n, multi: seq.length > 1, start });
    i = j - 1;
  }
  return out;
}

const CACHE = new Map();
const memo = (k, f) => CACHE.get(k) || (CACHE.set(k, f().catch(() => null)), CACHE.get(k));
// detalhes de vários títulos de uma vez: título canônico, descrição, imagem principal, título em inglês
async function details(titles, lang) {
  if (!titles.length) return {};
  const d = await get(API(lang) + `redirects=1&prop=pageimages|description|pageprops|langlinks&piprop=original&lllang=en&lllimit=50&titles=${encodeURIComponent(titles.join('|'))}`);
  const map = {}, alias = t => [...(d.query?.normalized || []), ...(d.query?.redirects || [])].reduce((a, r) => r.from === a ? r.to : a, t);
  const pages = Object.values(d.query?.pages || {});
  for (const t of titles) {
    const p = pages.find(x => x.title === alias(t));
    if (p && !('missing' in p) && !('disambiguation' in (p.pageprops || {}))) map[t] = { title: p.title, desc: p.description || '', img: p.original?.source, w: p.original?.width, h: p.original?.height, en: p.langlinks?.[0]?.['*'] || '' };
  }
  return map;
}
const search = (q, lang) => memo(`s:${lang}:${q}`, () => get(API(lang) + `list=search&srlimit=4&srprop=&srsearch=${encodeURIComponent(q)}`).then(d => (d.query?.search || []).map(x => x.title)));

// por cena: { entity (citada na cena), ctx (assunto herdado), kw (palavras-chave) }
export async function analyze(tl, { lang = 'pt', title = '' } = {}) {
  const texts = tl.map(s => s.text), N = texts.map(names);
  // 1) nomes próprios -> Wikipedia (em lote)
  const cand = [...new Set([...N.flat().map(x => x.n), ...names(title).map(x => x.n)])];
  const D = {};
  for (let i = 0; i < cand.length; i += 40) Object.assign(D, await memo(`d:${lang}:${cand.slice(i, i + 40).join('|')}`, () => details(cand.slice(i, i + 40), lang)) || {});
  // nomes compostos sem página exata: busca e aceita se o título bate com o nome
  await Promise.all(cand.filter(n => !D[n] && n.includes(' ')).map(async n => {
    const t = (await search(n, lang) || []).find(t => inText(n, t) || inText(t, n));
    if (t) Object.assign(D, { [n]: (await memo(`d:${lang}:${t}`, () => details([t], lang)) || {})[t] });
  }));
  // 2) cenas sem nome próprio: busca pelas palavras-chave e aceita artigo cujo título está no texto ("pirâmides de gizé", "vulcão")
  const kw = texts.map(t => keywords(t, 3));
  const found = await Promise.all(texts.map(async (t, i) => {
    // sobrenome/nome solto ("Einstein") -> entidade completa já encontrada ("Albert Einstein")
    const full = n => D[n] || Object.values(D).find(e => e && tk(e.title).includes(norm(n)) && n.length > 3);
    const own = N[i].map(x => full(x.n) && { ...full(x.n), multi: x.multi || !D[x.n], start: x.start }).filter(Boolean).filter(e => e.multi || !e.start || e.img);
    if (own.length) return own.sort((a, b) => b.multi - a.multi)[0];
    if (!kw[i].length) return null;
    const hit = (await search(kw[i].join(' '), lang) || []).find(x => inText(x, t));
    return hit ? (await memo(`d:${lang}:${hit}`, () => details([hit], lang)) || {})[hit] || null : null;
  }));
  // 3) assunto principal: entidade do título ou a mais citada no roteiro
  const cnt = {};
  found.forEach(e => e && (cnt[e.title] = (cnt[e.title] || 0) + 1));
  const tEnt = names(title).map(x => D[x.n]).find(Boolean);
  const main = tEnt || Object.values(Object.fromEntries(found.filter(Boolean).map(e => [e.title, e]))).sort((a, b) => cnt[b.title] - cnt[a.title])[0];
  const mainOk = main && (tEnt || cnt[main.title] >= Math.max(2, tl.length * .25));
  // 4) contexto: cena sem entidade herda pela retomada (pessoa/lugar), senão o assunto principal
  const isP = e => e && PERSON.test(e.desc || '');
  let last = null, lastP = isP(main) ? main : null, lastL = null;
  return found.map((e, i) => {
    const t = texts[i], ctx = e ? null : P_PES.test(t) ? lastP || main || last : P_LUG.test(t) ? lastL || last : mainOk ? main : last;
    if (e) { last = e; isP(e) ? lastP = e : lastL = e; }
    return { entity: e, ctx, kw: kw[i] };
  });
}

// texto da busca: entidade > contexto + palavras-chave > palavras-chave
export const queryOf = a => a.entity ? a.entity.title.replace(/\s*\(.*\)$/, '') : [a.ctx?.title.replace(/\s*\(.*\)$/, ''), ...a.kw.slice(0, 2)].filter(Boolean).join(' ');
