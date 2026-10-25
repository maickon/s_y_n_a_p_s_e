// Fontes de tendências (navegador direto; no desktop, notícias vêm por requisição nativa, sem CORS)
import { isDesktop, call } from '../native.js';
const get = u => fetch(u).then(r => r.ok ? r.json() : Promise.reject(r.status));
const txt = u => fetch(u).then(r => r.ok ? r.text() : Promise.reject(r.status));
const timeout = (p, ms = 12e3) => Promise.race([p, new Promise((_, no) => setTimeout(() => no('timeout'), ms))]);
// erros comuns da chave do YouTube -> instrução clara
const YT_ERR = { API_KEY_SERVICE_BLOCKED: 'A chave está restrita e não permite a YouTube Data API v3. No Google Cloud: Credenciais → sua chave → Restrições de API → inclua "YouTube Data API v3" (ou "Não restringir").', SERVICE_DISABLED: 'A YouTube Data API v3 não está ativada no projeto. No Google Cloud: APIs e serviços → Biblioteca → "YouTube Data API v3" → Ativar.', API_KEY_INVALID: 'Chave inválida. Copie de novo em Google Cloud → Credenciais.', API_KEY_HTTP_REFERRER_BLOCKED: 'A chave só aceita certos sites. Em Restrições de aplicativo, adicione o endereço deste app (ex.: https://maickon.github.io/*) ou use "Nenhuma".', quotaExceeded: 'Cota diária da chave esgotada. Tente amanhã.' };
// Google Notícias (RSS) -> itens
const GN = q => q ? `https://news.google.com/rss/search?q=${enc(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419` : 'https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419';
const dm = d => { const x = new Date(d); return isNaN(x) ? '' : ` · ${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}`; };
function rss(x) {
  const it = typeof x === 'string' ? [...new DOMParser().parseFromString(x, 'text/xml').querySelectorAll('item')].map(i => ({ title: i.querySelector('title')?.textContent, link: i.querySelector('link')?.textContent, pubDate: i.querySelector('pubDate')?.textContent, src: i.querySelector('source')?.textContent })) : x.items;
  if (!it?.length) throw Error('vazio');
  return it.slice(0, 40).map(a => { const [t, s] = (a.title || '').split(/ - (?=[^-]+$)/); return { title: t, sub: (a.src || s || 'Google Notícias') + dm(a.pubDate), url: a.link }; });
}
async function news(q) {
  const gd = `https://api.gdeltproject.org/api/v2/doc/doc?query=${enc((q || 'brasil') + ' sourcelang:portuguese')}&mode=artlist&maxrecords=40&format=json&sort=datedesc&timespan=2d`;
  const gdelt = r => { if (!r.articles?.length) throw Error('vazio'); return r.articles.map(a => ({ title: a.title, sub: `${a.domain} · ${a.seendate?.slice(6, 8)}/${a.seendate?.slice(4, 6)}`, url: a.url, thumb: a.socialimage })); };
  const tries = isDesktop ? [() => call('http_get', { url: GN(q) }).then(rss), () => call('http_get', { url: gd }).then(t => gdelt(JSON.parse(t)))]
    : [() => get(gd).then(gdelt), () => get(`https://api.rss2json.com/v1/api.json?rss_url=${enc(GN(q))}`).then(rss), () => txt(`https://api.allorigins.win/raw?url=${enc(GN(q))}`).then(rss), () => txt(`https://api.codetabs.com/v1/proxy/?quest=${enc(GN(q))}`).then(rss)];
  for (const t of tries) try { return await timeout(t()); } catch { }
  throw Error('Nenhuma fonte de notícias respondeu agora (GDELT e Google Notícias). Tente de novo em alguns segundos.');
}
const enc = encodeURIComponent, fmtN = n => n >= 1e6 ? (n / 1e6).toFixed(1) + ' mi' : n >= 1e3 ? (n / 1e3 | 0) + ' mil' : String(n);
const SKIP = /^(Main_Page|Página_principal|Especial:|Special:|Wikipédia:|Wikipedia:|Ficheiro:|File:|Portal:|Ajuda:|Help:|-$|Search)/i;

export const SOURCES = {
  wiki: { n: 'Wikipedia: mais lidos', icon: 'book-open' },
  yt: { n: 'YouTube: em alta', icon: 'youtube', key: 1 },
  news: { n: 'Notícias (Google/GDELT)', icon: 'newspaper' },
  hn: { n: 'Tecnologia (Hacker News)', icon: 'cpu' }
};
export const EXTERNAL = [['Google Trends', 'https://trends.google.com/trending?geo=BR&hl=pt-BR'], ['Google Notícias', 'https://news.google.com/?hl=pt-BR&gl=BR&ceid=BR:pt-419'], ['YouTube em alta', 'https://www.youtube.com/feed/trending']];

// -> [{ title, sub, url, wiki? (título exato do artigo), lang }]
export async function trends(src, { lang = 'pt', q = '', ytKey, region = 'BR' } = {}) {
  if (src === 'wiki') {
    for (let back = 1; back <= 3; back++) {
      const d = new Date(Date.now() - back * 864e5), p = n => String(n).padStart(2, '0');
      try {
        const r = await get(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${lang}.wikipedia/all-access/${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`);
        return r.items[0].articles.filter(a => !SKIP.test(a.article)).slice(0, 40)
          .map(a => ({ title: a.article.replace(/_/g, ' '), sub: `${fmtN(a.views)} leituras ontem`, url: `https://${lang}.wikipedia.org/wiki/${enc(a.article)}`, wiki: a.article, lang }));
      } catch { }
    }
    throw Error('Wikipedia indisponível');
  }
  if (src === 'yt') {
    if (!ytKey) throw Error('Informe a chave grátis da YouTube Data API');
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=${region}&maxResults=40&key=${enc(ytKey.trim())}`), r = await res.json().catch(() => ({}));
    if (!res.ok) { const e = r.error || {}, why = e.details?.find(d => d.reason)?.reason || e.errors?.[0]?.reason; throw Error(YT_ERR[why] || `YouTube recusou (${e.code || res.status}): ${e.message || why || 'erro'}`); }
    return r.items.map(v => ({ title: v.snippet.title, sub: `${v.snippet.channelTitle} · ${fmtN(+v.statistics.viewCount)} views`, url: `https://www.youtube.com/watch?v=${v.id}`, thumb: v.snippet.thumbnails?.medium?.url, desc: v.snippet.description }));
  }
  if (src === 'news') return news(q);
  if (src === 'hn') {
    const ids = (await get('https://hacker-news.firebaseio.com/v0/topstories.json')).slice(0, 30);
    const it = await Promise.all(ids.map(id => get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null)));
    return it.filter(Boolean).map(x => ({ title: x.title, sub: `${x.score} pontos · ${x.descendants || 0} comentários`, url: x.url || `https://news.ycombinator.com/item?id=${x.id}`, lang: 'en' }));
  }
}
