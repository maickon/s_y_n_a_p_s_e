// Presets de voz: variante eSpeak + cadeia de efeitos
export const VOICES = {
  robo:    { n: 'Robô Clássico',        v: 'm3',      fx: { ring: 55, mix: .55, crush: 5, comb: .007, fb: .45 } },
  android: { n: 'Androide Metálico',    v: 'klatt3',  fx: { comb: .004, fb: .65, band: 1800 } },
  oracle:  { n: 'Oráculo Abissal',      v: 'm7', p: -20, fx: { ring: 30, mix: .3, rev: 2.5 } },
  radio:   { n: 'Transmissão de Rádio', v: 'f2',      fx: { band: 1500, drive: 40, crush: 7 } },
  ghost:   { n: 'Sussurro Fantasma',    v: 'whisper', fx: { rev: 3, comb: .011, fb: .4 } },
  cyborg:  { n: 'Ciborgue Feminina',    v: 'f4',      fx: { ring: 80, mix: .35, comb: .005, fb: .5 } },
  raw:     { n: 'eSpeak Puro',          v: '',        fx: {} }
};

const curve = (n, f) => Float32Array.from({ length: n }, (_, i) => f(i / (n - 1) * 2 - 1));

export async function applyFx(buf, f = {}) {
  const sr = buf.sampleRate, ctx = new OfflineAudioContext(1, Math.ceil((buf.duration + (f.rev || .05)) * sr), sr);
  const src = ctx.createBufferSource(); src.buffer = buf;
  let n = src;
  const to = x => (n.connect(x), n = x);
  const nd = (t, o) => Object.assign(ctx[t](), o);

  if (f.band) { const b = to(ctx.createBiquadFilter()); b.type = 'bandpass'; b.frequency.value = f.band; b.Q.value = .6; }
  if (f.drive) to(nd('createWaveShaper', { curve: curve(2048, x => Math.tanh(x * f.drive / 10)) }));
  if (f.crush) { const s = 2 ** f.crush; to(nd('createWaveShaper', { curve: curve(4096, x => Math.round(x * s) / s) })); }
  if (f.ring) {
    const g = to(ctx.createGain()), o = ctx.createOscillator(), a = ctx.createGain();
    g.gain.value = 1 - f.mix; a.gain.value = f.mix; o.frequency.value = f.ring;
    o.connect(a).connect(g.gain); o.start();
  }
  if (f.comb) {
    const d = ctx.createDelay(), fb = ctx.createGain(), sum = ctx.createGain();
    d.delayTime.value = f.comb; fb.gain.value = f.fb;
    n.connect(sum); n.connect(d).connect(fb).connect(d); fb.connect(sum); n = sum;
  }
  if (f.rev) {
    const c = ctx.createConvolver(), ir = ctx.createBuffer(2, sr * f.rev, sr), w = ctx.createGain(), sum = ctx.createGain();
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3; }
    c.buffer = ir; w.gain.value = .35; n.connect(sum); n.connect(c).connect(w).connect(sum); n = sum;
  }
  to(nd('createDynamicsCompressor', {})).connect(ctx.destination);
  src.start();
  return normalize(await ctx.startRendering());
}

export function normalize(b, peak = .95) {
  const d = b.getChannelData(0); let m = 0;
  for (const v of d) m = Math.max(m, Math.abs(v));
  if (m) for (let i = 0; i < d.length; i++) d[i] *= peak / m;
  return b;
}
