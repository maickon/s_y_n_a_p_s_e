import { speak } from '../tts/mespeak.js';
import { applyFx, VOICES } from '../audio/fx.js';
import { estimate } from './words.js';

// Gera a trilha de voz (com FX e seca) + tempos de cena/palavra
export async function buildVoiceTrack(scenes, { preset, pitch, speed, gap = .45, lead = .3, onProgress }) {
  const P = VOICES[preset], bufs = [];
  for (const [i, s] of scenes.entries()) {
    onProgress?.(i, scenes.length);
    const dry = await speak(s, { variant: P.v, pitch: Math.max(0, pitch + (P.p || 0)), speed });
    bufs.push([await applyFx(dry, P.fx), dry]);
  }
  const sr = bufs[0][0].sampleRate, G = Math.round(gap * sr), L = Math.round(lead * sr);
  let o = L;
  const pos = bufs.map(([, d]) => (o += d.length + G) - d.length - G);
  const len = Math.max(...bufs.map(([b], i) => pos[i] + b.length));
  const mk = () => new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 1 });
  const out = mk(), dry = mk(), d = out.getChannelData(0), dd = dry.getChannelData(0);
  // cauda (reverb) sobrepõe a pausa seguinte
  const timeline = bufs.map(([b, dr], i) => {
    b.getChannelData(0).forEach((v, j) => d[pos[i] + j] += v);
    dd.set(dr.getChannelData(0), pos[i]);
    const sc = { text: scenes[i], start: pos[i] / sr, end: (pos[i] + dr.length) / sr };
    sc.words = estimate(sc, dd, sr);
    return sc;
  });
  return { buffer: out, dry, timeline, duration: len / sr };
}
