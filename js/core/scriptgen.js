// Gera um roteiro inicial a partir da Wikipedia (em português quando existir)
const get = u => fetch(u).then(r => r.ok ? r.json() : Promise.reject(r.status));
const enc = encodeURIComponent, api = (lang, q) => `https://${lang}.wikipedia.org/w/api.php?format=json&origin=*&${q}`;

// encontra o artigo em pt: título exato, link interlínguas ou busca
export async function findArticle(title, lang = 'pt') {
  if (lang !== 'pt') {
    const r = await get(api(lang, `action=query&prop=langlinks&lllang=pt&titles=${enc(title)}`)).catch(() => null);
    const ll = Object.values(r?.query?.pages || {})[0]?.langlinks?.[0]?.['*'];
    if (ll) return { title: ll, lang: 'pt' };
  }
  const s = await get(api('pt', `action=query&list=search&srlimit=1&srsearch=${enc(title)}`)).catch(() => null);
  const t = s?.query?.search?.[0]?.title;
  return t ? { title: t, lang: 'pt' } : { title, lang };
}

const clean = t => t.replace(/\([^()]*\)/g, '').replace(/\[[^\]]*\]/g, '').replace(/\s+([,.;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
const ABBR = /\b(Sr|Sra|Dr|Dra|Prof|St|etc|a\.C|d\.C|n|nº|vol|cap|ex|p)\.$/i;
export function sentences(text) {
  const out = [];
  for (const par of text.split(/\n+/)) {
    if (/^=+|^\s*$/.test(par) || par.length < 40) continue;
    let buf = '';
    for (const p of clean(par).split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9"“])/)) { buf = buf ? buf + ' ' + p : p; if (!ABBR.test(buf)) { out.push(buf); buf = ''; } }
    if (buf) out.push(buf);
  }
  // frases longas demais viram duas
  return out.flatMap(s => s.length > 220 && s.includes(';') ? s.split(/;\s*/).map(x => x.replace(/[;,]?$/, '.')) : [s]).filter(s => s.length > 15 && s.length < 320);
}

// -> { title, text, url }
export async function scriptFromTopic(topic, { lang = 'pt', size = 10 } = {}) {
  const a = await findArticle(topic, lang);
  const r = await get(api(a.lang, `action=query&prop=extracts&explaintext=1&exsectionformat=plain&redirects=1&titles=${enc(a.title)}`));
  const p = Object.values(r.query.pages)[0];
  if (!p?.extract) throw Error('Artigo não encontrado');
  const ss = sentences(p.extract).slice(0, size);
  return { title: p.title, text: ss.join('\n'), url: `https://${a.lang}.wikipedia.org/wiki/${enc(p.title)}` };
}
