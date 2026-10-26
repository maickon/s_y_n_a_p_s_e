// Estrutura de cinema: abertura sem narração (teaser), capítulos e respiros (pausas só com imagem e música)
import { splitScenes } from './script.js';
import { keywords } from './keywords.js';
import { norm } from './words.js';
import { hashKey } from '../audio/bufstore.js';
import { names } from './entities.js';

// padrões por tipo de vídeo
export const CINE_DEF = {
  doc: { on: true, teaser: 5, chap: 'auto', breath: 'med', music: true },
  mystery: { on: true, teaser: 6, chap: 'auto', breath: 'med', music: true },
  timeline: { on: true, teaser: 4, chap: 'marks', breath: 'low', music: true },
  top: { on: true, teaser: 3, chap: 'off', breath: 'low', music: false },
  sabia: { on: true, teaser: 3, chap: 'off', breath: 'low', music: false },
  news: { on: false, teaser: 0, chap: 'off', breath: 'none', music: false },
  steps: { on: false, teaser: 0, chap: 'off', breath: 'none', music: false }
};
const CHAP = /^(?:##\s*(.+)|cap[ií]tulo\s*[\divxlc]*\s*[:.\-–]\s*(.+)|parte\s*[\divxlc]+\s*[:.\-–]\s*(.+))$/i;

// lê o roteiro: falas + marcadores de capítulo ("## Título" / "Capítulo 2: Título") e parágrafos (linha em branco)
export function structure(text) {
  const lines = [], chapters = {}, paras = new Set(), starts = new Set();
  let chap = null, para = false;
  for (const raw of text.split('\n')) {
    const l = raw.trim();
    if (!l) { para = lines.length > 0; continue; }
    const m = l.match(CHAP);
    if (m) { chap = (m[1] || m[2] || m[3]).trim().replace(/[.:]$/, ''); continue; }
    const ss = splitScenes(l);
    if (!ss.length) continue;
    if (lines.length) starts.add(lines.length);
    if (chap != null) chapters[lines.length] = chap;
    else if (para) paras.add(lines.length);
    chap = null; para = false;
    lines.push(...ss);
  }
  return { lines, chapters, paras, starts };
}

// capítulos automáticos: cortes onde o assunto muda (menor sobreposição de palavras-chave), preferindo parágrafos
function autoChapters(texts, paras, starts = new Set()) {
  const n = texts.length; if (n < 8) return [];
  // 1º: quebras de parágrafo/linha que formam blocos de 3+ frases
  const blocks = [...new Set([...paras, ...starts])].filter(i => i >= 3 && i <= n - 3).sort((a, b) => a - b).filter((i, k, A) => i - (A[k - 1] ?? 0) >= 3);
  if (blocks.length) return blocks.slice(0, 6);
  const K = texts.map(t => new Set(keywords(t, 5).map(w => norm(w).slice(0, 5)))), W = 3;
  const sim = i => { const A = new Set(), B = new Set(); for (let k = Math.max(0, i - W); k < i; k++) K[k].forEach(x => A.add(x)); for (let k = i; k < Math.min(n, i + W); k++) K[k].forEach(x => B.add(x)); let c = 0; A.forEach(x => B.has(x) && c++); return c / (Math.min(A.size, B.size) || 1) - (paras.has(i) ? .5 : 0); };
  const want = Math.max(1, Math.min(5, Math.round(n / 7))), cand = [];
  for (let i = 4; i <= n - 4; i++) cand.push([i, sim(i)]);
  const out = [];
  for (const [i] of cand.sort((a, b) => a[1] - b[1])) { if (out.length >= want) break; if (out.every(j => Math.abs(j - i) >= 4)) out.push(i); }
  return out.sort((a, b) => a - b);
}

const cap1 = s => s.replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
// plano de pausas: [{ before (cena), kind: teaser|chapter|breath, dur, title, n }]
export function cinemaPlan(S, texts, cfg, ents = []) {
  if (!cfg.on || !texts.length) return [];
  const plan = [], n = texts.length;
  if (cfg.teaser >= 1) plan.push({ before: 0, kind: 'teaser', dur: +cfg.teaser });
  // capítulos: marcadores do roteiro, ou automáticos
  let ch = cfg.chap === 'off' ? [] : Object.keys(S.chapters).map(Number).filter(i => i > 0 && i < n);
  if (cfg.chap === 'auto' && !ch.length) ch = autoChapters(texts, S.paras, S.starts);
  const title = (a, b) => S.chapters[a] || (() => { // título: entidade mais citada no trecho, senão palavras-chave
    const c = {}; for (let k = a; k < b; k++) { const e = ents[k]?.entity?.title; if (e) c[e] = (c[e] || 0) + 1; }
    const e = Object.entries(c).sort((x, y) => y[1] - x[1])[0]?.[0];
    if (e) return e.replace(/\s*\(.*\)$/, '');
    const nm = names(texts[a])[0]?.n.replace(/^(A|O|As|Os|Um|Uma)\s+/, ''); // nome próprio da 1ª frase
    return nm || cap1(keywords(texts[a], 2).join(' '));
  })();
  const bounds = [0, ...ch, n];
  ch.forEach((i, k) => plan.push({ before: i, kind: 'chapter', dur: 4, n: k + 2, title: title(i, bounds[k + 2]) }));
  if (ch.length && S.chapters[0]) plan.push({ before: 0, kind: 'chapter', dur: 4, n: 1, title: S.chapters[0] });
  // respiros: parágrafos e intervalos regulares (longe de capítulos)
  const every = { low: 0, med: 6, high: 3 }[cfg.breath], used = new Set(plan.map(p => p.before));
  if (cfg.breath !== 'none') {
    const near = i => [...used].some(j => Math.abs(j - i) < 2);
    [...S.paras].filter(i => i > 0 && !near(i)).forEach(i => { plan.push({ before: i, kind: 'breath', dur: 2.4 }); used.add(i); });
    if (every) for (let i = every, last = 0; i < n - 1; i++) { if ([...used].some(j => j > last && j <= i)) last = Math.max(...[...used].filter(j => j <= i)); if (i - last >= every && !near(i)) { plan.push({ before: i, kind: 'breath', dur: 2.2 }); used.add(i); last = i; } }
  }
  return plan.sort((a, b) => a.before - b.before || (a.kind === 'teaser' ? -1 : 1));
}

// insere as pausas na trilha de voz (silêncio), deslocando cenas, palavras e áudio
export function withBreaks(base, plan) {
  if (!plan.length) return { ...base, breaks: [] };
  const tl0 = base.timeline, sr = base.buffer.sampleRate, cut = i => Math.max(0, Math.round((tl0[i].start - .05) * sr));
  const add = tl0.map((_, i) => plan.filter(p => p.before <= i).reduce((s, p) => s + p.dur, 0)), total = add.at(-1);
  const mv = b => {
    const o = new AudioBuffer({ length: b.length + Math.round(total * sr), sampleRate: sr, numberOfChannels: b.numberOfChannels });
    for (let c = 0; c < b.numberOfChannels; c++) {
      const s = b.getChannelData(c), d = o.getChannelData(c);
      for (let i = 0; i <= tl0.length; i++) { const a = i ? cut(i - 1) : 0, z = i < tl0.length ? cut(i) : s.length, off = Math.round((i ? add[i - 1] : 0) * sr); d.set(s.subarray(a, z), a + off); }
    }
    return o;
  };
  // obs.: o trecho [cut(i-1), cut(i)) pertence à cena i-1 e anda junto com ela
  const timeline = tl0.map((s, i) => ({ ...s, start: s.start + add[i], end: s.end + add[i], words: s.words.map(w => ({ ...w, s: w.s + add[i], e: w.e + add[i] })) }));
  const breaks = plan.map(p => { const before = plan.filter(q => q.before < p.before || (q.before === p.before && q !== p && plan.indexOf(q) < plan.indexOf(p))).reduce((s, q) => s + q.dur, 0), a = tl0[p.before].start - .05 + before; return { ...p, a, b: a + p.dur }; });
  return { ...base, buffer: mv(base.buffer), dry: mv(base.dry), timeline, duration: base.duration + total, breaks, key: hashKey(base.key + JSON.stringify(plan)) };
}

// sons das pausas (riser antes do capítulo, impacto no título, sopro nos respiros, passagem no fim do teaser)
export const breakEvents = B => B.flatMap(b => b.kind === 'chapter' ? [{ n: 'riser', t: Math.max(.05, b.a - 1.2), v: .55 }, { n: 'boom', t: b.a + .35, v: .7 }]
  : b.kind === 'breath' ? [{ n: 'whooshSoft', t: b.a + .1, v: .35 }] : [{ n: 'reverseSwell', t: Math.max(.05, b.b - 1.4), v: .6 }, { n: 'hit', t: b.b - .1, v: .6 }]);
// seções musicais [{t, k}]: teaser com trilha própria (k=0); cada capítulo troca a trilha (k=n)
export function musicSections(B, on) {
  if (!on) return [];
  const s = [{ t: 0, k: B.some(b => b.kind === 'teaser') ? 0 : 1 }];
  B.forEach(b => b.kind === 'teaser' ? s.push({ t: b.b - .8, k: 1 }) : b.kind === 'chapter' && b.n > 1 && s.push({ t: b.a, k: b.n }));
  return s.length > 1 ? s : [];
}
