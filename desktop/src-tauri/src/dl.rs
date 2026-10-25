use std::{fs, io::{Read, Write}, path::Path};
use tauri::{AppHandle, Emitter};

// download com progresso (evento "native-dl"), grava em .part e renomeia
pub fn fetch(app: &AppHandle, url: &str, to: &Path) -> Result<(), String> {
    let r = ureq::AgentBuilder::new().try_proxy_from_env(true).build().get(url).call().map_err(|e| e.to_string())?;
    let total: u64 = r.header("content-length").and_then(|s| s.parse().ok()).unwrap_or(0);
    let tmp = to.with_extension("part");
    let (mut rd, mut f, mut buf, mut n) = (r.into_reader(), fs::File::create(&tmp).map_err(|e| e.to_string())?, vec![0u8; 1 << 16], 0u64);
    let mut last = 0u64;
    loop {
        let k = rd.read(&mut buf).map_err(|e| e.to_string())?;
        if k == 0 { break; }
        f.write_all(&buf[..k]).map_err(|e| e.to_string())?;
        n += k as u64;
        if n - last > 1 << 20 { last = n; let _ = app.emit("native-dl", serde_json::json!({ "url": url, "loaded": n, "total": total })); }
    }
    drop(f);
    fs::rename(&tmp, to).map_err(|e| e.to_string())
}

