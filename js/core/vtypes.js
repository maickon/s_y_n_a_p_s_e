import { keywords } from './keywords.js';

// Tipos de vídeo: estrutura do roteiro, cartões, sobreposições, direção e ajustes automáticos
export const TYPES = {
  doc: { n: 'Documentário', d: 'Narração contínua' },
  top: { n: 'Top N', d: 'Ranking numerado, do último ao primeiro' },
  sabia: { n: 'Você sabia?', d: 'Fatos curiosos em perguntas' },
  timeline: { n: 'Linha do tempo', d: 'Fatos ordenados por ano' },
  mystery: { n: 'Mistério', d: 'Suspense e clima noir' },
  news: { n: 'Notícia do dia', d: 'Estilo telejornal' },
  steps: { n: 'Passo a passo', d: 'Tutorial em etapas' }
};
// ajustes automáticos (índice do estilo, legenda, perfil musical, efeitos, ambiente, tratamento)
export const PRESETS = {
  top: { style: 6, cap: 'outline', prof: '6', sfx: 'cinematic', amb: 'auto' },
  sabia: { style: 7, cap: 'highlight', prof: '5', sfx: 'organic', amb: 'auto' },
  timeline: { style: 5, cap: 'doc', prof: '5', sfx: 'organic', amb: 'projector', grade: 'auto' },
  mystery: { style: 4, cap: 'typewriter', prof: '4', sfx: 'cinematic', amb: 'rain' },
  news: { style: 10, cap: 'lower', prof: '6', sfx: 'subtle', amb: 'none' },
  steps: { style: 10, cap: 'minimal', prof: '0', sfx: 'subtle', amb: 'none' }
};
// pesos extras de layout/transição por tipo
export const WEIGHTS = {
  top: { lw: { frame: 3, push: 3, zoomout: 3, polaroid: 2 }, tw: { zoom: 3, whip: 3, flash: 3, shake: 2 } },
  sabia: { lw: { circle: 3, polaroid: 3, zoomout: 3, window: 2 }, tw: { flash: 3, iris: 3, lightleak: 2 } },
  timeline: { lw: { archive: 5, polaroid: 4, filmstrip: 4, frame: 3, tv: 2 }, tw: { burn: 3, dissolve: 4, lightleak: 3, dipblack: 2 } },
  mystery: { lw: { focus: 5, vignette: 5, spotlight: 5, push: 3 }, tw: { dipblack: 6, blur: 4, dissolve: 3, warp: 2 } },
  news: { lw: { window: 5, split: 4, full: 3, letterbox: 2 }, tw: { slide: 4, wipe: 4, push: 3, dissolve: 2 } },
  steps: { lw: { window: 5, frame: 4, split: 3 }, tw: { slide: 4, push: 3, fade: 3 } }
};

const lower1 = s => s.charAt(0).toLowerCase() + s.slice(1), noDot = s => s.replace(/[.!?…]+$/, '');
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
const YEAR = /\b(\d{3,4})(\s*a\.C\.)?/;
const label = s => s.replace(/^(em|no|na|por volta de)\s+[\d\s]+(a\.C\.)?,?\s*/i, '').split(/[,;:]/)[0].split(/\s+/).slice(0, 5).join(' ');

