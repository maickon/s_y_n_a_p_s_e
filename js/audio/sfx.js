import { rng } from '../core/script.js';
import { tone, burst } from './synth.js';

// biblioteca de efeitos (c = ctx, o = saída, t = tempo, v = volume)
const LIB = {
  whooshSoft: (c, o, t, v) => burst(c, o, { t: t - .3, len: .7, vol: .3 * v, f: 300, f2: 2500, Q: 1.5, a: .35 }),
  whooshDeep: (c, o, t, v) => { burst(c, o, { t: t - .35, len: .8, vol: .4 * v, f: 150, f2: 1200, Q: 2, a: .4 }); tone(c, o, { f: 70, t: t - .1, len: .5, vol: .2 * v, d: .5 }); },
  swish: (c, o, t, v) => burst(c, o, { t: t - .12, len: .25, vol: .35 * v, f: 900, f2: 6000, Q: 2.5, a: .1 }),
  reverseSwell: (c, o, t, v) => burst(c, o, { t: t - .9, len: .9, vol: .25 * v, type: 'highpass', f: 2000, f2: 6000, a: .88 }),
  tapeRewind: (c, o, t, v) => { const k = tone(c, o, { type: 'sawtooth', f: 900, t: t - .4, len: .45, vol: .05 * v, d: .45, lp: 3000 }); k.frequency.exponentialRampToValueAtTime(80, t + .05); burst(c, o, { t: t - .4, len: .45, vol: .08 * v, f: 3000, Q: 2 }); },
  boom: (c, o, t, v) => { const k = tone(c, o, { f: 90, t, len: 1.2, vol: .5 * v, d: 1.1 }); k.frequency.exponentialRampToValueAtTime(30, t + .8); burst(c, o, { t, len: .3, vol: .15 * v, type: 'lowpass', f: 900 }); },
  hit: (c, o, t, v) => { LIB.boom(c, o, t, v); burst(c, o, { t, len: .5, vol: .25 * v, f: 1800, Q: .7 }); tone(c, o, { f: 180, t, len: 1, vol: .08 * v, d: 1 }); },
  clang: (c, o, t, v) => [523, 1307, 2093, 2960].forEach((f, i) => tone(c, o, { f, t, len: 1.4, vol: .05 * v / (i + 1), d: 1.4 - i * .2, pan: (i - 1.5) * .3 })),
  thud: (c, o, t, v) => { const k = tone(c, o, { f: 75, t, len: .35, vol: .5 * v, d: .3 }); k.frequency.exponentialRampToValueAtTime(40, t + .2); },
  zap: (c, o, t, v) => { const k = tone(c, o, { type: 'square', f: 2200, t, len: .18, vol: .06 * v, d: .18, lp: 5000 }); k.frequency.exponentialRampToValueAtTime(90, t + .17); },
  stutter: (c, o, t, v) => { for (let i = 0; i < 4; i++) burst(c, o, { t: t + i * .055, len: .04, vol: .22 * v, f: 800 + i * 900, Q: 6 }); tone(c, o, { type: 'square', f: 90, t, len: .12, vol: .08 * v, d: .12 }); },
  dataChirp: (c, o, t, v, r) => { for (let i = 0; i < 7; i++) tone(c, o, { type: 'square', f: 800 + r() * 2400, t: t + i * .035, len: .03, vol: .04 * v, d: .03, lp: 6000 }); },
  riser: (c, o, t, v) => { burst(c, o, { t: t - 1, len: 1, vol: .12 * v, type: 'highpass', f: 200, f2: 6000, a: .9 }); const k = tone(c, o, { type: 'sawtooth', f: 110, t: t - 1, len: 1, vol: .03 * v, a: .9, d: .1, lp: 2000 }); k.frequency.exponentialRampToValueAtTime(880, t); },
  tonalRiser: (c, o, t, v) => [0, 7, 12].forEach(s => { const k = tone(c, o, { f: 220 * 2 ** (s / 12), t: t - .7, len: .8, vol: .03 * v, a: .65, d: .2 }); k.frequency.exponentialRampToValueAtTime(440 * 2 ** (s / 12), t); }),
  shutter: (c, o, t, v) => { burst(c, o, { t, len: .015, vol: .4 * v, type: 'highpass', f: 2000 }); burst(c, o, { t: t + .07, len: .02, vol: .3 * v, type: 'highpass', f: 1500 }); },
  projector: (c, o, t, v) => { for (let i = 0; i < 8; i++) burst(c, o, { t: t - .2 + i / 24, len: .01, vol: .15 * v, f: 2200, Q: 3 }); },
  flashPop: (c, o, t, v) => { burst(c, o, { t, len: .25, vol: .3 * v, type: 'highpass', f: 3000 }); tone(c, o, { f: 1800, t, len: .3, vol: .04 * v, d: .3 }); },
  shimmer: (c, o, t, v) => [2093, 2637, 3136].forEach((f, i) => tone(c, o, { f, t: t + i * .04, len: 1, vol: .025 * v, d: 1, pan: (i - 1) * .5 })),
  chimes: (c, o, t, v, r) => [0, 4, 7, 11].forEach((s, i) => tone(c, o, { f: 1046 * 2 ** (s / 12), t: t + i * .09, len: 1.6, vol: .03 * v, d: 1.6, pan: r() - .5 })),
  pianoStab: (c, o, t, v) => [57, 60, 64, 69].forEach(m => tone(c, o, { type: 'triangle', f: 440 * 2 ** ((m - 69) / 12), t, len: 1.5, vol: .05 * v, d: 1.5, lp: 3000 })),
  crackle: (c, o, t, v, r) => { burst(c, o, { t: t - .2, len: .8, vol: .1 * v, type: 'lowpass', f: 1200, a: .3 }); for (let i = 0; i < 25; i++) burst(c, o, { t: t - .2 + r() * .8, len: .006, vol: .25 * v * r(), type: 'highpass', f: 1500 }); },
  swell: (c, o, t, v) => burst(c, o, { t: t - .4, len: .9, vol: .18 * v, type: 'lowpass', f: 400, f2: 1600, a: .45 }),
  heartbeat: (c, o, t, v) => [0, .22].forEach(d => LIB.thud(c, o, t + d, v * (d ? .6 : 1))),
  soft: (c, o, t, v) => tone(c, o, { f: 220, t, len: .8, vol: .05 * v, d: .8, lp: 800 })
};
export const SFX_NAMES = Object.keys(LIB);

