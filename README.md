# S.Y.N.A.P.S.E

Gerador de vídeo procedural 100% client-side (GitHub Pages). Texto → voz sintética → cenas → vídeo.

## Status
- [x] Etapa 1: estrutura modular + TTS eSpeak (meSpeak via CDN) com presets robóticos + export WebM/WAV
- [x] Etapa 2: legendas karaokê no canvas (estimativa silábica + Whisper opcional) + SRT
- [ ] Etapa 3: imagens (URL, upload, Openverse) + CLIP
- [ ] Etapa 4: compositor PixiJS
- [ ] Etapa 5: trilhas, ambientes e efeitos + ducking
- [ ] Etapa 6: timeline automática GSAP
- [ ] Etapa 7: export MP4 (Mediabunny)
- [ ] Etapa 8: composição HyperFrames

## Rodar local
`npx serve .` (ou qualquer servidor estático) → abrir no Chrome/Edge.

## Deploy
Settings → Pages → Branch `master` / root.
