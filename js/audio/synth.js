// Utilitários de síntese (OfflineAudioContext)
export const N = m => 440 * 2 ** ((m - 69) / 12);
const nz = new WeakMap();
export const noise = ctx => nz.get(ctx) ?? (nz.set(ctx, (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })()), nz.get(ctx));

// envelope AD/ASR num GainNode
export function env(ctx, t, { a = .005, d = .2, s = 0, r = 0, peak = 1, len = 0 }) {
  const g = new GainNode(ctx, { gain: 0 });
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
  if (len) { g.gain.setTargetAtTime(peak * s, t + a, d / 3); g.gain.setTargetAtTime(0, t + len, r / 3 || .05); }
  else g.gain.setTargetAtTime(0, t + a, d / 3);
  return g;
}

export function tone(ctx, out, { type = 'sine', f, t, len = .2, vol = .2, a, d = len, s, r, detune = 0, lp, pan = 0 }) {
  const o = new OscillatorNode(ctx, { type, frequency: f, detune }), g = env(ctx, t, { a, d, s, r, peak: vol, len: s != null ? len : 0 });
  let n = o.connect(g);
  if (lp) n = n.connect(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: lp, Q: .7 }));
  if (pan) n = n.connect(new StereoPannerNode(ctx, { pan }));
  n.connect(out); o.start(t); o.stop(t + len + (r || d) + .3);
  return o;
}

export function burst(ctx, out, { t, len = .2, vol = .3, type = 'bandpass', f = 2000, f2, Q = 1, a = .002 }) {
  const s = new AudioBufferSourceNode(ctx, { buffer: noise(ctx), loop: true }), fl = new BiquadFilterNode(ctx, { type, frequency: f, Q });
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + len);
  s.connect(fl).connect(env(ctx, t, { a, d: len, peak: vol })).connect(out);
  s.start(t, Math.random()); s.stop(t + len * 2 + .1);
}
