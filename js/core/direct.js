import { prepare } from '../render/layouts.js';
import { keywords } from './keywords.js';
import { hash, rng } from './script.js';
import { norm } from './words.js';

export const INTRO = 2.8, OUTRO = 4.5;

// monta a edição: segmentos (cortes), títulos cinéticos, intro e outro
export function direct(tl, P, { variation = 0, ov = [], title = '', credits = [] }) {
  const end = tl.at(-1).end, dur = end + OUTRO, segs = [];
  tl.forEach((s, i) => {
    const o = ov[i] || {}, imgs = o.img ? [o.img] : P[i];
    if (!imgs.length) return;
    const a = Math.max(INTRO - .35, s.start - .35), b = (tl[i + 1]?.start ?? dur) - .35, n = Math.max(imgs.length, Math.round((b - a) / 4));
    const cuts = [a];
    for (let k = 1; k < n; k++) {
      const id = a + (b - a) * k / n, w = s.words.map(x => x.s).filter(x => x > cuts.at(-1) + 1.2 && x < b - 1.2).sort((x, y) => Math.abs(x - id) - Math.abs(y - id))[0];
      cuts.push(w ?? id);
    }
    cuts.push(b);
    for (let k = 0; k < n; k++) {
      const im = imgs[k % imgs.length];
      segs.push({ img: im.img, credit: im.credit, a: cuts[k], b: cuts[k + 1], seed: hash(s.text) + k * 7919 + variation * 104729, scene: i, layout: o.layout, trans: o.trans });
    }
  });
  prepare(segs);
  const R = rng(hash(tl[0].text) + variation * 31 + 7);
  const kin = tl.flatMap((s, i) => {
    const w = keywords(s.text, 1)[0];
    if (!w || (i && R() < .35)) return [];
    const at = s.words.find(x => norm(x.w).startsWith(norm(w).slice(0, 5)))?.s ?? s.start;
    return [{ text: w.toUpperCase(), a: at - .1, b: Math.min(at + 1.9, s.end + .4) }];
  });
  return {
    segs, kin, duration: dur,
    intro: { title: (title || keywords(tl[0].text, 2).join(' ')).toUpperCase(), b: INTRO + .2, code: hash(tl.map(s => s.text).join()) },
    outro: { a: end + .5, b: dur, credits: [...new Set(['Voz: eSpeak (meSpeak.js) · GPL', ...credits, ...segs.map(s => s.credit).filter(Boolean)])] }
  };
}
