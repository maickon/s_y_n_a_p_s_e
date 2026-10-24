import { music, loopLen } from './music.js';
import * as store from '../core/store.js';
import { ambience } from './ambience.js';
import { STYLES } from '../core/styles.js';
import { sfxEvents, stingEvents, renderEvents } from './sfx.js';
import { hashKey, pack, unpack } from './bufstore.js';

// Mixagem em camadas: música, ambiente e efeitos são renderizados uma vez e reaproveitados (cache);
// a mixagem final só soma as camadas com volumes e ducking — rápida.
const SR = 44100, MEM = new Map();

// render offline com progresso estimado pelo tempo (sem suspend(), que deixa o render até 15× mais lento)
let RATE = .15; // segundos de processamento por segundo de áudio (aprendido)
export async function renderP(ctx, dur, onP) {
  const t0 = performance.now(), iv = onP && setInterval(() => onP(Math.min(.97, (performance.now() - t0) / 1e3 / (dur * RATE))), 250);
  try { return await ctx.startRendering(); }
  finally { clearInterval(iv); RATE = RATE * .6 + .4 * ((performance.now() - t0) / 1e3 / dur); }
}
async function stem(key, dur, build, onP, { tail = 0, keep = false } = {}) {
  if (MEM.has(key)) return MEM.get(key);
  const s = keep && await store.get('stem:' + key);
  if (s?.blob) { const b = await unpack(s); MEM.set(key, b); return b; }
  const ctx = new OfflineAudioContext(2, Math.ceil((dur + tail) * SR), SR);
  build(ctx, ctx.destination);
  let b = await renderP(ctx, dur + tail, onP);
  if (tail) { // loop sem emenda: a cauda é somada ao início e cortada
    const n = Math.round(dur * SR), o = new AudioBuffer({ length: n, sampleRate: SR, numberOfChannels: 2 });
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c), f = o.getChannelData(c); f.set(d.subarray(0, n)); for (let i = 0; i < d.length - n; i++) f[i] += d[n + i]; }
    b = o;
  }
  MEM.set(key, b); if (MEM.size > 10) MEM.delete(MEM.keys().next().value);
  if (keep) { store.set('stem:' + key, pack(b)); const idx = (await store.get('stemIdx') || []).filter(x => x !== key); idx.push(key); while (idx.length > 8) store.del('stem:' + idx.shift()); store.set('stemIdx', idx); }
  return b;
}

// chave que identifica o resultado da mixagem (para cache entre recarregamentos)
export function mixKey(o) {
  const ST = STYLES[o.style] || STYLES[0];
  return hashKey(JSON.stringify([o.voiceKey, o.duration.toFixed(2), o.segs.map(s => [s.a.toFixed(2), s.trans, s.seed]), o.timeline.map(s => [s.start.toFixed(2), s.end.toFixed(2)]),
    o.style, o.seed, o.musicName || '', o.amb === 'auto' ? ST.amb : o.amb, o.pack === 'auto' ? ST.sfx : o.pack, o.prof === 'auto' ? ST.mus : o.prof, o.intro, o.vol]));
}

export async function mixdown({ voice, timeline, segs, duration, style, seed, musicBuf, amb, vol, pack = 'auto', intro, prof = 'auto', norm = true }, onP) {
  const ST = STYLES[style] || STYLES[0], D = duration + 1.5;
  const p = prof === 'auto' ? ST.mus : +prof, kind = amb === 'auto' ? ST.amb : amb, pk = pack === 'auto' ? ST.sfx : pack;
  // música e ambiente: loops renderizados uma vez (independem da duração do vídeo)
  const ML = loopLen(p), mus = musicBuf || await stem(`m|${p}|${seed}`, ML, (c, o) => music(c, o, ML, p, seed), x => onP?.('Compondo música (loop)', x), { tail: 2.5, keep: true });
  const amB = kind === 'none' ? null : await stem(`a|${kind}|${seed}`, 16, (c, o) => ambience(c, o, 16, kind, seed), x => onP?.('Gerando ambiente (loop)', x), { tail: 1.5, keep: true });
  onP?.('Efeitos sonoros', null);
  const fx = await renderEvents([...sfxEvents(segs, timeline, pk, seed), ...(intro?.sound && intro.sound !== 'none' ? stingEvents(intro.sound, intro.dur) : [])], D);
  return mixJS({ voice, mus, amB, fx, D, timeline, intro, vol, norm }, onP);
}

// mixagem final em JS puro: ducking da música sob a voz, fades, soft-clip e normalização
async function mixJS({ voice, mus, amB, fx, D, timeline, intro, vol, norm }, onP) {
  const N = Math.ceil(D * SR), out = new AudioBuffer({ length: N, sampleRate: SR, numberOfChannels: 2 });
  const zones = timeline.map(s => [Math.max(0, s.start - .25) * SR, (s.end + .1) * SR]), introEnd = intro?.sound && intro.sound !== 'none' ? intro.dur * .8 * SR : -1;
  const kd = 1 - Math.exp(-1 / (.08 * SR)), ku = 1 - Math.exp(-1 / (.3 * SR)), kf = 1 - Math.exp(-1 / (.5 * SR)), ko = 1 - Math.exp(-1 / (.4 * SR)), fo = (D - 1.8) * SR;
  const ch = (b, c) => b?.getChannelData(Math.min(c, b.numberOfChannels - 1));
  for (let c = 0; c < 2; c++) {
    const o = out.getChannelData(c), v = ch(voice, c), m = ch(mus, c), a = ch(amB, c), f = fx.getChannelData(c), ml = m.length, al = a?.length || 1, vl = v.length;
    let duck = 1, fin = 0, fout = 1, z = 0;
    for (let i = 0; i < N; i++) {
      if (i % (SR * 20) === 0 && i) { onP?.('Mixagem final', (c + i / N) / 2); await new Promise(r => setTimeout(r)); }
      while (z < zones.length && i > zones[z][1]) z++;
      const tgt = i < introEnd ? .35 : z < zones.length && i >= zones[z][0] ? .28 : 1;
      duck += (tgt - duck) * (tgt < duck ? kd : ku); fin += (1 - fin) * kf; if (i > fo) fout += (0 - fout) * ko;
      let x = (i < vl ? v[i] : 0) * vol.voice + m[i % ml] * duck * fin * fout * vol.music + (a ? a[i % al] * fin * fout * vol.amb : 0) + f[i] * fout * vol.sfx;
      const ax = Math.abs(x); if (ax > .8) x = Math.sign(x) * (.8 + .2 * Math.tanh((ax - .8) / .2));
      o[i] = x;
    }
  }
  let mx = 0;
  for (let c = 0; c < 2; c++) for (const x of out.getChannelData(c)) mx = Math.max(mx, Math.abs(x));
  if (mx && norm) for (let c = 0; c < 2; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= .89 / mx; }
  return out;
}
