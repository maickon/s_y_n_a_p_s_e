import { synth } from '../tts/index.js';
import { applyFx, EFFECTS } from '../audio/fx.js';
import { estimate } from './words.js';

// Gera a trilha de voz (com FX, estéreo) e a seca (mono) + tempos de cena/palavra
export async function buildVoiceTrack(scenes, { voice, effect, tom = 0, speed = 1, gap = .45, lead = .3, onProgress, onDownload }) {
  const fx = EFFECTS[effect]?.fx || {}, bufs = [];
  let fallback = false;
  for (const [i, s] of scenes.entries()) {
    onProgress?.(i, scenes.length);
    const r = await synth(s, voice, speed, onDownload);
    fallback ||= r.fallback;
    const out = await applyFx(r.buf, fx, tom, r.native ? 1 : speed);
    // seca com mesmo tempo/tom da final (alinhamento de legendas)
    const dry = new AudioBuffer({ length: out.length, sampleRate: out.sampleRate }); dry.copyToChannel(out.getChannelData(0), 0);
    const n = Math.round(r.buf.duration / (r.native ? 1 : speed) * out.sampleRate);
    bufs.push([out, dry, Math.min(n, out.length)]);
  }
  const sr = bufs[0][0].sampleRate, G = Math.round(gap * sr), L = Math.round(lead * sr);
  let o = L;
  const pos = bufs.map(([, , n]) => (o += n + G) - n - G);
  const len = Math.max(...bufs.map(([b], i) => pos[i] + b.length));
  const out = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 2 }), dry = new AudioBuffer({ length: len, sampleRate: sr });
  const dd = dry.getChannelData(0);
  // cauda (reverb) sobrepõe a pausa seguinte
  const timeline = bufs.map(([b, dr, n], i) => {
    for (let c = 0; c < 2; c++) { const d = out.getChannelData(c), s = b.getChannelData(c); for (let j = 0; j < s.length; j++) d[pos[i] + j] += s[j]; }
    dd.set(dr.getChannelData(0).subarray(0, n), pos[i]);
    const sc = { text: scenes[i], start: pos[i] / sr, end: (pos[i] + n) / sr };
    sc.words = estimate(sc, dd, sr);
    return sc;
  });
  return { buffer: out, dry, timeline, duration: len / sr, fallback };
}
