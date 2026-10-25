#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod dl;
mod ffmpeg;
mod piper;
mod whisper;
use std::sync::Arc;
use tauri::{ipc::{InvokeBody, Request, Response}, AppHandle, State};

pub fn hash(s: &str) -> u64 { s.bytes().fold(1469598103934665603u64, |h, b| (h ^ b as u64).wrapping_mul(1099511628211)) }
type R<T> = Result<T, String>;
fn raw<'a>(r: &'a Request<'_>) -> R<&'a [u8]> { match r.body() { InvokeBody::Raw(b) => Ok(b), _ => Err("corpo binário esperado".into()) } }
fn hdr(r: &Request<'_>, k: &str) -> String { r.headers().get(k).and_then(|v| v.to_str().ok()).unwrap_or("").to_string() }
async fn blocking<T: Send + 'static>(f: impl FnOnce() -> R<T> + Send + 'static) -> R<T> { tauri::async_runtime::spawn_blocking(f).await.map_err(|e| e.to_string())? }

// informações do sistema para o front (ponte nativa)
#[tauri::command]
fn info() -> serde_json::Value {
    serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "cpus": std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1),
        "version": env!("CARGO_PKG_VERSION"),
        "features": ["piper", "ffmpeg", "whisper"]
    })
}

// voz Piper nativa -> WAV (ArrayBuffer no JS)
#[tauri::command]
async fn piper_tts(app: AppHandle, st: State<'_, Arc<piper::Piper>>, text: String, voice: String, speed: f64) -> R<Response> {
    let p = st.inner().clone();
    blocking(move || p.say(&app, &text, &voice, speed).map(Response::new)).await
}

// Whisper nativo: corpo = PCM f32 mono 16 kHz
#[tauri::command]
async fn whisper(app: AppHandle, st: State<'_, Arc<whisper::Asr>>, req: Request<'_>) -> R<serde_json::Value> {
    let (a, b) = (st.inner().clone(), raw(&req)?);
    let pcm: Vec<f32> = b.chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect();
    blocking(move || a.run(&app, &pcm)).await
}

// FFmpeg: início (corpo = WAV; cabeçalhos w/h/fps/name), quadros RGBA, fim e cancelamento
#[tauri::command]
async fn ff_start(app: AppHandle, st: State<'_, Arc<ffmpeg::Ff>>, req: Request<'_>) -> R<String> {
    let (f, wav) = (st.inner().clone(), raw(&req)?.to_vec());
    let n = |k| hdr(&req, k).parse::<u32>().map_err(|_| format!("{k} inválido"));
    let (w, h, fps, name) = (n("w")?, n("h")?, n("fps")?, hdr(&req, "name"));
    blocking(move || f.start(&app, w, h, fps, &name, &wav)).await
}
#[tauri::command]
async fn ff_frame(st: State<'_, Arc<ffmpeg::Ff>>, req: Request<'_>) -> R<()> {
    let (f, b) = (st.inner().clone(), raw(&req)?.to_vec());
    blocking(move || f.frame(&b)).await
}
#[tauri::command]
async fn ff_finish(st: State<'_, Arc<ffmpeg::Ff>>) -> R<String> { let f = st.inner().clone(); blocking(move || f.finish()).await }
#[tauri::command]
fn ff_cancel(st: State<'_, Arc<ffmpeg::Ff>>) { st.cancel() }
#[tauri::command]
fn reveal(path: String) { ffmpeg::reveal(&path) }

fn main() {
    tauri::Builder::default()
        .manage(Arc::new(piper::Piper::default()))
        .manage(Arc::new(ffmpeg::Ff::default()))
        .manage(Arc::new(whisper::Asr::default()))
        .invoke_handler(tauri::generate_handler![info, piper_tts, whisper, ff_start, ff_frame, ff_finish, ff_cancel, reveal])
        .run(tauri::generate_context!())
        .expect("falha ao iniciar o S.Y.N.A.P.S.E");
}
