// divide em cenas por frase/linha, sem quebrar em abreviações (a.C., Sr., Dr., etc.)
const ABBR = /\b(a\.C|d\.C|Sr|Sra|Dr|Dra|Prof|St|etc|n|nº|vol|cap|ex|p)\.$/i;
export const splitScenes = t => t.trim().split(/\n+/).flatMap(l => l.split(/(?<=[.!?…])\s+/).reduce((o, p) => (o.length && ABBR.test(o.at(-1)) ? o[o.length - 1] += ' ' + p : o.push(p), o), [])).map(s => s.trim()).filter(Boolean);

export function hash(s) {
  let h = 0;
  for (const c of s) h = (h << 5) - h + c.charCodeAt(0) | 0;
  return Math.abs(h);
}

// PRNG determinístico
export const rng = s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
