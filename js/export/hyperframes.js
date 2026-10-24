import { zipSync, strToU8 } from 'fflate';
import { toWav } from '../audio/wav.js';
import { posFor } from '../render/titles.js';
import { T } from '../render/layouts.js';

// Exporta o projeto como composição HyperFrames (HTML + GSAP + assets) em .zip
const K = 1.5, X = v => +(v * K).toFixed(1), f = v => +v.toFixed(3);
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const BG = [['#3b0764', '#be185d', '#0e7490'], ['#1e1b4b', '#581c87', '#000'], ['#064e3b', '#4c1d95', '#7f1d1d'], ['#022c22', '#14532d', '#0f172a']];

const jpg = im => new Promise(r => {
  const k = Math.min(1, 1920 / im.width), c = Object.assign(document.createElement('canvas'), { width: im.width * k | 0, height: im.height * k | 0 });
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  c.toBlob(async b => r(new Uint8Array(await b.arrayBuffer())), 'image/jpeg', .9);
});

function layout(s, src, i) {
  const r = s.r, id = `s${i}`, img = (cls, st = '') => `<img id="${id}${cls}" src="${src}" style="position:absolute;${st}">`;
  const fill = 'left:0;top:0;width:100%;height:100%;object-fit:cover;';
  const blur = img('b', fill + 'filter:blur(24px) brightness(.55) saturate(1.3);transform:scale(1.1)');
  const kb = (sel, a, b) => `tl.fromTo('#${id}${sel}',${JSON.stringify(a)},{...${JSON.stringify(b)},duration:${f(s.b - s.a + T)},ease:'none'},${f(s.a)});`;
  switch (s.layout) {
    case 'frame': return [blur + `<div id="${id}c" style="position:absolute;left:14%;top:12%;width:72%;height:74%;border:12px solid #fff;box-shadow:0 20px 40px rgba(0,0,0,.6);background:#000">${img('i', fill.replace('cover', 'contain'))}</div>`,
      kb('c', { rotation: r.rot * 2, scale: 1 }, { rotation: -r.rot * 2, scale: 1.06 })];
    case 'split': return [`<div style="position:absolute;inset:0;background:rgba(0,0,0,.35)"></div><div id="${id}w" style="position:absolute;top:0;${r.side ? 'left' : 'right'}:0;width:56%;height:100%;overflow:hidden;border-${r.side ? 'right' : 'left'}:4px solid #00ff66">${img('i', fill)}</div>`,
      kb('i', { scale: 1.05, x: 0 }, { scale: 1.15, x: (r.side ? -1 : 1) * X(30) })];
    case 'circle': return [blur + `<div id="${id}w" style="position:absolute;width:${X(518)}px;height:${X(518)}px;left:calc(50% + ${(r.side ? -1 : 1) * 18}% - ${X(259)}px);top:calc(50% - ${X(259)}px);border-radius:50%;overflow:hidden;box-shadow:0 0 0 ${X(10)}px #00ff66aa,0 0 0 ${X(22)}px #9d00ff88">${img('i', fill)}</div>`,
      kb('i', { scale: 1.1 }, { scale: 1.25 })];
    case 'double': return [img('i', fill) + img('d', fill + 'mix-blend-mode:screen;opacity:.45;filter:hue-rotate(250deg)'),
      kb('i', { scale: 1.08, x: 0 }, { scale: 1.16, x: r.dx * X(30) }) + kb('d', { scale: 1.5, x: r.dx * X(60) }, { scale: 1.35, x: -r.dx * X(60) })];
    default: return [img('i', fill), kb('i', { scale: r.zin ? 1.04 : 1.18, x: -r.dx * X(25) }, { scale: r.zin ? 1.18 : 1.04, x: r.dx * X(25) })];
  }
}

const ENTER = {
  fade: [{ opacity: 0 }, { opacity: 1 }], zoom: [{ opacity: 0, scale: 1.3, filter: 'blur(14px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)' }],
  pixel: [{ opacity: 0, filter: 'blur(24px)' }, { opacity: 1, filter: 'blur(0px)' }], glitch: [{ opacity: 0, x: -80, skewX: 12 }, { opacity: 1, x: 0, skewX: 0, ease: 'steps(7)' }],
  wipe: [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], slide: [{ xPercent: -100 }, { xPercent: 0 }]
};

