import { CDN } from '../cdn.js';

let p;
const load = () => p ??= import(CDN.transformers).then(async T => {
  const id = CDN.clip;
  const [tok, proc, tm, vm] = await Promise.all([T.AutoTokenizer.from_pretrained(id), T.AutoProcessor.from_pretrained(id),
    T.CLIPTextModelWithProjection.from_pretrained(id), T.CLIPVisionModelWithProjection.from_pretrained(id)]);
  return { T, tok, proc, tm, vm };
}).catch(e => { p = null; throw e; });

const unit = v => { const n = Math.hypot(...v); return v.map(x => x / n); };

// matriz de similaridade [texto][imagem]
export async function clipMatrix(texts, imgs) {
  const { T, tok, proc, tm, vm } = await load();
  const te = (await tm(tok(texts, { padding: true, truncation: true }))).text_embeds.tolist().map(unit);
  const c = Object.assign(document.createElement('canvas'), { width: 224, height: 224 }), g = c.getContext('2d');
  const ie = [];
  for (const im of imgs) {
    g.drawImage(im, 0, 0, 224, 224);
    ie.push(unit((await vm(await proc(T.RawImage.fromCanvas(c)))).image_embeds.tolist()[0]));
  }
  return te.map(t => ie.map(i => t.reduce((s, x, k) => s + x * i[k], 0)));
}
