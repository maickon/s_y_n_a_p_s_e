// Painel flutuante de progresso (etapa atual, barra, % e tempo restante)
const el = document.createElement('div');
el.className = 'ptoast';
el.innerHTML = '<div class="flex items-center gap-2"><span class="pspin"></span><b data-l></b><span class="flex-1"></span><span data-p class="tabular-nums text-emerald-300"></span></div><div class="pbar"><i></i></div><div class="flex justify-between text-[10px] text-zinc-500"><span data-s></span><span data-e></span></div>';
document.body.appendChild(el);
let stage = '', t0 = 0, hideT;
const $ = s => el.querySelector(s), fmt = s => s < 60 ? `${Math.ceil(s)}s` : `${s / 60 | 0}min ${Math.ceil(s % 60)}s`;

// p = 0..1 ou null (indeterminado)
export function progress(label, p = null, sub = '') {
  clearTimeout(hideT); el.classList.add('on');
  if (label !== stage) { stage = label; t0 = performance.now(); }
  $('[data-l]').textContent = label; $('[data-s]').textContent = sub;
  const bar = $('.pbar'); bar.classList.toggle('ind', p == null);
  $('.pbar i').style.width = p == null ? '' : `${Math.min(100, p * 100)}%`;
  $('[data-p]').textContent = p == null ? '' : `${p * 100 | 0}%`;
  const el_ = (performance.now() - t0) / 1e3;
  $('[data-e]').textContent = p > .04 && el_ > 1 ? `restam ~${fmt(el_ / p - el_)}` : '';
}
export const done = (ms = 600) => { clearTimeout(hideT); hideT = setTimeout(() => { el.classList.remove('on'); stage = ''; }, ms); };
