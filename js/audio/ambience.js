import { rng } from '../core/script.js';
import { noise, tone, burst } from './synth.js';

export const AMBS = { auto: 'Automático (pelo estilo)', rain: 'Chuva', wind: 'Vento', hum: 'Zumbido Elétrico', space: 'Vácuo Espacial', static: 'Estática', none: 'Nenhum' };
export const AUTO = ['rain', 'space', 'static', 'hum'];

const bed = (ctx, out, dur, nodes, vol) => {
  const s = new AudioBufferSourceNode(ctx, { buffer: noise(ctx), loop: true }), g = new GainNode(ctx, { gain: vol });
  nodes.reduce((a, n) => a.connect(n), s).connect(g).connect(out); s.start(0); s.stop(dur);
  return g;
};
const lfo = (ctx, param, f, amt, dur) => { const o = new OscillatorNode(ctx, { frequency: f }), g = new GainNode(ctx, { gain: amt }); o.connect(g).connect(param); o.start(0); o.stop(dur); };

export function ambience(ctx, out, dur, kind, seed) {
  const r = rng(seed + 99), bq = (type, frequency, Q = .7) => new BiquadFilterNode(ctx, { type, frequency, Q });
  if (kind === 'rain') {
    bed(ctx, out, dur, [bq('highpass', 500), bq('lowpass', 5000)], .22);
    for (let t = 0; t < dur; t += r() * .12) burst(ctx, out, { t, len: .02, vol: .04 + r() * .06, f: 1500 + r() * 4000, Q: 4 });
  } else if (kind === 'wind') {
    const f = bq('bandpass', 500, 1.8); lfo(ctx, f.frequency, .07, 350, dur);
    lfo(ctx, bed(ctx, out, dur, [f], .5).gain, .11, .25, dur);
  } else if (kind === 'hum') {
    [50, 100, 150, 250].forEach((f, i) => tone(ctx, out, { type: i ? 'sawtooth' : 'sine', f, t: 0, len: dur, vol: .09 / (i + 1), a: 1, s: 1, d: 1, r: 1, lp: 600 }));
    bed(ctx, out, dur, [bq('bandpass', 4000, 3)], .05);
  } else if (kind === 'space') {
    const f = bq('lowpass', 250); lfo(ctx, f.frequency, .05, 150, dur);
    bed(ctx, out, dur, [f], .6);
    tone(ctx, out, { f: 36, t: 0, len: dur, vol: .1, a: 3, s: 1, d: 1, r: 2 });
  } else if (kind === 'static') {
    bed(ctx, out, dur, [bq('highpass', 3000)], .09);
    for (let t = 0; t < dur; t += r() * .5) burst(ctx, out, { t, len: .008, vol: .35 * r(), type: 'highpass', f: 1000 });
  }
}
