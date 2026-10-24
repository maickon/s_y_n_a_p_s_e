export const proxy = u => `https://wsrv.nl/?url=${encodeURIComponent(u)}&w=1920&h=1920&fit=inside&output=webp`;

const img = src => new Promise((ok, no) => {
  const i = new Image(), t = setTimeout(() => no(Error('timeout')), 15e3);
  i.crossOrigin = 'anonymous';
  i.onload = () => (clearTimeout(t), ok(i)); i.onerror = () => (clearTimeout(t), no(Error('load ' + src)));
  i.src = src;
});

// tenta direto (CORS) e cai para o proxy
export const loadImage = async u => /^(blob|data):/.test(u) ? img(u) : img(u).catch(() => img(proxy(u)));
