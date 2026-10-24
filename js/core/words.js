export const norm = w => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const syl = w => Math.max(1, (norm(w).match(/[aeiouy]+/g) || []).length) + (/[,;:—-]$/.test(w) ? .8 : 0);

// centros de pausas (>=30ms) no trecho [a,b]
function silences(d, sr, a, b) {
  const F = Math.round(sr * .01), rms = [];
  for (let i = Math.floor(a * sr); i + F <= b * sr; i += F) { let s = 0; for (let j = i; j < i + F; j++) s += d[j] * d[j]; rms.push(Math.sqrt(s / F)); }
  const th = rms.reduce((m, v) => Math.max(m, v), 0) * .06, g = [];
  let run = 0;
  rms.forEach((v, k) => { if (v < th) run++; else { if (run >= 3) g.push(a + (k - run / 2) * .01); run = 0; } });
  return g;
}

// tempos estimados: peso silábico + encaixe nas pausas reais
export function estimate(sc, d, sr) {
  const ws = sc.text.split(/\s+/).filter(Boolean), wt = ws.map(syl), T = wt.reduce((a, b) => a + b, 0), D = sc.end - sc.start;
  const gaps = silences(d, sr, sc.start, sc.end), tol = D / T * .6;
  let c = 0, prev = sc.start;
  const b = wt.slice(0, -1).map(x => {
    const t = sc.start + D * (c += x) / T, n = gaps.reduce((a, g) => Math.abs(g - t) < Math.abs(a - t) ? g : a, Infinity);
    return prev = Math.max(prev + .04, Math.abs(n - t) < tol ? n : t);
  });
  const ed = [sc.start, ...b, sc.end];
  return ws.map((w, i) => ({ w, s: ed[i], e: ed[i + 1] }));
}

const lev = (a, b) => {
  const r = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) { let p = r[0]; r[0] = i; for (let j = 1; j <= b.length; j++) { const t = r[j]; r[j] = Math.min(r[j] + 1, r[j - 1] + 1, p + (a[i - 1] !== b[j - 1])); p = t; } }
  return 1 - r[b.length] / Math.max(a.length, b.length, 1);
};

// alinha palavras do roteiro (com estimativa) às palavras do ASR (Needleman-Wunsch)
export function align(scenes, asr) {
  const W = scenes.flatMap((sc, k) => sc.words.map(x => ({ ...x, k }))), S = W.map(x => norm(x.w)), A = asr.map(x => norm(x.w));
  const n = S.length, m = A.length, M = m + 1, F = new Float64Array((n + 1) * M), G = -.4;
  const sc = (i, j) => { const s = lev(S[i], A[j]); return s > .5 ? s * 2 - 1 : -1; };
  for (let i = 0; i <= n; i++) F[i * M] = i * G;
  for (let j = 0; j <= m; j++) F[j] = j * G;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
    F[i * M + j] = Math.max(F[(i - 1) * M + j - 1] + sc(i - 1, j - 1), F[(i - 1) * M + j] + G, F[i * M + j - 1] + G);
  const hit = new Array(n);
  for (let i = n, j = m; i > 0 && j > 0;) {
    if (F[i * M + j] === F[(i - 1) * M + j - 1] + sc(i - 1, j - 1) && sc(i - 1, j - 1) > 0) hit[--i] = asr[--j];
    else if (F[i * M + j] === F[(i - 1) * M + j] + G) i--; else j--;
  }
  return scenes.map((s, k) => {
    const idx = W.map((x, i) => i).filter(i => W[i].k === k), ok = idx.filter(i => hit[i]);
    if (ok.length < idx.length * .4) return s; // ASR pouco confiável: mantém estimativa
    const ws = idx.map(i => ({ ...s.words[i - idx[0]], ...(hit[i] && { s: Math.max(s.start, hit[i].s), e: Math.min(s.end, hit[i].e) }) }));
    // palavras sem par: interpolação entre âncoras
    for (let i = 0; i < ws.length;) {
      if (hit[idx[i]]) { i++; continue; }
      let j = i; while (j < ws.length && !hit[idx[j]]) j++;
      const a = i ? ws[i - 1].e : s.start, b = j < ws.length ? ws[j].s : s.end, st = (b - a) / (j - i);
      for (let q = i; q < j; q++) Object.assign(ws[q], { s: a + st * (q - i), e: a + st * (q - i + 1) });
      i = j;
    }
    ws.forEach((w, i) => { if (i) w.s = Math.max(w.s, ws[i - 1].s + .02); w.e = Math.max(w.e, w.s + .05); });
    return { ...s, words: ws, ai: true };
  });
}

// agrupa palavras em blocos de legenda
export function groups(scenes, max = 30) {
  const out = [];
  for (const sc of scenes) {
    let g = null;
    for (const w of sc.words) {
      if (!g || (g.txt + ' ' + w.w).length > max || /[.,;:!?]$/.test(g.words.at(-1).w) && g.txt.length > max / 2) out.push(g = { words: [], txt: '' });
      g.words.push(w); g.txt = g.txt ? g.txt + ' ' + w.w : w.w;
    }
  }
  out.forEach((g, i) => { g.s = g.words[0].s; g.e = Math.min(g.words.at(-1).e + .4, out[i + 1]?.words[0].s ?? Infinity); });
  return out;
}

const ts = t => new Date(t * 1e3).toISOString().slice(11, 23).replace('.', ',');
export const toSRT = gs => gs.map((g, i) => `${i + 1}\n${ts(g.s)} --> ${ts(g.e)}\n${g.txt}\n`).join('\n');
