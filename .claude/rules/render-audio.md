---
paths:
  - "js/render/**"
  - "js/audio/**"
  - "js/export/**"
---
# Render, áudio e export
- Render é função do tempo: o mesmo quadro em `t` deve sair igual na prévia, no MP4 (Mediabunny), no FFmpeg nativo e no HyperFrames. Não dependa de estado do player nem de relógio real.
- Dimensões vêm de `W`/`H` de `js/render/layouts.js` (mudam com `setAspect` 16:9/9:16/1:1) — nunca fixe 1920×1080.
- Áudio é renderizado offline (`OfflineAudioContext`) a 44.1 kHz mono (`audio/util.js`); a mixagem é cacheada por `mixKey`, então todo parâmetro novo que muda o som precisa entrar na chave.
- Aleatoriedade sempre por `rng(seed)` de `js/core/script.js` para manter "Variar" reproduzível.
