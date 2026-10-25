#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod piper;
use std::sync::Arc;
use tauri::{ipc::Response, AppHandle, State};

pub fn hash(s: &str) -> u64 { s.bytes().fold(1469598103934665603u64, |h, b| (h ^ b as u64).wrapping_mul(1099511628211)) }

// informações do sistema para o front (ponte nativa)
#[tauri::command]
fn info() -> serde_json::Value {
    serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "cpus": std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1),
        "version": env!("CARGO_PKG_VERSION"),
        "features": ["piper"]
    })
}

// voz Piper nativa -> WAV (ArrayBuffer no JS)
#[tauri::command]
async fn piper_tts(app: AppHandle, st: State<'_, Arc<piper::Piper>>, text: String, voice: String, speed: f64) -> Result<Response, String> {
    let p = st.inner().clone();
    tauri::async_runtime::spawn_blocking(move || p.say(&app, &text, &voice, speed).map(Response::new)).await.map_err(|e| e.to_string())?
}

fn main() {
    tauri::Builder::default()
        .manage(Arc::new(piper::Piper::default()))
        .invoke_handler(tauri::generate_handler![info, piper_tts])
        .run(tauri::generate_context!())
        .expect("falha ao iniciar o S.Y.N.A.P.S.E");
}
