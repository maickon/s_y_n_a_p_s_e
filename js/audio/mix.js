import { music } from './music.js';
import { ambience } from './ambience.js';
import { STYLES } from '../core/styles.js';
import { sfx } from './sfx.js';

// mixdown offline estéreo: voz + música (ducking) + ambiente + efeitos
export async function mixdown({ voice, timeline, segs, duration, style, seed, musicBuf, amb, vol, pack = 'auto', norm = true }) {
  const ST = STYLES[style] || STYLES[0];
  const sr = 44100, D = duration + 1.5, ctx = new OfflineAudioContext(2, Math.ceil(D * sr), sr);
  const master = new GainNode(ctx), lim = new DynamicsCompressorNode(ctx, { threshold: -8, knee: 6, ratio: 6, attack: .004, release: .2 });
  master.connect(lim).connect(ctx.destination);
  const bus = (v, fade = true) => { const g = new GainNode(ctx, { gain: 0 }); g.connect(master); g.gain.setTargetAtTime(v, 0, fade ? .5 : .001); g.gain.setTargetAtTime(0, D - 1.8, .4); return g; };

  const vs = new AudioBufferSourceNode(ctx, { buffer: voice });
  vs.connect(new GainNode(ctx, { gain: vol.voice })).connect(master); vs.start(0);

  const mg = bus(vol.music), duck = new GainNode(ctx);
  duck.connect(mg);
  timeline.forEach(s => { duck.gain.setTargetAtTime(.28, Math.max(0, s.start - .25), .08); duck.gain.setTargetAtTime(1, s.end + .1, .3); });
  if (musicBuf) { const m = new AudioBufferSourceNode(ctx, { buffer: musicBuf, loop: true }); m.connect(duck); m.start(0); }
  else music(ctx, duck, D, ST.mus, seed);

  ambience(ctx, bus(vol.amb), D, amb === 'auto' ? ST.amb : amb, seed);
  sfx(ctx, bus(vol.sfx, false), segs, timeline, pack === 'auto' ? ST.sfx : pack, seed);

  const out = await ctx.startRendering();
  // normaliza estéreo (-1 dBFS)
  let m = 0;
  for (let c = 0; c < 2; c++) for (const v of out.getChannelData(c)) m = Math.max(m, Math.abs(v));
  if (m && norm) for (let c = 0; c < 2; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= .89 / m; }
  return out;
}
