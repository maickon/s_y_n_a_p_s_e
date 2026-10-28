# S.Y.N.A.P.S.E

Gerador de vídeo procedural 100% client-side: roteiro → voz sintética (TTS) → cenas com imagens/vídeos → mix de áudio → vídeo (MP4/WebM/HyperFrames). Roda como site estático (GitHub Pages) e como app desktop Tauri (`desktop/`) com o **mesmo código web**.

## Stack e regras de ouro
- JS puro em ES modules, **sem bundler, sem framework, sem testes, sem package.json na raiz**. `index.html` carrega `js/main.js` (top-level await).
- Imports "nus" (`three`, `pixi.js`, `pixi-filters`, `mediabunny`, `fflate`, `onnxruntime-web`) resolvem pelo **importmap em `index.html:10`** → arquivos em `vendor/`. Lib nova = arquivo fixo em `vendor/` + entrada no importmap + linha em `vendor/README.md`.
- Modelos de IA (Whisper, CLIP, Piper, Kokoro) vêm de CDN/HuggingFace via `js/cdn.js`; no desktop são embutidos por `desktop/copy.mjs`.
- Tudo que só existe no desktop passa por `js/native.js` (`isDesktop`, `call(cmd)` → comandos Tauri). O navegador deve continuar funcionando sem isso.
- Tailwind é **pré-compilado** em `css/tw.css`. Usou classe nova em `index.html`/`js/` → rode `npx tailwindcss@3.4.16 -i css/tw.src.css -o css/tw.css --minify`. CSS próprio em `css/app.css`.

## Estilo de código (seguir à risca)
- Código **denso**: arrow functions de uma linha, nomes curtos (`el`, `cv`, `comp`, `pl`), várias declarações por `let`/`const`, `$ = id => document.getElementById(id)`.
- Comentários **curtos, em português**, explicando o porquê. Textos de UI em português.
- Funções puras e determinísticas por tempo `t` (render e export usam o mesmo `drawAt`). Aleatoriedade via `rng` semeado (`js/core/script.js`), nunca `Math.random` em render.
- Mensagens de commit: uma linha em português descrevendo a funcionalidade (ver `git log --oneline`).

## Mapa do código (consulte antes de abrir arquivos)
`js/main.js` (~900 linhas, orquestra tudo; seções marcadas por `// --- Nome ---`, use `grep -n "^// ---" js/main.js`):
pipeline = edição → mix → reprodução; "edição ao vivo" com níveis 1 remix áudio / 2 refazer edição / 3 reassociar imagens / 4 re-sintetizar voz.

| Pasta | Responsabilidade |
|---|---|
| `js/core/` | roteiro e direção: `script` (split em cenas, `hash`, `rng`), `scriptgen` (roteiro da Wikipedia), `vtypes` (tipos de vídeo/presets/cartões), `cinema` (teaser, capítulos, respiros), `direct` (direção automática), `broll` (onde entram vídeos), `assets` + `entities` + `keywords` (imagens por cena), `voicetrack`, `words` (alinhamento/legendas/SRT), `styles` (dimensões estéticas), `store` (IndexedDB ↔ disco no desktop), `projects`, `codec` (serialização binária "SYN1") |
| `js/tts/` | `index` (VOICES, `synth`, vozes neurais), `mespeak` + `espeak.worker` |
| `js/audio/` | `dsp` (WSOLA/pitch), `fx` (efeitos de voz), `music` (trilha procedural), `ambience`, `sfx`, `mix` (mixdown offline + ducking), `preview`, `bufstore`, `wav`, `synth`, `util` |
| `js/render/` | PixiJS: `compositor`, `layouts` (W/H, aspectos, 26 layouts, transições, GRADES), `bg` (three.js shader), `captions`, `titles`, `cards`, `vignette` |
| `js/media/` | `search` (imagens/vídeos multi-fonte + ranking), `loader` (proxy CORS wsrv.nl, cache), `audiosearch` (Openverse), `trends` |
| `js/ai/` | `whisper`, `clip` (transformers.js) |
| `js/export/` | `mp4` (Mediabunny/WebCodecs), `ffmpeg` (nativo desktop), `hyperframes` (.zip HTML+GSAP) |
| `js/ui/` | `player`, `timeline`, `controls`, `modal`, `toast`, `audition` |
| `desktop/src-tauri/src/` | Rust: `main.rs` (comandos `#[tauri::command]`), `ffmpeg`, `piper`, `whisper`, `neural` (Python venv), `kv`, `dl` |

## Comandos
- Rodar web: `npx serve .` → Chrome/Edge (WebGPU/WebCodecs).
- Checar sintaxe de todo o JS: `node .claude/scripts/check.mjs` (rode após editar JS — não há testes).
- Desktop: `cd desktop && npm i && npm run dev` (requer Rust; **não instalado nesta máquina**).

## Cuidados
- **Push em `master` que toque `index.html|css|js|vendor|hyperframes|desktop` dispara o workflow `Desktop (Tauri)` e publica uma release nova com auto-update** para os usuários. Nunca dê push sem pedido explícito.
- Não abra arquivos gerados/minificados: `vendor/**`, `css/tw.css`, `Cargo.lock`, `package-lock.json`, ícones. (Bloqueados em `.claude/settings.json`.)
- `main.js` é grande: leia por trechos (`offset/limit` ou `grep -n`), nunca inteiro sem necessidade.
- Ao mudar comando Rust, atualize também quem chama em JS (`call('nome', …)`) e `capabilities/default.json` se precisar de permissão.
