// decodifica/reamostra tudo para 44.1 kHz mono
const dec = new OfflineAudioContext(1, 1, 44100);
export const decode = ab => dec.decodeAudioData(ab);
export async function fromPCM(data, sr) {
  const b = new AudioBuffer({ length: data.length, sampleRate: sr }); b.copyToChannel(data, 0);
  if (sr === 44100) return b;
  const c = new OfflineAudioContext(1, Math.ceil(data.length * 44100 / sr), 44100), s = new AudioBufferSourceNode(c, { buffer: b });
  s.connect(c.destination); s.start();
  return c.startRendering();
}
