// serialização binária de valores com Blob/ArrayBuffer/typed arrays: "SYN1" + u32 tamanho do JSON + JSON + binários
const TA = { Int16Array, Float32Array, Uint8Array, Int32Array, Uint16Array, Float64Array };
export function encode(v) {
  const parts = [], meta = [], put = (b, m) => (parts.push(b), meta.push(m), { $b: meta.length - 1 });
  const json = JSON.stringify(v, function (k, x) {
    x = this[k];
    if (x instanceof Blob) return put(x, { t: x.type, s: x.size, n: x.name });
    if (x instanceof ArrayBuffer) return put(x, { a: 'ArrayBuffer', s: x.byteLength });
    if (ArrayBuffer.isView(x)) return put(x.slice().buffer, { a: x.constructor.name, s: x.byteLength });
    return x;
  });
  const j = new TextEncoder().encode(JSON.stringify({ v: json, m: meta })), h = new DataView(new ArrayBuffer(8));
  h.setUint32(0, 0x53594e31); h.setUint32(4, j.length);
  return new Blob([h, j, ...parts]);
}
export function decode(ab) {
  if (!ab?.byteLength) return undefined;
  const h = new DataView(ab), n = h.getUint32(4), { v, m } = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 8, n)));
  let o = 8 + n;
  const bins = m.map(x => { const b = ab.slice(o, o += x.s); return x.a ? (x.a === 'ArrayBuffer' ? b : new TA[x.a](b)) : x.n != null ? new File([b], x.n, { type: x.t }) : new Blob([b], { type: x.t }); });
  return v === undefined ? undefined : JSON.parse(v, (k, x) => x && typeof x === 'object' && '$b' in x && Object.keys(x).length === 1 ? bins[x.$b] : x);
}
