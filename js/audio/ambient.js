// Drone simples por estilo (substituído na Etapa 5)
const F = [[110, 112], [55, 56.5], [130.81, 185], [73.42, 74.2]];

export function drone(ctx, outs, style, at = ctx.currentTime) {
  const g = ctx.createGain(), f = ctx.createBiquadFilter();
  f.frequency.value = 300; g.gain.value = .07;
  const os = F[style].map(fr => { const o = ctx.createOscillator(); o.frequency.value = fr; o.connect(f); o.start(at); return o; });
  f.connect(g); outs.forEach(o => g.connect(o));
  return () => { os.forEach(o => o.stop()); g.disconnect(); };
}

export function glitch(ctx, outs, at = ctx.currentTime) {
  const b = ctx.createBuffer(1, ctx.sampleRate * .1, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = b; f.type = 'bandpass'; f.frequency.value = 1000 + Math.random() * 2000;
  g.gain.setValueAtTime(.2, at); g.gain.exponentialRampToValueAtTime(.01, at + .1);
  s.connect(f).connect(g); outs.forEach(o => g.connect(o)); s.start(at);
}
