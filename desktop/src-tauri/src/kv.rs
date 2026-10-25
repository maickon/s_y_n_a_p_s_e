// armazenamento em disco (substitui o IndexedDB no desktop): 1 arquivo por chave em app_data/store
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

fn dir(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?.join("store");
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d)
}
fn file(app: &AppHandle, k: &str) -> Result<PathBuf, String> { Ok(dir(app)?.join(k.bytes().map(|b| format!("{b:02x}")).collect::<String>())) }

pub fn get(app: &AppHandle, k: &str) -> Vec<u8> { file(app, k).and_then(|f| fs::read(f).map_err(|e| e.to_string())).unwrap_or_default() }
pub fn set(app: &AppHandle, k: &str, v: &[u8]) -> Result<(), String> {
    let f = file(app, k)?;
    let t = f.with_extension("tmp");
    fs::write(&t, v).and_then(|_| fs::rename(&t, &f)).map_err(|e| e.to_string())
}
pub fn del(app: &AppHandle, k: &str) { if let Ok(f) = file(app, k) { let _ = fs::remove_file(f); } }
pub fn keys(app: &AppHandle) -> Vec<String> {
    let un = |s: &str| (0..s.len()).step_by(2).map(|i| u8::from_str_radix(s.get(i..i + 2)?, 16).ok()).collect::<Option<Vec<u8>>>().and_then(|b| String::from_utf8(b).ok());
    dir(app).ok().and_then(|d| fs::read_dir(d).ok()).map(|r| r.flatten().filter_map(|e| un(&e.file_name().to_string_lossy())).collect()).unwrap_or_default()
}

// grava em Documentos/SYNAPSE/Projetos e devolve o caminho
pub fn save_doc(app: &AppHandle, name: &str, v: &[u8]) -> Result<String, String> {
    let d = app.path().document_dir().map_err(|e| e.to_string())?.join("SYNAPSE").join("Projetos");
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    let f = d.join(name.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_"));
    fs::write(&f, v).map_err(|e| e.to_string())?;
    Ok(f.to_string_lossy().into())
}
