// Busca de imagens em várias fontes grátis + tradução + ranqueamento por relevância
const strip = s => (s || '').replace(/<[^>]+>/g, '').trim();
const get = (u, h) => fetch(u, { headers: h }).then(r => r.ok ? r.json() : Promise.reject(r.status));
const enc = encodeURIComponent;

export const PROVIDERS = {
  pexels: { n: 'Pexels', key: 1, url: 'https://www.pexels.com/api/', prior: 2 },
  unsplash: { n: 'Unsplash', key: 1, url: 'https://unsplash.com/developers', prior: 2 },
  pixabay: { n: 'Pixabay', key: 1, url: 'https://pixabay.com/api/docs/', prior: 1.6 },
  openverse: { n: 'Openverse', prior: .6 },
  wikimedia: { n: 'Wikimedia Commons', prior: .4 }
};
let cfg = { keys: {}, off: {} };
export const setConfig = c => cfg = { keys: {}, off: {}, ...c };
export const active = () => Object.keys(PROVIDERS).filter(k => !cfg.off[k] && (!PROVIDERS[k].key || cfg.keys[k]));

// orientação pedida às APIs conforme o formato do vídeo
const ori = ar => ar > 1.2 ? ['horizontal', 'landscape', 'landscape'] : ar < .8 ? ['vertical', 'portrait', 'portrait'] : ['all', 'square', 'squarish'];
const SRC = {
  pexels: (q, ar, k) => get(`https://api.pexels.com/v1/search?query=${enc(q)}&per_page=15&locale=pt-BR&orientation=${ori(ar)[1]}`, { Authorization: k })
    .then(d => d.photos.map(p => ({ src: p.src.large2x, thumb: p.src.medium, w: p.width, h: p.height, text: p.alt, credit: `${p.photographer} · Pexels` }))),
  unsplash: (q, ar, k) => get(`https://api.unsplash.com/search/photos?query=${enc(q)}&per_page=15&lang=pt&orientation=${ori(ar)[2]}&client_id=${k}`)
    .then(d => d.results.map(p => ({ src: p.urls.regular, thumb: p.urls.small, w: p.width, h: p.height, text: [p.alt_description, p.description, ...(p.tags || []).map(t => t.title)].join(' '), credit: `${p.user.name} · Unsplash` }))),
  pixabay: (q, ar, k) => get(`https://pixabay.com/api/?key=${k}&q=${enc(q)}&lang=pt&image_type=photo&orientation=${ori(ar)[0]}&per_page=20&safesearch=true`)
    .then(d => d.hits.map(h => ({ src: h.largeImageURL, thumb: h.webformatURL, w: h.imageWidth, h: h.imageHeight, text: h.tags, credit: `${h.user} · Pixabay` }))),
  openverse: q => get(`https://api.openverse.org/v1/images/?page_size=12&mature=false&q=${enc(q)}`)
    .then(d => d.results.map(r => ({ src: r.url, thumb: r.thumbnail || r.url, w: r.width, h: r.height, text: [r.title, ...(r.tags || []).map(t => t.name)].join(' '), credit: `${r.creator || '?'} · ${r.license.toUpperCase()} ${r.license_version || ''} (Openverse)` }))),
  wikimedia: q => get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=1600&gsrsearch=${enc(q + ' filetype:bitmap')}`)
    .then(d => Object.values(d.query?.pages || {}).map(p => [p.title, p.imageinfo?.[0]]).filter(([, i]) => i && /jpeg|png|webp/.test(i.mime))
      .map(([t, i]) => ({ src: i.thumburl || i.url, thumb: i.thumburl || i.url, w: i.thumbwidth, h: i.thumbheight, text: (t || '').replace(/^File:|\.\w+$/g, ''), credit: `${strip(i.extmetadata?.Artist?.value) || 'Wikimedia'} · ${i.extmetadata?.LicenseShortName?.value || ''} (Wikimedia)` })))
};

// tradução pt→en grátis (MyMemory) para as fontes indexadas em inglês
const TR = new Map();
export async function translate(q) {
  if (TR.has(q)) return TR.get(q);
  const p = fetch(`https://api.mymemory.translated.net/get?q=${enc(q)}&langpair=pt-BR|en`).then(r => r.json())
    .then(r => { const t = r.responseData?.translatedText; return t && !/MYMEMORY|INVALID/i.test(t) ? t : q; }).catch(() => q);
  TR.set(q, p); return p;
}

const toks = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(w => w.length > 2).map(w => w.replace(/(es|s)$/, ''));

