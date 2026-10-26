// B-roll: escolhe onde entram vídeos (teaser, capítulos, respiros e poucas cenas), dentro de um limite de tempo
import { searchVideos, videoActive } from '../media/search.js';
import { addVideo, autoQuery } from './assets.js';

export const brkKey = b => `${b.kind}@${b.before}`;
export async function planVideos(track, SCENE, { ar = 16 / 9, topic = '', title = '', budget = .25, max = 8, onStatus } = {}) {
  if (!videoActive().length) return {};
  const tl = track.timeline, q = i => SCENE[i]?.q || autoQuery(tl[i].text), jobs = [];
  (track.breaks || []).forEach(b => jobs.push({ key: brkKey(b), q: b.kind === 'teaser' ? title || topic || q(0) : b.kind === 'chapter' ? b.title || q(b.before) : q(b.before), an: b.kind === 'teaser' ? {} : SCENE[b.before] || {}, need: b.b - b.a, min: 1.5 }));
  // cenas: no máximo uma a cada 5, priorizando as sem pessoa citada (vídeo de banco raramente mostra a pessoa certa)
  for (let i = 2; i < tl.length; i += 5) { const e = SCENE[i]?.entity; jobs.push({ key: 's' + i, scene: i, q: q(i), an: SCENE[i] || {}, need: Math.min(5, tl[i].end - tl[i].start + .5), min: 3, person: e && /^(físic|cientista|ator|atriz|cantor|escritor|polític|jogador|pintor|president|músic|filósof|inventor)/i.test(e.desc || '') }); }
  onStatus?.('BUSCANDO VÍDEOS');
  const R = await Promise.all(jobs.map(j => j.person ? [] : searchVideos({ q: j.q, topic, entity: j.an.entity }, ar).catch(() => [])));
  let left = track.duration * budget, k = 0; const used = new Set(), out = {};
  for (const [n, j] of jobs.entries()) {
    if (k >= max || j.need > left) continue;
    for (const c of R[n].filter(x => x.score >= j.min && !used.has(x.src) && (!x.dur || x.dur >= Math.min(j.need, 4))).slice(0, 2)) {
      try { onStatus?.(`BAIXANDO VÍDEO ${k + 1}`); out[j.key] = await addVideo({ src: c.src, thumb: c.thumb, credit: c.credit, tag: j.q }); used.add(c.src); left -= j.need; k++; break; } catch (e) { console.warn('vídeo', e.message); }
    }
  }
  return out;
}
