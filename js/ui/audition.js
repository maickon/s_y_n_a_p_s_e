// Prévia rápida de áudio (uma por vez), independente do player do vídeo
let ctx, src, cur;
export const hooks = { onStart: null };
export function stop() {
  try { src?.stop(); } catch { }
  src = null; cur?.classList.remove('playing'); cur = null;
  document.querySelectorAll('audio').forEach(a => a.pause());
}
export function audition(buf, btn) {
  ctx ??= new AudioContext(); ctx.resume(); stop(); hooks.onStart?.();
  src = new AudioBufferSourceNode(ctx, { buffer: buf }); src.connect(ctx.destination); src.start();
  cur = btn; btn?.classList.add('playing');
  const me = src; src.onended = () => me === src && stop();
}
export const playing = btn => cur === btn;

// galeria com ▶ por item; clique no item seleciona
export function gallery(root, { items, value, onPick, render }) {
  const groups = [...new Set(items.map(i => i.group || ''))];
  root.innerHTML = groups.map(g => (g ? `<div class="gal-g">${g}</div>` : '') + items.filter(i => (i.group || '') === g).map(i =>
    `<div class="gi" data-k="${i.key}"><button class="gplay" title="Ouvir"></button><span class="flex-1 truncate">${i.label}</span>${i.sub ? `<small>${i.sub}</small>` : ''}</div>`).join('')).join('');
  let cur = value;
  const select = k => { cur = k; root.querySelectorAll('.gi').forEach(e => e.classList.toggle('on', e.dataset.k === k)); };
  root.onclick = async e => {
    const it = e.target.closest('.gi'); if (!it) return;
    const k = it.dataset.k, b = it.querySelector('.gplay');
    if (e.target === b) {
      if (playing(b)) return stop();
      b.classList.add('loading');
      try { audition(await render(k), b); } catch (err) { console.warn(err); }
      b.classList.remove('loading');
    } else if (k !== cur) { select(k); onPick(k); } // já selecionado: não recarrega
  };
  select(value);
  return { select };
}