// som por transição (variações escolhidas pela seed)
const BY = {
  fade: ['shimmer', 'swell', 'chimes'], dissolve: ['swell', 'shimmer', 'soft'], dipblack: ['swell', 'boom', 'heartbeat'], dipwhite: ['flashPop', 'swell'], flash: ['flashPop', 'shutter'],
  lightleak: ['shimmer', 'reverseSwell'], burn: ['crackle', 'reverseSwell'], blur: ['swell', 'whooshSoft'], zoom: ['whooshDeep', 'reverseSwell'], whip: ['swish', 'whooshDeep'],
  push: ['whooshDeep', 'thud'], slide: ['swish', 'whooshSoft'], wipe: ['whooshSoft', 'swish'], iris: ['tonalRiser', 'shimmer'], barn: ['clang', 'whooshSoft'],
  blinds: ['projector', 'shutter'], glitch: ['stutter', 'zap', 'dataChirp'], rgb: ['zap', 'stutter'], pixel: ['dataChirp', 'stutter'], warp: ['tapeRewind', 'reverseSwell'], shake: ['hit', 'thud']
};
// pacotes: impacto da troca de cena + filtro de agressividade
export const PACKS = {
  cinematic: { n: 'Cinemático', hit: ['boom', 'hit', 'pianoStab'], v: 1 },
  digital: { n: 'Digital', hit: ['zap', 'boom', 'dataChirp'], v: 1, add: 'dataChirp' },
  organic: { n: 'Orgânico', hit: ['thud', 'chimes', 'soft'], v: .8, soften: 1 },
  subtle: { n: 'Sutil', hit: ['soft', 'swell'], v: .5, soften: 1 }
};
const HARSH = new Set(['zap', 'stutter', 'dataChirp', 'clang', 'hit', 'crackle', 'tapeRewind']);

