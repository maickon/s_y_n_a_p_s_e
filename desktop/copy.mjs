// copia o app web (mesmo código do GitHub Pages) para dist/ e embute as bibliotecas de IA que no site vêm de CDN
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

rmSync('dist', { recursive: true, force: true });
for (const f of ['index.html', 'css', 'js', 'vendor', 'hyperframes']) cpSync('../' + f, 'dist/' + f, { recursive: true });

// pacotes npm -> dist/vendor/ai/<pasta> (baixados uma vez e guardados em cache entre builds)
const CACHE = join(tmpdir(), 'synapse-ai-cache'), AI = 'dist/vendor/ai/';
const pkg = spec => {
  const dir = join(CACHE, spec.replace(/[@/]/g, '_'));
  if (!existsSync(join(dir, 'package'))) {
    mkdirSync(dir, { recursive: true });
    const tgz = execSync(`npm pack ${spec} --silent`, { cwd: dir }).toString().trim().split('\n').pop();
    execSync(`tar xzf "${tgz}"`, { cwd: dir });
  }
  return join(dir, 'package');
};
const put = (src, to, files) => { mkdirSync(AI + to, { recursive: true }); for (const f of files) cpSync(join(src, f), AI + to + f.split('/').pop()); };
// troca um trecho exato (falha o build se a versão mudar e o trecho sumir)
const patch = (file, pairs) => { let s = readFileSync(file, 'utf8'); for (const [a, b] of pairs) { if (!s.includes(a)) throw Error(`trecho não encontrado em ${file}: ${a}`); s = s.split(a).join(b); } writeFileSync(file, s); };

// transformers.js (Whisper/CLIP) + seu runtime ONNX
put(join(pkg('@huggingface/transformers@3.8.1'), 'dist'), 'transformers/', ['transformers.min.js', 'ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']);
// voz Piper do navegador (reserva da voz nativa): vits-web + onnxruntime-web 1.18 + fonetizador piper
const vits = join(pkg('@diffusionstudio/vits-web@1.0.3'), 'dist'), chunk = readFileSync(join(vits, 'vits-web.js'), 'utf8').match(/\.\/(piper-[\w-]+\.js)/)[1];
put(vits, 'vits/', ['vits-web.js', chunk]);
put(join(pkg('onnxruntime-web@1.18.0'), 'dist'), 'ort/', ['esm/ort.min.js', 'ort-wasm-simd.wasm', 'ort-wasm-simd-threaded.wasm']);
put(join(pkg('@diffusionstudio/piper-wasm@1.0.0'), 'build'), 'piper/', ['piper_phonemize.js', 'piper_phonemize.wasm', 'piper_phonemize.data']);
patch(AI + 'vits/vits-web.js', [
  ['"https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/"', 'new URL("../ort/", import.meta.url).href'],
  ['"https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize"', 'new URL("../piper/piper_phonemize", import.meta.url).href'],
  ['import("onnxruntime-web")', 'import("../ort/ort.min.js")']
]);
console.log('bibliotecas de IA embutidas em', AI);
