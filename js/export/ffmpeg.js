import { call } from '../native.js';
import { toWav } from '../audio/wav.js';

// desktop: quadros RGBA -> FFmpeg nativo (GPU quando houver); até 2 quadros em trânsito enquanto o próximo é desenhado
export async function exportNative({ canvas, audio, duration, fps, draw, onProgress, cancelled, name }) {
  const { width: w, height: h } = canvas, rc = Object.assign(document.createElement('canvas'), { width: w, height: h }).getContext('2d', { willReadFrequently: true });
  const enc = await call('ff_start', new Uint8Array(await toWav(audio).arrayBuffer()), { headers: { w: '' + w, h: '' + h, fps: '' + fps, name } });
  const n = Math.ceil(duration * fps), fly = [];
  try {
    for (let i = 0; i < n; i++) {
      if (cancelled?.()) throw Error('CANCELADO');
      draw(i / fps);
      rc.drawImage(canvas, 0, 0);
      fly.push(call('ff_frame', new Uint8Array(rc.getImageData(0, 0, w, h).data.buffer)));
      if (fly.length > 2) await fly.shift();
      if (i % 4 === 0) onProgress?.(i / n, i, n);
    }
    await Promise.all(fly);
    return { path: await call('ff_finish'), enc };
  } catch (e) { await Promise.allSettled(fly); await call('ff_cancel'); throw e; }
}
