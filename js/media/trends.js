// Fontes de tendências (todas chamadas direto do navegador)
const get = u => fetch(u).then(r => r.ok ? r.json() : Promise.reject(r.status));
const enc = encodeURIComponent, fmtN = n => n >= 1e6 ? (n / 1e6).toFixed(1) + ' mi' : n >= 1e3 ? (n / 1e3 | 0) + ' mil' : String(n);
const SKIP = /^(Main_Page|Página_principal|Especial:|Special:|Wikipédia:|Wikipedia:|Ficheiro:|File:|Portal:|Ajuda:|Help:|-$|Search)/i;

export const SOURCES = {
  wiki: { n: 'Wikipedia: mais lidos', icon: 'book-open' },
  yt: { n: 'YouTube: em alta', icon: 'youtube', key: 1 },
  news: { n: 'Notícias (GDELT)', icon: 'newspaper' },
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
    const r = await get(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=${region}&maxResults=40&key=${ytKey}`);
    return r.items.map(v => ({ title: v.snippet.title, sub: `${v.snippet.channelTitle} · ${fmtN(+v.statistics.viewCount)} views`, url: `https://www.youtube.com/watch?v=${v.id}`, thumb: v.snippet.thumbnails?.medium?.url, desc: v.snippet.description }));
  }
  if (src === 'news') {
    const r = await get(`https://api.gdeltproject.org/api/v2/doc/doc?query=${enc((q || 'brasil') + ' sourcelang:portuguese')}&mode=artlist&maxrecords=40&format=json&sort=datedesc&timespan=2d`);
    return (r.articles || []).map(a => ({ title: a.title, sub: `${a.domain} · ${a.seendate?.slice(6, 8)}/${a.seendate?.slice(4, 6)}`, url: a.url, thumb: a.socialimage }));
  }
  if (src === 'hn') {
    const ids = (await get('https://hacker-news.firebaseio.com/v0/topstories.json')).slice(0, 30);
    const it = await Promise.all(ids.map(id => get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null)));
    return it.filter(Boolean).map(x => ({ title: x.title, sub: `${x.score} pontos · ${x.descendants || 0} comentários`, url: x.url || `https://news.ycombinator.com/item?id=${x.id}`, lang: 'en' }));
  }
}
