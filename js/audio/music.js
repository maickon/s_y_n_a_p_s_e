import { rng } from '../core/script.js';
import { N, tone, burst } from './synth.js';

// trilha procedural por estilo
const STY = [
  { bpm: 84, root: 45, sc: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 6], drums: 'lofi', arp: 1 },     // Sonho Analógico
  { bpm: 58, root: 38, sc: [0, 1, 3, 5, 7, 8, 10], prog: [0, 1, 0, 6], drums: 0, arp: 0 },          // Abismo Cósmico
  { bpm: 124, root: 42, sc: [0, 2, 3, 5, 7, 8, 11], prog: [0, 0, 5, 4], drums: 'techno', arp: 1 },  // Entropia Digital
  { bpm: 68, root: 50, sc: [0, 2, 4, 7, 9], prog: [0, 3, 1, 4], drums: 0, arp: 1 }                  // Câmara Liminar
];

export function music(ctx, out, dur, style, seed) {
  const S = STY[style], r = rng(seed), bt = 60 / S.bpm, bar = bt * 4, L = S.sc.length;
  const chord = d => [0, 2, 4].map(i => S.root + S.sc[(d + i) % L] + 12 * Math.floor((d + i) / L));
  const dl = new DelayNode(ctx, { delayTime: bt * .75 }), fb = new GainNode(ctx, { gain: .38 }), send = new GainNode(ctx, { gain: .35 });
  send.connect(dl).connect(fb).connect(dl); dl.connect(out);
  for (let b = 0, t = 0; t < dur; b++, t += bar) {
    const ch = chord(S.prog[b % S.prog.length]);
    // pad estéreo
    ch.forEach((m, k) => [-1, 1].forEach(p => tone(ctx, out, { type: 'sawtooth', f: N(m), t, len: bar, vol: .035, a: bar * .3, s: .9, d: 1, r: bar * .25, detune: p * 9, lp: style === 1 ? 500 : 1100, pan: p * .6 })));
    // baixo
    for (let i = 0; i < 4; i++) if (style !== 1 || !i) tone(ctx, out, { type: style === 2 ? 'sawtooth' : 'triangle', f: N(ch[0] - 12), t: t + i * bt, len: style === 1 ? bar : bt * .85, vol: .16, s: .7, d: .3, r: .1, lp: 400 });
    // arpejo
    if (S.arp && b) for (let i = 0; i < 8; i++) if (r() > .35) {
      const o = tone(ctx, out, { type: 'square', f: N(ch[r() * 3 | 0] + 12 * (1 + (r() > .6))), t: t + i * bt / 2, len: .15, vol: .035, d: .15, lp: 2500, pan: r() - .5 });
      tone(ctx, send, { type: 'square', f: o.frequency.value, t: t + i * bt / 2, len: .15, vol: .02, d: .15, lp: 2000 });
    }
    // bateria
    if (S.drums && b) for (let i = 0; i < 4; i++) {
      const x = t + i * bt;
      if (S.drums === 'techno' || i % 2 === 0) kick(ctx, out, x);
      if (S.drums === 'lofi' && i === 2) kick(ctx, out, x + bt / 2);
      if (i % 2) burst(ctx, out, { t: x, len: .16, vol: .22, type: 'highpass', f: 1500 });
      burst(ctx, out, { t: x + bt / 2, len: .04, vol: .1, type: 'highpass', f: 7000 });
      if (S.drums === 'techno') burst(ctx, out, { t: x, len: .03, vol: .06, type: 'highpass', f: 9000 });
    }
  }
  // drone de sub (todos)
  tone(ctx, out, { f: N(S.root - 24), t: 0, len: dur, vol: .12, a: 2, s: 1, d: 1, r: 1.5 });
}

function kick(ctx, out, t) {
  const o = tone(ctx, out, { f: 150, t, len: .4, vol: .6, d: .35 });
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .12);
}