// terms = { q: termo da cena, topic: assunto geral, entity/ctx: artigos da Wikipedia (entities.js) }; ar = proporção do vídeo
export async function searchImages({ q, topic = '', entity, ctx }, ar = 16 / 9) {
  const clean = t => (t || '').replace(/\s*\(.*\)$/, ''), eName = clean(entity?.title), en = entity?.en ? clean(entity.en) : await translate(q), enT = topic ? await translate(topic) : '';
  // entidade: imagem principal do artigo + busca pelo nome exato; nomes de pessoas/lugares não são traduzidos
  const lead = entity?.img ? [{ src: entity.img, thumb: entity.img, w: entity.w, h: entity.h, text: `${eName} ${entity.en || ''} ${entity.desc}`, credit: `Wikipedia · ${eName}`, prov: 'wikimedia', rank: -6 }] : [];
  const qFor = k => k === 'openverse' ? (entity ? en || eName : en) : k === 'wikimedia' ? (entity ? eName : q) : (entity ? (k === 'pexels' ? eName : en || eName) : q);
  const all = [...lead, ...(await Promise.all(active().map(k => SRC[k](qFor(k), ar, cfg.keys[k]).then(l => l.map((x, i) => ({ ...x, prov: k, rank: i }))).catch(() => [])))).flat()];
  const Q = new Set([...toks(q), ...toks(en)]), Tp = new Set([...toks(topic), ...toks(enT), ...toks(clean(ctx?.title)), ...toks(clean(ctx?.en))]), E = new Set([...toks(eName), ...toks(clean(entity?.en))]), seen = new Set();
  return all.filter(x => x.src && !seen.has(x.src) && seen.add(x.src)).map(x => {
    let s = PROVIDERS[x.prov].prior - x.rank * .08;
    const W = new Set(toks(x.text));
    W.forEach(w => s += E.has(w) ? 4 : Q.has(w) ? 2.5 : Tp.has(w) ? 1.2 : 0);
    if (E.size && ![...E].some(w => W.has(w))) s -= 5; // imagem genérica que não mostra a entidade citada
    if (x.w && x.h) { s -= Math.abs(Math.log(x.w / x.h / ar)) * 1.5; if (Math.min(x.w, x.h) < 700) s -= 2; }
    return { ...x, score: s };
  }).sort((a, b) => b.score - a.score);
}

// --- Vídeos (B-roll): Pexels Videos e Pixabay Videos (mesmas chaves das imagens) + Wikimedia Commons (sem chave) ---
const pickFile = (fs, ar) => fs.filter(f => f.link && f.width).sort((a, b) => Math.abs(Math.min(a.width, a.height) - 720) - Math.abs(Math.min(b.width, b.height) - 720) || Math.abs(Math.log(a.width / a.height / ar)) - Math.abs(Math.log(b.width / b.height / ar)))[0];
const VSRC = {
  pexels: (q, ar, k) => get(`https://api.pexels.com/videos/search?query=${enc(q)}&per_page=10&orientation=${ori(ar)[1]}&size=medium`, { Authorization: k })
    .then(d => d.videos.map(v => { const f = pickFile(v.video_files, ar); return f && { src: f.link, thumb: v.image, w: f.width, h: f.height, dur: v.duration, text: (v.url || '').split('/').filter(Boolean).pop()?.replace(/-\d+$/, '').replace(/-/g, ' ') || '', credit: `${v.user?.name || '?'} · Pexels` }; }).filter(Boolean)),
  pixabay: (q, ar, k) => get(`https://pixabay.com/api/videos/?key=${k}&q=${enc(q)}&lang=pt&per_page=12&safesearch=true`)
    .then(d => d.hits.map(h => { const f = h.videos.medium?.url ? h.videos.medium : h.videos.small; return f?.url && { src: f.url, thumb: f.thumbnail || h.videos.small?.thumbnail, w: f.width, h: f.height, dur: h.duration, text: h.tags, credit: `${h.user} · Pixabay` }; }).filter(Boolean)),
  wikimedia: q => get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=640&gsrsearch=${enc(q + ' filetype:video')}`)
    .then(d => Object.values(d.query?.pages || {}).map(p => [p.title, p.imageinfo?.[0]]).filter(([, i]) => i && /webm/.test(i.mime) && i.size < 40e6)
      .map(([t, i]) => ({ src: i.url, thumb: i.thumburl, w: i.width, h: i.height, dur: i.duration, text: (t || '').replace(/^File:|\.\w+$/g, ''), credit: `${strip(i.extmetadata?.Artist?.value) || 'Wikimedia'} · ${i.extmetadata?.LicenseShortName?.value || ''} (Wikimedia)` })))
};
export const videoActive = () => Object.keys(VSRC).filter(k => !cfg.off[k] && !cfg.off.video && (k === 'wikimedia' || cfg.keys[k]));
export async function searchVideos({ q, topic = '', entity }, ar = 16 / 9, min = 2) {
  const clean = t => (t || '').replace(/\s*\(.*\)$/, ''), eName = clean(entity?.title), en = entity?.en ? clean(entity.en) : await translate(q);
  const qFor = k => k === 'wikimedia' ? (entity ? eName : q) : k === 'pexels' ? (entity ? eName : en) : (entity ? en || eName : q);
  const all = (await Promise.all(videoActive().map(k => VSRC[k](qFor(k), ar, cfg.keys[k]).then(l => l.map((x, i) => ({ ...x, prov: k, rank: i, kind: 'video' }))).catch(() => [])))).flat();
  const Q = new Set([...toks(q), ...toks(en)]), Tp = new Set(toks(topic)), E = new Set([...toks(eName), ...toks(clean(entity?.en))]);
  return all.filter(x => !x.dur || x.dur >= min).map(x => {
    let s = 1.5 - x.rank * .1; const W = new Set(toks(x.text));
    W.forEach(w => s += E.has(w) ? 4 : Q.has(w) ? 2.5 : Tp.has(w) ? 1 : 0);
    if (E.size && ![...E].some(w => W.has(w))) s -= 5;
    if (x.w && x.h) s -= Math.abs(Math.log(x.w / x.h / ar)) * 1.5;
    return { ...x, score: s };
  }).sort((a, b) => b.score - a.score);
}
