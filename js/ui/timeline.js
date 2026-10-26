// Timeline estilo editor: cenas (miniaturas), onda da voz, legendas e áudio
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const fmt = t => `${t / 60 | 0}:${String(t % 60 | 0).padStart(2, '0')}`;

export function createTimeline(inner, scroll, { onSeek, onSelect, onEdit }) {
  let D = 1, zoom = 1, wave = null, cv = null, sel = -1;
  const head = Object.assign(document.createElement('div'), { className: 'tl-head' });
  const pct = x => `${x / D * 100}%`;
  const drawWave = () => {
    if (!cv || !wave) return;
    const w = cv.width = cv.clientWidth * devicePixelRatio, h = cv.height = cv.clientHeight * devicePixelRatio, g = cv.getContext('2d'), n = wave.length / w;
    g.fillStyle = '#34d39999';
    for (let x = 0; x < w; x++) { let m = 0; for (let i = x * n | 0, e = (x + 1) * n | 0; i < e; i += 8) m = Math.max(m, Math.abs(wave[i])); g.fillRect(x, h / 2 - m * h * .45, 1, Math.max(1, m * h * .9)); }
  };
  function render(d) {
    D = d.duration; wave = d.wave;
    const step = D > 90 ? 10 : D > 30 ? 5 : D > 12 ? 2 : 1;
    const ruler = Array.from({ length: Math.floor(D / step) + 1 }, (_, k) => k * step).map(s => `<span class="tl-tick" style="left:${pct(s)}">${fmt(s)}</span>`).join('');
    const clip = (a, b, cls, html, attr = '') => `<div class="tl-clip ${cls}" ${attr} style="left:${pct(a)};width:${pct(b - a)}">${html}</div>`;
    const scenes = d.segs.map(s => clip(s.a, s.b, '', `<span>${s.scene + 1}</span>`, `data-scene="${s.scene}" title="Cena ${s.scene + 1}" data-bg="${esc(s.img.src)}"`)).join('')
      + (d.intro > .5 ? clip(0, d.intro, 'tl-mark', '<span>Abertura</span>') : '') + (d.outro ? clip(d.outro[0], d.outro[1], 'tl-mark', '<span>Final</span>') : '')
      + (d.breaks || []).map(b => clip(b.a, b.b, 'tl-mark tl-brk', `<span>${b.kind === 'teaser' ? '▶ Teaser' : b.kind === 'chapter' ? `Cap. ${b.n} · ${esc(b.title || '')}` : '◦ Respiro'}</span>`, `title="${b.kind === 'teaser' ? 'Abertura sem narração' : b.kind === 'chapter' ? 'Capítulo ' + b.n + ': ' + esc(b.title || '') : 'Respiro'} · ${(b.b - b.a).toFixed(1)} s"`)).join('');
    const caps = d.caps.map(g => clip(g.s, g.e, 'tl-cap', esc(g.txt), `title="${esc(g.txt)}"`)).join('');
    const audio = clip(0, D, 'tl-aud', `♪ ${esc(d.music)}`) + (d.sting ? clip(0, d.intro, 'tl-sting', '✦') : '');
    inner.innerHTML = `<div class="tl-row tl-ruler">${ruler}</div><div class="tl-row">${scenes}</div><div class="tl-row"><canvas class="absolute inset-0 w-full h-full"></canvas></div><div class="tl-row">${caps}</div><div class="tl-row">${audio}</div>`;
    inner.querySelectorAll('[data-bg]').forEach(e => e.style.backgroundImage = `url("${e.dataset.bg}")`);
    inner.appendChild(head); cv = inner.querySelector('canvas');
    setZoom(zoom); select(sel);
  }
  function setZoom(z) { zoom = z; inner.style.width = `${z * 100}%`; requestAnimationFrame(drawWave); }
  function select(i) { sel = i; inner.querySelectorAll('[data-scene]').forEach(e => e.classList.toggle('sel', +e.dataset.scene === i)); }
  function set(t) {
    head.style.left = pct(t);
    if (zoom > 1) { const x = t / D * inner.clientWidth, v = scroll.scrollLeft, w = scroll.clientWidth - 80; if (x < v || x > v + w) scroll.scrollLeft = x - w * .2; }
  }
  // clique/arraste para navegar; clique na cena seleciona
  const at = e => { const r = inner.getBoundingClientRect(); return Math.max(0, Math.min(D, (e.clientX - r.left) / r.width * D)); };
  let drag = false;
  inner.addEventListener('pointerdown', e => { drag = true; inner.setPointerCapture(e.pointerId); const c = e.target.closest('[data-scene]'); if (c) onSelect(+c.dataset.scene); onSeek(at(e)); });
  inner.addEventListener('pointermove', e => drag && onSeek(at(e)));
  inner.addEventListener('pointerup', () => drag = false);
  inner.addEventListener('dblclick', e => { const c = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-scene]'); if (c) onEdit?.(+c.dataset.scene); });
  addEventListener('resize', () => requestAnimationFrame(drawWave));
  return { render, set, select, setZoom };
}
