// Serialização compacta de AudioBuffer (Int16 em Blob — gravação no IndexedDB ~100× mais rápida) + hash de chaves
export const hashKey = s => { let h = 2166136261, g = 5381; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h = Math.imul(h ^ c, 16777619); g = Math.imul(g, 33) ^ c; } return (h >>> 0).toString(36) + (g >>> 0).toString(36) + s.length.toString(36); };
export const pack = b => ({ sr: b.sampleRate, nc: b.numberOfChannels, len: b.length, blob: new Blob(Array.from({ length: b.numberOfChannels }, (_, c) => { const d = b.getChannelData(c), o = new Int16Array(d.length); for (let i = 0; i < d.length; i++) o[i] = Math.max(-1, Math.min(1, d[i])) * 32767; return o; })) });
export async function unpack(o) {
  const a = new Int16Array(await o.blob.arrayBuffer()), b = new AudioBuffer({ length: o.len, sampleRate: o.sr, numberOfChannels: o.nc });
  for (let c = 0; c < o.nc; c++) { const f = b.getChannelData(c), off = c * o.len; for (let i = 0; i < o.len; i++) f[i] = a[off + i] / 32767; }
  return b;
}
