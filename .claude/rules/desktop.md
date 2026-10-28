---
paths:
  - "desktop/**"
  - "js/native.js"
  - ".github/workflows/desktop.yml"
---
# App desktop (Tauri 2)
- `desktop/copy.mjs` copia `index.html css js vendor hyperframes` para `desktop/dist/` e embute libs de IA em `dist/vendor/ai/` (com `patch` que falha o build se o trecho sumir ao trocar versão). Nunca edite `dist/`.
- Comandos Rust ficam em `src-tauri/src/main.rs` (registrados no `invoke_handler`); a lógica pesada vive em módulos (`ffmpeg.rs`, `piper.rs`, `whisper.rs`, `neural.rs`, `kv.rs`, `dl.rs`). O JS chama via `call('nome', args)` de `js/native.js`.
- Binários/modelos (FFmpeg, Piper, whisper small, venv Python) são baixados sob demanda em app_data — não versionar.
- Versão real vem do CI (`0.2.<run_number>`); `tauri.conf.json` fica em 0.1.0. Auto-update assinado (secret `TAURI_SIGNING_PRIVATE_KEY`).
- Rust não está instalado localmente: valide mudanças em Rust com leitura cuidadosa e avise o usuário que só o CI compila.