// lista de eventos sonoros { n: nome, t: tempo, v: volume } — renderizados como clipes curtos e cacheados
export function sfxEvents(segs, timeline, pack = 'cinematic', seed = 1) {
  const P = PACKS[pack] || PACKS.cinematic, E = [], add = (n, t, v = 1) => E.push({ n: P.soften && HARSH.has(n) ? 'swell' : n, t: Math.max(.05, t), v: +(v * P.v).toFixed(2) });
  timeline.forEach((s, i) => { add(P.hit[(seed + i) % P.hit.length], s.start - .05, i ? .6 : 1); if (i && i % 3 === 0) add('riser', s.start - .1, .8); });
  segs.forEach(s => { const l = BY[s.trans] || BY.fade; add(l[s.seed % l.length], s.a + .3); if (P.add && s.trans === 'glitch') add(P.add, s.a + .35, .6); });
  return E;
}
export function stingEvents(kind, d) {
  const hit = d * .45, E = [], P = (n, t, v = 1) => E.push({ n, t: Math.max(.02, t), v });
  if (kind === 'cinematic') { P('riser', hit, .9); P('hit', hit); P('pianoStab', hit, .8); P('swell', d * .9, .5); }
  else if (kind === 'digital') { P('dataChirp', .15, .8); P('stutter', .35); P('zap', hit); P('boom', hit, .8); P('dataChirp', hit + .3, .5); }
  else if (kind === 'ethereal') { P('shimmer', .1); P('tonalRiser', hit); P('chimes', hit); P('swell', hit + .2, .6); }
  else if (kind === 'impact') { P('heartbeat', .2); P('whooshDeep', hit - .05); P('hit', hit); P('boom', hit + .02, .7); }
  return E;
}
const CLIPS = new Map(), PRE = 1.2, LEN = 4.2;
async function clip(n, v) {
  const k = n + v;
  if (!CLIPS.has(k)) {
    const c = new OfflineAudioContext(2, Math.ceil(LEN * 44100), 44100);
    LIB[n](c, c.destination, PRE, v, rng(n.length * 7 + 1));
    CLIPS.set(k, c.startRendering());
  }
  return CLIPS.get(k);
}
// posiciona os clipes na linha do tempo (soma direta)
export async function renderEvents(E, D) {
  const out = new AudioBuffer({ length: Math.ceil(D * 44100), sampleRate: 44100, numberOfChannels: 2 });
  for (const e of E) {
    const b = await clip(e.n, e.v), o = Math.round((e.t - PRE) * 44100);
    for (let c = 0; c < 2; c++) { const d = out.getChannelData(c), s = b.getChannelData(c); for (let j = Math.max(0, -o); j < s.length && o + j < d.length; j++) d[o + j] += s[j]; }
  }
  return out;
}

export function sfx(ctx, out, segs, timeline, pack = 'cinematic', seed = 1) {
  const P = PACKS[pack] || PACKS.cinematic, r = rng(seed + 7), play = (n, t, v = 1) => LIB[P.soften && HARSH.has(n) ? 'swell' : n](ctx, out, Math.max(.05, t), v * P.v, r);
  timeline.forEach((s, i) => { play(P.hit[(seed + i) % P.hit.length], s.start - .05, i ? .6 : 1); if (i && i % 3 === 0) play('riser', s.start - .1, .8); });
  segs.forEach(s => { const l = BY[s.trans] || BY.fade; play(l[s.seed % l.length], s.a + .3); if (P.add && s.trans === 'glitch') play(P.add, s.a + .35, .6); });
}

// assinatura sonora da vinheta de abertura
export function sting(ctx, out, kind, d, seed = 1) {
  const r = rng(seed), hit = d * .45, P = (n, t, v = 1) => LIB[n](ctx, out, Math.max(.02, t), v, r);
  if (kind === 'cinematic') { P('riser', hit, .9); P('hit', hit); P('pianoStab', hit, .8); P('swell', d * .9, .5); }
  else if (kind === 'digital') { P('dataChirp', .15, .8); P('stutter', .35); P('zap', hit); P('boom', hit, .8); P('dataChirp', hit + .3, .5); }
  else if (kind === 'ethereal') { P('shimmer', .1); P('tonalRiser', hit); P('chimes', hit); P('swell', hit + .2, .6); }
  else if (kind === 'impact') { P('heartbeat', .2); P('whooshDeep', hit - .05); P('hit', hit); P('boom', hit + .02, .7); }
}
