import { rng } from '../core/script.js';
import { N, tone, burst } from './synth.js';

// perfis de trilha procedural
const STY = [
  { bpm: 84, root: 45, sc: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 6], drums: 'lofi', arp: 'square', pad: 'sawtooth', lp: 1100, bass: 'triangle' },     // vaporwave lo-fi
  { bpm: 58, root: 38, sc: [0, 1, 3, 5, 7, 8, 10], prog: [0, 1, 0, 6], pad: 'sawtooth', lp: 500, bass: 'sine', bassLong: 1 },                            // drone cósmico
  { bpm: 124, root: 42, sc: [0, 2, 3, 5, 7, 8, 11], prog: [0, 0, 5, 4], drums: 'techno', arp: 'square', pad: 'sawtooth', lp: 1100, bass: 'sawtooth' }, // techno
  { bpm: 68, root: 50, sc: [0, 2, 4, 7, 9], prog: [0, 3, 1, 4], arp: 'square', pad: 'sawtooth', lp: 1100, bass: 'triangle' },                          // liminar
  { bpm: 66, root: 43, sc: [0, 2, 3, 5, 7, 8, 11], prog: [0, 3, 4, 0], arp: 'triangle', sparse: 1, pad: 'triangle', lp: 700, bass: 'sine', bassLong: 1 }, // noir (piano)
  { bpm: 72, root: 48, sc: [0, 2, 4, 6, 7, 9, 11], prog: [0, 4, 5, 3], arp: 'sine', sparse: 1, pad: 'triangle', lp: 1500, bass: 'sine' },              // documental/arquivo
  { bpm: 88, root: 41, sc: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6], drums: 'taiko', arp: 'triangle', sparse: 1, pad: 'sawtooth', lp: 900, bass: 'sine', bassLong: 1 }, // cinemático
  { bpm: 108, root: 45, sc: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4], drums: 'synth', arp: 'sawtooth', pad: 'sawtooth', lp: 1800, bass: 'sawtooth', bass8: 1 } // synthwave
];

// duração de um loop musical (compassos inteiros, ≥ 40 s)
export const loopLen = prof => { const bpm = (STY[prof] || STY[0]).bpm, bar = 240 / bpm; return Math.max(16, Math.ceil(40 / bar / 4) * 4) * bar; };

export function music(ctx, out, dur, prof, seed) {
  const S = STY[prof] || STY[0], r = rng(seed), bt = 60 / S.bpm, bar = bt * 4, L = S.sc.length;
  const chord = d => [0, 2, 4].map(i => S.root + S.sc[(d + i) % L] + 12 * Math.floor((d + i) / L));
  const dl = new DelayNode(ctx, { delayTime: bt * .75 }), fb = new GainNode(ctx, { gain: .38 }), send = new GainNode(ctx, { gain: .35 });
  send.connect(dl).connect(fb).connect(dl); dl.connect(out);
  for (let b = 0, t = 0; t < dur; b++, t += bar) {
    const ch = chord(S.prog[b % S.prog.length]);
    ch.forEach(m => [-1, 1].forEach(p => tone(ctx, out, { type: S.pad, f: N(m), t, len: bar, vol: S.pad === 'sawtooth' ? .035 : .05, a: bar * .3, s: .9, d: 1, r: bar * .25, detune: p * 9, lp: S.lp, pan: p * .6 })));
    const steps = S.bass8 ? 8 : 4;
    for (let i = 0; i < steps; i++) if (!S.bassLong || !i) tone(ctx, out, { type: S.bass, f: N(ch[0] - 12), t: t + i * bar / steps, len: S.bassLong ? bar : bar / steps * .85, vol: .16, s: .7, d: .3, r: .1, lp: 420 });
    if (S.arp && b) for (let i = 0; i < 8; i++) if (r() > (S.sparse ? .6 : .35)) {
      const f = N(ch[r() * 3 | 0] + 12 * (1 + (r() > .6))), at = t + i * bt / 2, len = S.sparse ? .9 : .15;
      tone(ctx, out, { type: S.arp, f, t: at, len, vol: S.arp === 'square' || S.arp === 'sawtooth' ? .035 : .06, d: len, lp: 2600, pan: r() - .5 });
      tone(ctx, send, { type: S.arp, f, t: at, len, vol: .02, d: len, lp: 2000 });
    }
    if (S.drums && b) for (let i = 0; i < 4; i++) {
      const x = t + i * bt, D = S.drums;
      if (D === 'techno' || D === 'synth' || i % 2 === 0 && D !== 'taiko') kick(ctx, out, x);
      if (D === 'lofi' && i === 2) kick(ctx, out, x + bt / 2);
      if (D === 'taiko') { if (i === 0 || i === 2 && b % 2) taiko(ctx, out, x, i ? .5 : .8); continue; }
      if (i % 2) burst(ctx, out, { t: x, len: D === 'synth' ? .3 : .16, vol: D === 'synth' ? .3 : .22, type: 'highpass', f: D === 'synth' ? 900 : 1500 });
      burst(ctx, out, { t: x + bt / 2, len: .04, vol: .1, type: 'highpass', f: 7000 });
      if (D === 'techno') burst(ctx, out, { t: x, len: .03, vol: .06, type: 'highpass', f: 9000 });
    }
  }
  tone(ctx, out, { f: N(S.root - 24), t: 0, len: dur, vol: .12, a: .05, s: 1, d: 1, r: .05 }); // contínuo no loop
}

function kick(ctx, out, t) { const o = tone(ctx, out, { f: 150, t, len: .4, vol: .6, d: .35 }); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); }
function taiko(ctx, out, t, v) { const o = tone(ctx, out, { f: 110, t, len: .9, vol: v, d: .8 }); o.frequency.exponentialRampToValueAtTime(55, t + .25); burst(ctx, out, { t, len: .12, vol: .25 * v, type: 'lowpass', f: 700 }); }
