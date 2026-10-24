import { shift } from './dsp.js';

// Efeitos de voz: claros e audíveis, com timbre "de outro mundo"
// layers: [semitons, ganho, pan] · shift: tom da voz principal
export const EFFECTS = {
  clean:   { n: 'Natural (limpa)', fx: {} },
  star:    { n: 'Emissário Estelar', fx: { layers: [[-5, .5]], chorus: .5, rev: 1.4, wet: .16 } },
  oracle:  { n: 'Oráculo Cósmico', fx: { layers: [[-7, .55], [12, .08]], rev: 2.2, wet: .22 } },
  android: { n: 'Androide Sereno', fx: { ring: 45, mix: .16, comb: .005, fb: .22 } },
  twin:    { n: 'Entidade Dupla', fx: { layers: [[3, .42, -.6], [-3, .42, .6]], chorus: .35 } },
  ai:      { n: 'IA de Bordo', fx: { band: [180, 7500], crush: 10, ring: 90, mix: .07, rev: .6, wet: .1 } },
  void:    { n: 'Voz do Vazio', fx: { layers: [[-12, .45]], chorus: .3, rev: 3, wet: .26 } },
  titan:   { n: 'Titã Ancestral', fx: { shift: -4, layers: [[-12, .3]], rev: 1.8, wet: .18 } },
  ether:   { n: 'Criatura Etérea', fx: { shift: 4, layers: [[12, .16]], chorus: .6, rev: 2, wet: .22 } },
  hive:    { n: 'Mente Coletiva', fx: { layers: [[-5, .35, -.7], [7, .25, .7], [-12, .25]], chorus: .4, rev: 1.5, wet: .15 } },
  robo:    { n: 'Robô Clássico (pesado)', fx: { ring: 55, mix: .55, crush: 5, comb: .007, fb: .45 } },
  radio:   { n: 'Transmissão de Rádio', fx: { band: [500, 3000], drive: 40, crush: 7 } },
  ghost:   { n: 'Sussurro Fantasma', fx: { rev: 3, wet: .4, comb: .011, fb: .4 } }
};

const curve = (n, f) => Float32Array.from({ length: n }, (_, i) => f(i / (n - 1) * 2 - 1));
const mono = (d, sr) => { const b = new AudioBuffer({ length: d.length, sampleRate: sr }); b.copyToChannel(d, 0); return b; };

// dry: AudioBuffer mono · tom: semitons extras · tempo: velocidade (só p/ motores sem controle nativo)
export async function applyFx(dry, f = {}, tom = 0, tempo = 1) {
  const sr = dry.sampleRate, x = dry.getChannelData(0), main = shift(x, sr, tom + (f.shift || 0), tempo);
  const layers = (f.layers || []).map(([s, g, p = 0]) => [shift(x, sr, tom + s, tempo), g, p]);
  const tail = Math.max(f.rev || 0, .05), len = Math.max(main.length, ...layers.map(l => l[0].length));
  const ctx = new OfflineAudioContext(2, Math.ceil(len + tail * sr), sr);
  const sum = new GainNode(ctx), src = (d, g, p) => { const s = new AudioBufferSourceNode(ctx, { buffer: mono(d, sr) }); s.connect(new GainNode(ctx, { gain: g })).connect(new StereoPannerNode(ctx, { pan: p })).connect(sum); s.start(); };
  src(main, 1, 0); layers.forEach(l => src(...l));

  let n = sum;
  const to = x => (n.connect(x), n = x);
  to(new BiquadFilterNode(ctx, { type: 'highpass', frequency: 85 }));
  if (f.band) { to(new BiquadFilterNode(ctx, { type: 'highpass', frequency: f.band[0] })); to(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: f.band[1] })); }
  if (f.drive) to(new WaveShaperNode(ctx, { curve: curve(2048, v => Math.tanh(v * f.drive / 10)) }));
  if (f.crush) { const s = 2 ** f.crush; to(new WaveShaperNode(ctx, { curve: curve(4096, v => Math.round(v * s) / s) })); }
  if (f.ring) {
    const g = to(new GainNode(ctx, { gain: 1 - f.mix })), o = new OscillatorNode(ctx, { frequency: f.ring }), a = new GainNode(ctx, { gain: f.mix });
    o.connect(a).connect(g.gain); o.start();
  }
  if (f.comb) {
    const d = new DelayNode(ctx, { delayTime: f.comb }), fb = new GainNode(ctx, { gain: f.fb }), s = new GainNode(ctx);
    n.connect(s); n.connect(d).connect(fb).connect(d); fb.connect(s); n = s;
  }
  if (f.chorus) { // 2 vozes moduladas (largura estéreo)
    const s = new GainNode(ctx); n.connect(s);
    [-1, 1].forEach(p => {
      const d = new DelayNode(ctx, { delayTime: .018 }), l = new OscillatorNode(ctx, { frequency: .6 + p * .15 }), lg = new GainNode(ctx, { gain: .004 });
      l.connect(lg).connect(d.delayTime); l.start();
      n.connect(d).connect(new GainNode(ctx, { gain: f.chorus * .5 })).connect(new StereoPannerNode(ctx, { pan: p * .8 })).connect(s);
    });
    n = s;
  }
  if (f.rev) {
    const c = new ConvolverNode(ctx), ir = ctx.createBuffer(2, sr * f.rev, sr), s = new GainNode(ctx);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3; }
    c.buffer = ir; n.connect(s); n.connect(c).connect(new GainNode(ctx, { gain: f.wet ?? .3 })).connect(s); n = s;
  }
  // presença (clareza) + compressão
  to(new BiquadFilterNode(ctx, { type: 'peaking', frequency: 3200, Q: .8, gain: 3 }));
  to(new DynamicsCompressorNode(ctx, { threshold: -18, ratio: 3, attack: .005, release: .15 })).connect(ctx.destination);
  return normalize(await ctx.startRendering());
}

export function normalize(b, peak = .95) {
  let m = 0;
  for (let c = 0; c < b.numberOfChannels; c++) for (const v of b.getChannelData(c)) m = Math.max(m, Math.abs(v));
  if (m) for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= peak / m; }
  return b;
}
