# S.Y.N.A.P.S.E

Gerador de vídeo procedural 100% client-side (GitHub Pages). Texto → voz sintética → cenas → vídeo.

## Status
- [x] Etapa 1: estrutura modular + TTS eSpeak (meSpeak via CDN) com presets robóticos + export WebM/WAV
- [x] Etapa 2: legendas karaokê no canvas (estimativa silábica + Whisper opcional) + SRT
- [x] Etapa 3: imagens (URL `palavra | url`, upload, busca Wikimedia+Openverse, proxy CORS wsrv.nl, CLIP opcional)
- [x] Etapa 4: compositor PixiJS (5 layouts, 6 transições, glitch/RGB split nas trocas, CRT)
- [x] Etapa 5: mixdown offline (música procedural por estilo, 5 ambientes, SFX nas transições, ducking, upload/Openverse)
- [x] Etapa 6: direção automática (intro/outro com créditos, títulos cinéticos, cortes por fala, Variar, editor por cena)
- [ ] Etapa 7: export MP4 (Mediabunny)
- [ ] Etapa 8: composição HyperFrames

## Rodar local
`npx serve .` (ou qualquer servidor estático) → abrir no Chrome/Edge.

## Deploy
Settings → Pages → Branch `master` / root.
