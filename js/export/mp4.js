const ch = new MessageChannel(), q = [];
ch.port1.onmessage = () => q.shift()?.();
// cede a vez à interface a cada quadro; em aba de fundo usa MessageChannel (sem o throttling de setTimeout)
const tick = () => new Promise(r => document.hidden ? (q.push(r), ch.port2.postMessage(0)) : setTimeout(r, 0));

import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, QUALITY_HIGH, getFirstEncodableVideoCodec, getFirstEncodableAudioCodec } from 'mediabunny';

// render determinístico quadro a quadro -> MP4 (WebCodecs)
export async function exportMP4({ canvas, audio, duration, fps, draw, onProgress, cancelled }) {
  const { width, height } = canvas;
  const vc = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width, height }), ac = await getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: 2, sampleRate: audio.sampleRate });
  if (!vc) throw Error('Navegador sem suporte a WebCodecs (use Chrome/Edge)');
  const out = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const vs = new CanvasSource(canvas, { codec: vc, bitrate: QUALITY_HIGH, keyFrameInterval: 2 });
  out.addVideoTrack(vs, { frameRate: fps });
  const as = ac && new AudioBufferSource({ codec: ac, bitrate: QUALITY_HIGH });
  if (as) out.addAudioTrack(as);
  await out.start();
  if (as) await as.add(audio);
  const n = Math.ceil(duration * fps);
  for (let i = 0; i < n; i++) {
    if (cancelled?.()) { await out.cancel(); throw Error('CANCELADO'); }
    draw(i / fps);
    await vs.add(i / fps, 1 / fps);
    if (i % 4 === 0) onProgress?.(i / n, i, n);
    await tick();
  }
  await out.finalize();
  return { blob: new Blob([out.target.buffer], { type: 'video/mp4' }), vc, ac };
}
