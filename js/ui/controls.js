// Controles com o visual do sistema (substituem a interface nativa do navegador)
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
let pop = null;
const close = () => { pop?.remove(); pop = null; };
addEventListener('click', e => pop && !pop.contains(e.target) && close());
addEventListener('resize', close);
document.addEventListener('scroll', e => pop && !pop.contains(e.target) && close(), true);

function place(p, b, w) {
  const r = b.getBoundingClientRect(); document.body.appendChild(p);
  p.style.minWidth = `${Math.max(r.width, w)}px`; p.style.left = `${Math.min(r.left, innerWidth - p.offsetWidth - 8)}px`;
  const below = innerHeight - r.bottom - 8, h = p.offsetHeight;
  p.style.top = `${h > below && r.top > below ? r.top - h - 4 : r.bottom + 4}px`;
}
// intercepta "value" para manter o rótulo em sincronia
const watch = (el, proto, fn) => { const d = Object.getOwnPropertyDescriptor(proto, 'value'); Object.defineProperty(el, 'value', { get() { return d.get.call(el); }, set(v) { d.set.call(el, v); fn(); } }); };

export function enhanceSelects(root = document) {
  root.querySelectorAll('select:not(.hidden):not([data-cx])').forEach(s => {
    s.dataset.cx = 1;
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'csel ' + s.className });
    s.after(b); s.style.display = 'none';
    const label = () => { const o = s.selectedOptions[0]; b.innerHTML = `<span class="truncate" style="${o?.getAttribute('style') || ''}">${o ? esc(o.text) : ''}</span>`; };
    watch(s, HTMLSelectElement.prototype, label);
    s.addEventListener('change', label);
    new MutationObserver(label).observe(s, { childList: true, subtree: true });
    b.onclick = e => { e.stopPropagation(); pop ? close() : openSel(s, b); };
    label();
  });
}
function openSel(s, b) {
  const p = pop = Object.assign(document.createElement('div'), { className: 'cpop' });
  const opt = o => `<div class="copt ${o.selected ? 'on' : ''}" data-v="${esc(o.value)}" style="${o.getAttribute('style') || ''}">${esc(o.text)}</div>`;
  p.innerHTML = [...s.children].map(c => c.tagName === 'OPTGROUP' ? `<div class="cgrp">${esc(c.label)}</div>` + [...c.children].map(opt).join('') : opt(c)).join('');
  place(p, b, 180);
  const items = [...p.querySelectorAll('.copt')];
  let i = Math.max(0, items.findIndex(x => x.classList.contains('on')));
  const act = k => { items.forEach(x => x.classList.remove('act')); i = (k + items.length) % items.length; items[i].classList.add('act'); items[i].scrollIntoView({ block: 'nearest' }); };
  const choose = v => { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); close(); b.focus(); };
  act(i);
  p.onclick = e => { const o = e.target.closest('.copt'); if (o) { e.stopPropagation(); choose(o.dataset.v); } };
  p.onmousemove = e => { const o = e.target.closest('.copt'); if (o) act(items.indexOf(o)); };
  const key = e => {
    if (pop !== p) return removeEventListener('keydown', key, true);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); act(i + (e.key === 'ArrowDown' ? 1 : -1)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(items[i].dataset.v); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  };
  addEventListener('keydown', key, true);
}

const SW = ['#ffffff', '#e5e7eb', '#a1a1aa', '#18181b', '#000000', '#fde047', '#facc15', '#f97316', '#ef4444', '#e11d48', '#ff3366', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#38bdf8', '#22d3ee', '#14b8a6', '#10b981', '#00ff66', '#84cc16', '#a3e635'];
export function enhanceColors(root = document) {
  root.querySelectorAll('input[type=color]:not([data-cx])').forEach(c => {
    c.dataset.cx = 1;
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'cswatch', title: c.title });
    c.after(b); c.style.display = 'none';
    const sync = () => b.style.background = c.value;
    watch(c, HTMLInputElement.prototype, sync); sync();
    b.onclick = e => {
      e.stopPropagation(); if (pop) return close();
      const p = pop = Object.assign(document.createElement('div'), { className: 'cpop p-2' });
      p.innerHTML = `<div class="grid grid-cols-6 gap-1.5">${SW.map(v => `<button data-c="${v}" class="w-6 h-6 rounded-md border border-zinc-700 hover:scale-110 transition" style="background:${v}"></button>`).join('')}</div>
        <input class="inp !p-1.5 mt-2 text-[11px]" value="${c.value}" maxlength="7">`;
      place(p, b, 190);
      const set = v => { if (!/^#[0-9a-f]{6}$/i.test(v)) return; c.value = v; c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true })); };
      p.onclick = e => { e.stopPropagation(); if (e.target.dataset.c) { set(e.target.dataset.c); close(); } };
      p.querySelector('input').oninput = e => set(e.target.value);
    };
  });
}

// trilho preenchido dos sliders
export const refreshRanges = (root = document) => root.querySelectorAll('input[type=range]').forEach(r => r.style.setProperty('--p', `${(r.value - r.min) / (r.max - r.min) * 100}%`));
addEventListener('input', e => e.target.type === 'range' && refreshRanges(e.target.parentNode));

// tooltips do sistema no lugar do "title" nativo
export function tooltips() {
  const tip = Object.assign(document.createElement('div'), { className: 'ctip' }); document.body.appendChild(tip);
  document.addEventListener('mouseover', e => {
    const t = e.target.closest('[title],[data-tip]'); if (!t) return tip.classList.remove('on');
    if (t.title) { t.dataset.tip = t.title; t.removeAttribute('title'); }
    if (!t.dataset.tip) return;
    tip.textContent = t.dataset.tip; tip.classList.add('on');
    const r = t.getBoundingClientRect(), w = tip.offsetWidth;
    tip.style.left = `${Math.max(6, Math.min(innerWidth - w - 6, r.left + r.width / 2 - w / 2))}px`; tip.style.top = `${r.top > 40 ? r.top - tip.offsetHeight - 6 : r.bottom + 6}px`;
  });
  document.addEventListener('mouseout', e => !e.relatedTarget?.closest?.('[data-tip]') && tip.classList.remove('on'));
}
export function enhance(root = document) { enhanceSelects(root); enhanceColors(root); refreshRanges(root); }
