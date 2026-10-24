import { tone, burst } from './synth.js';

const whoosh = (c, o, t) => { burst(c, o, { t: t - .25, len: .7, vol: .35, f: 250, f2: 3500, Q: 2, a: .35 }); };
const glitch = (c, o, t) => { for (let i = 0; i < 4; i++) burst(c, o, { t: t + i * .055, len: .04, vol: .25, f: 800 + i * 900, Q: 6 }); tone(c, o, { type: 'square', f: 90, t, len: .12, vol: .08, d: .12 }); };
const shimmer = (c, o, t) => [2093, 2637, 3136].forEach((f, i) => tone(c, o, { f, t: t + i * .04, len: 1, vol: .025, d: 1, pan: (i - 1) * .5 }));
const impact = (c, o, t, v) => { const k = tone(c, o, { f: 90, t, len: 1.2, vol: .5 * v, d: 1.1 }); k.frequency.exponentialRampToValueAtTime(30, t + .8); burst(c, o, { t, len: .3, vol: .15 * v, type: 'lowpass', f: 900 }); };
const riser = (c, o, t, d) => { burst(c, o, { t, len: d, vol: .12, type: 'highpass', f: 200, f2: 6000, a: d * .9 }); const k = tone(c, o, { type: 'sawtooth', f: 110, t, len: d, vol: .03, a: d * .9, d: .1, lp: 2000 }); k.frequency.exponentialRampToValueAtTime(880, t + d); };

const BY = { glitch, pixel: glitch, zoom: whoosh, wipe: whoosh, slide: whoosh, fade: shimmer };

// efeitos sincronizados com cenas e transições
export function sfx(ctx, out, segs, timeline) {
  timeline.forEach((s, i) => { impact(ctx, out, Math.max(0, s.start - .05), i ? .6 : 1); if (i && i % 3 === 0) riser(ctx, out, Math.max(0, s.start - 1.1), 1); });
  segs.forEach(s => BY[s.trans]?.(ctx, out, Math.max(.3, s.a)));
}
