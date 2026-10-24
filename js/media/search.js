// Busca grátis sem chave: Wikimedia Commons + Openverse
const strip = s => (s || '').replace(/<[^>]+>/g, '').trim();
const WM = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=1600&gsrsearch=';
const OV = 'https://api.openverse.org/v1/images/?page_size=8&mature=false&q=';
const get = u => fetch(u).then(r => r.ok ? r.json() : Promise.reject(r.status));

export async function searchImages(q) {
  const [w, o] = await Promise.allSettled([
    get(WM + encodeURIComponent(q + ' filetype:bitmap')).then(d => Object.values(d.query?.pages || {}).map(p => p.imageinfo?.[0])
      .filter(i => i && /jpeg|png|webp/.test(i.mime))
      .map(i => ({ src: i.thumburl || i.url, w: i.thumbwidth, h: i.thumbheight, credit: `${strip(i.extmetadata?.Artist?.value) || 'Wikimedia'} · ${i.extmetadata?.LicenseShortName?.value || ''} (Wikimedia)` }))),
    get(OV + encodeURIComponent(q)).then(d => d.results.map(r => ({ src: r.url, w: r.width, h: r.height, credit: `${r.creator || '?'} · ${r.license.toUpperCase()} ${r.license_version || ''} (Openverse)` })))
  ]);
  // prioriza paisagem (~16:9)
  const ar = x => x.w && x.h ? Math.abs(Math.log(x.w / x.h / 1.78)) : 1;
  return [...(w.value || []), ...(o.value || [])].sort((a, b) => ar(a) - ar(b));
}
