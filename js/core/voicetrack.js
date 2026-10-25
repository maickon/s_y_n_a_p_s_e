import { synth, refTag } from '../tts/index.js';
import { applyFx, EFFECTS } from '../audio/fx.js';
import { estimate } from './words.js';
import * as store from './store.js';
import { hashKey, pack, unpack } from '../audio/bufstore.js';
import { isDesktop } from '../native.js';

const AHEAD = isDesktop ? 4 : 1; // desktop: várias frases em paralelo (pool nativo)

// cache por frase (memória + IndexedDB): só frases novas/alteradas são sintetizadas
const MEM = new Map();
async function trim(k) {
  const idx = (await store.get('ttsIdx') || []).filter(x => x !== k); idx.push(k);
  while (idx.length > 600) store.del('tts:' + idx.shift());
  store.set('ttsIdx', idx);
}
const keyOf = (text, voice, effect, tom, speed) => hashKey([text, voice + (voice.includes('xtts') ? refTag : ''), effect, tom, speed].join('|'));
async function sceneAudio(text, voice, effect, tom, speed, onDownload, pre) {
  const k = keyOf(text, voice, effect, tom, speed);
  if (MEM.has(k)) return { ...MEM.get(k), k };
  const s = await store.get('tts:' + k);
  if (s?.blob) { const v = { out: await unpack(s), n: s.n }; MEM.set(k, v); return { ...v, k, cached: true }; }
  const r = await (pre || synth(text, voice, speed, onDownload)), fx = EFFECTS[effect]?.fx || {};
  const out = await applyFx(r.buf, fx, tom, r.native ? 1 : speed), n = Math.min(Math.round(r.buf.duration / (r.native ? 1 : speed) * out.sampleRate), out.length);
  const v = { out, n };
  if (!r.fallback) { MEM.set(k, v); store.set('tts:' + k, { ...pack(out), n }); trim(k); } // não guarda o fallback
  return { ...v, k, fallback: r.fallback };
}

// Gera a trilha de voz (FX, estéreo) e a seca (mono) + tempos de cena/palavra
export async function buildVoiceTrack(scenes, { voice, effect, tom = 0, speed = 1, gap = .45, lead = .3, onProgress, onDownload }) {
  const bufs = [];
  let fallback = false;
  // pipeline: a síntese da próxima frase roda (no worker) enquanto a atual recebe os efeitos
  const pre = new Map(), kick = i => {
    if (i >= scenes.length || pre.has(i)) return;
    const k = keyOf(scenes[i], voice, effect, tom, speed);
    pre.set(i, MEM.has(k) ? null : store.get('tts:' + k).then(s => s?.blob ? null : synth(scenes[i], voice, speed, onDownload)));
  };
  for (const [i, s] of scenes.entries()) {
    onProgress?.(i, scenes.length);
    for (let j = 0; j <= AHEAD; j++) kick(i + j);
    const r = await sceneAudio(s, voice, effect, tom, speed, onDownload, await pre.get(i));
    fallback ||= r.fallback;
    bufs.push(r);
  }
  onProgress?.(scenes.length, scenes.length);
  const sr = bufs[0].out.sampleRate, G = Math.round(gap * sr), L = Math.round(lead * sr);
  let o = L;
  const pos = bufs.map(({ n }) => (o += n + G) - n - G);
  const len = Math.max(...bufs.map(({ out }, i) => pos[i] + out.length));
  const out = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 2 }), dry = new AudioBuffer({ length: len, sampleRate: sr });
  const dd = dry.getChannelData(0);
  // cauda (reverb) sobrepõe a pausa seguinte
  const timeline = bufs.map(({ out: b, n }, i) => {
    for (let c = 0; c < 2; c++) { const d = out.getChannelData(c), s = b.getChannelData(c); for (let j = 0; j < s.length; j++) d[pos[i] + j] += s[j]; }
    dd.set(b.getChannelData(0).subarray(0, n), pos[i]);
    const sc = { text: scenes[i], start: pos[i] / sr, end: (pos[i] + n) / sr };
    sc.words = estimate(sc, dd, sr);
    return sc;
  });
  return { buffer: out, dry, timeline, duration: len / sr, fallback, key: hashKey(bufs.map(b => b.k).join() + lead + gap) };
}
