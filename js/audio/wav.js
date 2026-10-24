// AudioBuffer -> Blob WAV 16-bit
export function toWav(b) {
  const c = b.numberOfChannels, n = b.length, dv = new DataView(new ArrayBuffer(44 + n * c * 2));
  const w = (o, s) => [...s].forEach((ch, i) => dv.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * c * 2, true); w(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, c, true);
  dv.setUint32(24, b.sampleRate, true); dv.setUint32(28, b.sampleRate * c * 2, true);
  dv.setUint16(32, c * 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * c * 2, true);
  const ch = [...Array(c)].map((_, i) => b.getChannelData(i));
  for (let i = 0, o = 44; i < n; i++) for (let k = 0; k < c; k++, o += 2) dv.setInt16(o, Math.max(-1, Math.min(1, ch[k][i])) * 0x7fff, true);
  return new Blob([dv], { type: 'audio/wav' });
}
