#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// informações do sistema para o front (ponte nativa)
#[tauri::command]
fn info() -> serde_json::Value {
    serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "cpus": std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1),
        "version": env!("CARGO_PKG_VERSION")
    })
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![info])
        .run(tauri::generate_context!())
        .expect("falha ao iniciar o S.Y.N.A.P.S.E");
}
