import { speak } from '../tts/mespeak.js';
import { applyFx, VOICES } from '../audio/fx.js';

// Gera a trilha de voz completa + tempos de cada cena
export async function buildVoiceTrack(scenes, { preset, pitch, speed, gap = .45, onProgress }) {
  const P = VOICES[preset], bufs = [];
  for (const [i, s] of scenes.entries()) {
    onProgress?.(i, scenes.length);
    const dry = await speak(s, { variant: P.v, pitch: Math.max(0, pitch + (P.p || 0)), speed });
    bufs.push([await applyFx(dry, P.fx), dry.length]);
  }
  const sr = bufs[0][0].sampleRate, G = Math.round(gap * sr), lead = Math.round(.3 * sr);
  const len = lead + bufs.reduce((a, [b, n]) => a + n + G, 0) + bufs.at(-1)[0].length - bufs.at(-1)[1];
  const out = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 1 }), d = out.getChannelData(0);
  let o = lead;
  // cauda (reverb) sobrepõe a pausa seguinte
  const timeline = bufs.map(([b, n], i) => {
    b.getChannelData(0).forEach((v, j) => d[o + j] += v);
    const t = { text: scenes[i], start: o / sr, end: (o + n) / sr };
    o += n + G;
    return t;
  });
  return { buffer: out, timeline, duration: len / sr };
}
