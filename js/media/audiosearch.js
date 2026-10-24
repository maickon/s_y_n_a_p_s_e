// Busca de trilhas CC no Openverse (sem chave)
export async function searchAudio(q) {
  const r = await fetch(`https://api.openverse.org/v1/audio/?page_size=10&q=${encodeURIComponent(q)}`);
  if (!r.ok) throw Error('Openverse ' + r.status);
  return (await r.json()).results.map(x => ({ title: x.title, url: x.url, dur: (x.duration || 0) / 1e3, credit: `${x.title} — ${x.creator || '?'} · ${x.license.toUpperCase()} ${x.license_version || ''} (${x.source})` }));
}

const dec = new OfflineAudioContext(2, 1, 44100);
export const decodeAudio = async src => dec.decodeAudioData(await (typeof src === 'string' ? (await fetch(src)).arrayBuffer() : src.arrayBuffer()));
