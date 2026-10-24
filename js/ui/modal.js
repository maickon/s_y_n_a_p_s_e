// Modais do sistema (substituem alert/confirm)
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

function shell(inner, lock = false) {
  const o = document.createElement('div');
  o.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4';
  o.innerHTML = `<div class="w-full max-w-md bg-zinc-950 border border-purple-800/60 rounded-xl shadow-2xl shadow-purple-900/40 p-5 flex flex-col gap-4 text-sm text-zinc-300">${inner}</div>`;
  document.body.appendChild(o);
  return o;
}

export function modal({ title = 'S.Y.N.A.P.S.E', msg = '', html = '', buttons = [{ label: 'OK', value: true, primary: true }], icon = '◈' }) {
  return new Promise(res => {
    const o = shell(`<h3 class="font-bold uppercase tracking-wider text-purple-300 flex gap-2 items-center"><span class="text-emerald-400">${icon}</span>${esc(title)}</h3>
      ${msg ? `<p class="leading-relaxed whitespace-pre-line">${esc(msg)}</p>` : ''}${html}
      <div class="flex justify-end gap-2">${buttons.map((b, i) => `<button data-i="${i}" class="px-4 py-2 rounded-lg font-bold text-xs uppercase ${b.primary ? 'bg-purple-700 hover:bg-purple-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700'}">${esc(b.label)}</button>`).join('')}</div>`);
    const close = v => { o.remove(); document.removeEventListener('keydown', key); res(v); };
    const key = e => e.key === 'Escape' && close(null);
    o.querySelectorAll('[data-i]').forEach(b => b.onclick = () => close(buttons[b.dataset.i].value));
    o.onclick = e => e.target === o && close(null);
    document.addEventListener('keydown', key);
    o.querySelector('.bg-purple-700')?.focus();
  });
}
export const info = (msg, title) => modal({ msg, title });
export const warn = (msg, title = 'Atenção') => modal({ msg, title, icon: '⚠' });
export const ask = (msg, title = 'Confirmar') => modal({ msg, title, buttons: [{ label: 'Cancelar', value: false }, { label: 'Confirmar', value: true, primary: true }] });

// Modal de progresso que trava a tela; mostra prévia do quadro e permite cancelar
export function progress({ title, source }) {
  let cancel = false;
  const o = shell(`<h3 class="font-bold uppercase tracking-wider text-purple-300">◈ ${esc(title)}</h3>
    <canvas width="384" height="216" class="w-full rounded-lg border border-zinc-800 bg-black"></canvas>
    <div class="h-3 rounded-full bg-zinc-800 overflow-hidden"><div class="h-full w-0 bg-gradient-to-r from-purple-600 to-emerald-400 transition-all"></div></div>
    <div class="flex justify-between text-xs text-zinc-400"><span data-t>Preparando...</span><span data-e></span></div>
    <button class="self-end px-4 py-2 rounded-lg font-bold text-xs uppercase bg-red-800 hover:bg-red-700 text-white">Cancelar</button>`);
  const g = o.querySelector('canvas').getContext('2d'), bar = o.querySelector('.h-full'), t0 = Date.now();
  o.querySelector('button').onclick = () => { cancel = true; o.querySelector('[data-t]').textContent = 'Cancelando...'; };
  return {
    get cancelled() { return cancel; },
    set(p, txt) {
      bar.style.width = `${p * 100}%`;
      o.querySelector('[data-t]').textContent = txt || `${p * 100 | 0}%`;
      const el = (Date.now() - t0) / 1e3;
      o.querySelector('[data-e]').textContent = p > .02 ? `restam ~${Math.ceil(el / p - el)}s` : '';
      if (source) g.drawImage(source, 0, 0, 384, 216);
    },
    close: () => o.remove()
  };
}
