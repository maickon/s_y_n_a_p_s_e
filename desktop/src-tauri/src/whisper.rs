// Whisper nativo (whisper.cpp): modelo small baixado sob demanda e mantido carregado; tempos por palavra
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

const MODEL: &str = "ggml-small-q5_1.bin";
#[derive(Default)]
pub struct Asr(Mutex<Option<WhisperContext>>);

impl Asr {
    // pcm: mono 16 kHz -> [{w, s, e}] em segundos
    pub fn run(&self, app: &AppHandle, pcm: &[f32]) -> Result<serde_json::Value, String> {
        let mut g = self.0.lock().unwrap();
        if g.is_none() {
            let m = app.path().app_data_dir().map_err(|e| e.to_string())?.join(MODEL);
            if !m.exists() {
                std::fs::create_dir_all(m.parent().unwrap()).map_err(|e| e.to_string())?;
                crate::dl::fetch(app, &format!("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/{MODEL}"), &m)?;
            }
            whisper_rs::install_logging_hooks();
            *g = Some(WhisperContext::new_with_params(&m, WhisperContextParameters::default()).map_err(|e| e.to_string())?);
        }
        let mut st = g.as_ref().unwrap().create_state().map_err(|e| e.to_string())?;
        let mut p = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        p.set_language(Some("pt"));
        p.set_n_threads(std::thread::available_parallelism().map(|n| n.get().min(8) as i32).unwrap_or(4));
        p.set_token_timestamps(true);
        p.set_split_on_word(true);
        p.set_max_len(1); // um segmento por palavra
        for f in [FullParams::set_print_progress, FullParams::set_print_realtime, FullParams::set_print_timestamps, FullParams::set_print_special] { f(&mut p, false); }
        st.full(p, pcm).map_err(|e| e.to_string())?;
        Ok(st.as_iter().filter_map(|s| {
            let w = s.to_str_lossy().ok()?.trim().to_string();
            (!w.is_empty()).then(|| serde_json::json!({ "w": w, "s": s.start_timestamp() as f64 / 100.0, "e": s.end_timestamp() as f64 / 100.0 }))
        }).collect())
    }
}