export async function exportHyperFrames({ segs, caps, dir, mix, style = 0, title = 'synapse' }) {
  const D = f(mix.duration), files = { 'assets/audio.wav': [new Uint8Array(await toWav(mix).arrayBuffer()), { level: 0 }] }, imgs = new Map();
  for (const s of segs) if (!imgs.has(s.img)) { const p = `assets/img${imgs.size}.jpg`; imgs.set(s.img, p); files[p] = [await jpg(s.img), { level: 0 }]; }
  const H = [], J = [];
  segs.forEach((s, i) => {
    const nx = segs[i + 1], glued = nx && Math.abs(nx.a - s.b) < .01, d = (glued ? s.b + T : s.b) - s.a, [html, js] = layout(s, imgs.get(s.img), i);
    let [a, b] = ENTER[s.trans] || ENTER.fade;
    if (s.trans === 'wipe' && s.r.side) a = { clipPath: 'inset(0 0 0 100%)' }, b = { clipPath: 'inset(0 0 0 0%)' };
    if (s.trans === 'slide' && s.r.side) a = { xPercent: 100 };
    H.push(`<div id="s${i}" class="clip" data-start="${f(s.a)}" data-duration="${f(d)}" data-track-index="2" style="position:absolute;inset:0;overflow:hidden;z-index:${i + 2}">${html}</div>`);
    J.push(js, `tl.fromTo('#s${i}',${JSON.stringify(a)},{...${JSON.stringify(b)},duration:${T}},${f(s.a)});`);
    if (!glued) J.push(`tl.fromTo('#s${i}',{opacity:1},{opacity:0,duration:.5},${f(s.b - .5)});`);
    if (s.credit) H.push(`<div class="clip cred" data-start="${f(s.a)}" data-duration="${f(s.b - s.a)}">${esc(s.credit.slice(0, 80))}</div>`);
  });
  (dir.kin || []).forEach((k, i) => {
    const p = k.pos || posFor(segs.findLast(x => k.a + .3 >= x.a && k.a + .3 < x.b)?.layout), al = p.al === 'center';
    H.push(`<div id="k${i}" class="clip kin" data-start="${f(k.a)}" data-duration="${f(k.b - k.a)}" style="left:${al ? X(p.x - p.mw / 2) : X(p.x)}px;top:${X(p.y) - 70}px;width:${X(p.mw)}px;text-align:${al ? 'center' : 'left'}">${[...k.text].map(c => `<span>${esc(c)}</span>`).join('')}</div>`);
    J.push(`tl.fromTo('#k${i} span',{y:60,opacity:0},{y:0,opacity:1,stagger:.035,duration:.28,ease:'power3.out'},${f(k.a)});tl.to('#k${i}',{opacity:0,letterSpacing:'14px',duration:.35},${f(k.b - .36)});`);
  });
  caps.forEach((g, i) => {
    H.push(`<div id="c${i}" class="clip cap" data-start="${f(g.s - .08)}" data-duration="${f(g.e - g.s + .08)}"><div>${g.words.map((w, j) => `<span id="c${i}w${j}">${esc(w.w.toUpperCase())}</span>`).join(' ')}</div></div>`);
    J.push(`tl.fromTo('#c${i} > div',{y:25,opacity:0},{y:0,opacity:1,duration:.18},${f(g.s - .08)});`);
    g.words.forEach((w, j) => J.push(`tl.fromTo('#c${i}w${j}',{color:'rgba(255,255,255,.45)',scale:1.14,textShadow:'0 0 0 #0000'},{color:'#00ff66',scale:1,textShadow:'0 0 18px #00ff66',duration:.12,immediateRender:false},${f(w.s)});tl.set('#c${i}w${j}',{color:'#fff',textShadow:'none'},${f(w.e)});`));
  });
  const I = dir.intro, O = dir.outro;
  H.push(`<div id="intro" class="clip" data-start="0" data-duration="${f(I.b)}" style="position:absolute;inset:0;z-index:900;background:rgba(0,0,0,.8);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px">
<div class="ln" id="il1"></div><h1 id="it">${esc(I.title)}</h1><div id="is" class="mono">// TRANSMISSÃO 0x${(I.code >>> 0).toString(16).slice(0, 6).toUpperCase()} · S.Y.N.A.P.S.E</div><div class="ln" id="il2"></div></div>`);
  J.push(`tl.fromTo('#il1,#il2',{scaleX:0},{scaleX:1,duration:.8,ease:'power3.out'},0);tl.fromTo('#it',{opacity:0,letterSpacing:'40px',filter:'blur(10px)'},{opacity:1,letterSpacing:'2px',filter:'blur(0px)',duration:1.3,ease:'power4.out'},.25);tl.fromTo('#is',{opacity:0,y:10},{opacity:1,y:0,duration:.6},.9);tl.to('#intro',{opacity:0,duration:.5},${f(I.b - .5)});`);
  H.push(`<div id="outro" class="clip" data-start="${f(O.a)}" data-duration="${f(D - O.a)}" style="position:absolute;inset:0;z-index:900;background:#000;text-align:center"><h2 id="ot">${esc(O.off ? '' : O.title)}</h2><div id="oc" class="mono">${['<b>CRÉDITOS</b>', ...O.credits.map(esc)].join('<br>')}</div></div>`);
  J.push(`tl.fromTo('#outro',{backgroundColor:'rgba(0,0,0,0)'},{backgroundColor:'rgba(0,0,0,.8)',duration:.8},${f(O.a)});tl.fromTo('#ot',{opacity:0,letterSpacing:'30px'},{opacity:1,letterSpacing:'2px',duration:1},${f(O.a)});tl.fromTo('#oc',{y:0,opacity:0},{y:${-26 * K * (O.credits.length + 2)},opacity:1,duration:${f(D - O.a)},ease:'none'},${f(O.a)});tl.to('#fade',{opacity:1,duration:.7},${f(O.b - .7)});`);
  const [c1, c2, c3] = BG[style];
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
body{margin:0;background:#000}
#root{position:relative;width:1920px;height:1080px;overflow:hidden;font-family:'Archivo Black',sans-serif}
#bg{position:absolute;inset:0;background:radial-gradient(circle at 30% 30%,${c1},transparent 55%),radial-gradient(circle at 70% 60%,${c2},transparent 55%),radial-gradient(circle at 50% 100%,${c3},#000 70%);background-size:200% 200%}
.mono{font-family:'JetBrains Mono',monospace}
.cred{position:absolute;right:27px;top:24px;z-index:800;font:20px 'JetBrains Mono',monospace;color:rgba(255,255,255,.55)}
.kin{position:absolute;z-index:850;font-size:${X(80)}px;line-height:1.1;-webkit-text-stroke:3px rgba(0,0,0,.6);text-shadow:0 0 30px #9d00ff}
.kin span{display:inline-block;background:linear-gradient(90deg,#c084fc,#00ff66);-webkit-background-clip:text;color:transparent}
.cap{position:absolute;left:0;right:0;bottom:${X(55)}px;z-index:860;text-align:center}
.cap>div{display:inline-block;padding:${X(12)}px ${X(28)}px;border-radius:21px;background:rgba(0,0,0,.62);border:3px solid rgba(0,255,102,.35);font-size:${X(44)}px;color:rgba(255,255,255,.45)}
.cap span{display:inline-block}
.ln{width:${X(794)}px;height:3px;background:#00ff66}
#it{margin:0;font-size:${X(78)}px;color:#fff;text-shadow:0 0 40px #9d00ff}
#is{color:#00ff66;font-size:26px}
#ot{margin:${X(180)}px 0 ${X(50)}px;font-size:${X(54)}px;color:#fff;text-shadow:0 0 30px #ff0055}
#oc{color:rgba(209,213,219,.85);font-size:21px;line-height:${26 * K}px}
#scan{position:absolute;inset:0;z-index:950;pointer-events:none;background:repeating-linear-gradient(rgba(0,0,0,0) 0 3px,rgba(0,0,0,.18) 3px 6px)}
#fade{position:absolute;inset:0;z-index:999;background:#000;opacity:0}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${D}" data-width="1920" data-height="1080" data-fps="30">
<div id="bg"></div>
<audio id="mix" class="clip" src="assets/audio.wav" data-start="0" data-duration="${D}" data-track-index="1" data-volume="1"></audio>
${H.join('\n')}
<div id="scan"></div><div id="fade"></div>
</div>
<script>
const tl = gsap.timeline({ paused: true });
tl.fromTo('#bg',{backgroundPosition:'0% 0%'},{backgroundPosition:'100% 100%',duration:${D},ease:'none'},0);
${J.join('\n')}
window.__timelines = window.__timelines || {};
window.__timelines["main"] = tl;
</script>
</body>
</html>`;
  files['index.html'] = strToU8(html);
  files['README.md'] = strToU8(`# ${title}\n\nComposição HyperFrames exportada pelo S.Y.N.A.P.S.E.\n\n\`\`\`bash\nnpx hyperframes preview          # abrir no Studio\nnpx hyperframes render -o video.mp4 --quality delivery\n\`\`\`\n\nRequer Node.js >= 22 e FFmpeg.\n`);
  return new Blob([zipSync(files)], { type: 'application/zip' });
}