// lê os marcadores de cada linha → { say: texto falado, card }
export function parseScene(t, type, i, all) {
  let m;
  if (type === 'top' && (m = t.match(/^#\s*(\d+)\s*[-–:.]?\s*(.*)$/))) return { say: `Número ${m[1]}.`, card: { kind: 'number', big: '#' + m[1], label: noDot(m[2] || ''), hold: 1 } };
  if (type === 'steps' && (m = t.match(/^passo\s*(\d+)\s*[:.\-–]\s*(.*)$/i))) return { say: t, card: { kind: 'step', big: m[1], label: noDot(m[2]), total: all.filter(x => /^passo\s*\d+/i.test(x)).length } };
  if (type === 'timeline' && (m = t.match(/^(\d{1,4}(?:\s*a\.C\.)?)\s*[|:–-]\s*(.*)$/))) return { say: m[2].includes(m[1].replace(/\s*a\.C\./, '')) ? m[2] : `Em ${m[1]}, ${/^(A|O|As|Os|Um|Uma|Uns|Umas|Este|Esta|Esse|Essa)\b/.test(m[2]) ? lower1(m[2]) : m[2]}`, card: { kind: 'year', big: m[1] } };
  if (type === 'sabia' && /^você sabia/i.test(t)) return { say: t, card: { kind: 'question', big: '?', label: 'VOCÊ SABIA?' } };
  if (type === 'news' && i === 0) return { say: t.replace(/^urgente\s*[:\-–]\s*/i, 'Urgente: '), card: { kind: 'headline', label: noDot(t.replace(/^urgente\s*[:\-–]\s*/i, '')) } };
  if (type === 'mystery' && i === 0 && /\?$/.test(t)) return { say: t, card: { kind: 'mystery', label: noDot(t) } };
  return { say: t, card: null };
}

// monta o roteiro no formato do tipo, a partir de frases soltas
// contrações do português (de + as = das, em + o = no...)
const contr = t => t.replace(/\b(de|em|por) (o|a|os|as)\b/g, (m, p, a) => ({ de: 'd', em: 'n', por: 'pel' }[p] + (p === 'por' ? { o: 'o', a: 'a', os: 'os', as: 'as' }[a] : a)));

export function formatScript(type, ss, opt = {}) { return contr(formatRaw(type, ss, opt)); }
function formatRaw(type, ss, { n = 5, title = '' } = {}) {
  const T = title || keywords(ss.join(' '), 2).join(' ');
  if (type === 'top') {
    const it = ss.slice(0, n);
    return [`Os ${it.length} fatos mais impressionantes sobre ${T}.`, ...it.flatMap((s, k) => [`#${it.length - k} ${cap1(label(s))}`, s])].join('\n');
  }
  if (type === 'sabia') return [`Você sabia? Curiosidades sobre ${T}.`, ...ss.map(s => `Você sabia que ${lower1(noDot(s))}?`)].join('\n');
  if (type === 'timeline') {
    const d = ss.map(s => [s, s.match(YEAR)]).filter(([, m]) => m).map(([s, m]) => [s, m[0], (m[2] ? -1 : 1) * +m[1]]).sort((a, b) => a[2] - b[2]);
    return d.length >= 2 ? [`Linha do tempo: ${T}, em ${d.length} momentos.`, ...d.map(([s, y]) => `${y} | ${cap1(s.replace(new RegExp('^(em|no ano de)\\s+' + y.replace(/\./g, '\\.') + ',?\\s*', 'i'), ''))}`)].join('\n') : ss.join('\n');
  }
  if (type === 'mystery') return [`O que realmente se esconde por trás de ${T}?`, ...ss, 'Até hoje, nem todas as respostas foram encontradas.'].join('\n');
  if (type === 'news') return [`Urgente: ${T}.`, ...ss, 'Continue acompanhando para mais atualizações.'].join('\n');
  if (type === 'steps') return ss.map((s, k) => `Passo ${k + 1}: ${s}`).join('\n');
  return ss.join('\n');
}

// sons ao revelar cada cartão
export const cardEvents = (cards, tl) => cards.flatMap((c, i) => !c || !tl[i] ? [] : ({ number: [['hit', 1], ['riser', .7, -1]], step: [['shutter', .8]], year: [['whooshSoft', .9], ['projector', .6]], question: [['chimes', .9]], headline: [['stutter', .8], ['boom', .8]], mystery: [['heartbeat', 1]] }[c.kind] || [])
  .map(([n, v, dt = 0]) => ({ n, t: Math.max(.05, tl[i].start - .05 + dt), v })));
