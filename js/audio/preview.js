import { music } from './music.js';
import { ambience } from './ambience.js';
import { sfx, sting } from './sfx.js';

// trechos curtos renderizados offline para prévia (com cache)
const cache = new Map(), SR = 44100;
const off = async (key, dur, fn) => {
  if (cache.has(key)) return cache.get(key);
  const ctx = new OfflineAudioContext(2, dur * SR, SR), g = new GainNode(ctx, { gain: 0 }), lim = new DynamicsCompressorNode(ctx, { threshold: -10, ratio: 8 });
  g.gain.setTargetAtTime(1, 0, .15); g.gain.setTargetAtTime(0, dur - .8, .25); g.connect(lim).connect(ctx.destination);
  fn(ctx, g, dur);
  const p = ctx.startRendering(); cache.set(key, p); return p;
};
export const PROFILES = ['Lo-fi Vaporwave', 'Drone Cósmico', 'Techno Digital', 'Liminar Etéreo', 'Noir (piano)', 'Documental', 'Cinemático (taiko)', 'Synthwave'];
export const previewMusic = prof => off('m' + prof, 10, (c, o, d) => music(c, o, d, prof, 7));
export const previewAmb = kind => off('a' + kind, 6, (c, o, d) => { const g = new GainNode(c, { gain: 1.6 }); g.connect(o); ambience(c, g, d, kind, 3); });
export const previewPack = pack => off('p' + pack, 5, (c, o) => sfx(c, o, [{ a: .8, trans: 'whip', seed: 0 }, { a: 2, trans: 'glitch', seed: 0 }, { a: 3.2, trans: 'dipblack', seed: 1 }], [{ start: .3 }, { start: 2.3 }], pack, 3));
export const previewSting = (kind, d) => off(`s${kind}${d}`, d + 1.5, (c, o) => sting(c, o, kind, d, 5));
export const clip = (buf, max = 15) => { if (buf.duration <= max) return buf; const n = max * buf.sampleRate, b = new AudioBuffer({ length: n, sampleRate: buf.sampleRate, numberOfChannels: buf.numberOfChannels }); for (let c = 0; c < b.numberOfChannels; c++) b.copyToChannel(buf.getChannelData(c).subarray(0, n), c); return b; };
