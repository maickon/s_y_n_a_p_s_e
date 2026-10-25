// Piper nativo: baixa binário/vozes sob demanda e mantém processos vivos por voz (pool paralelo)
use std::{collections::HashMap, fs, io::{BufRead, BufReader, Read, Write}, path::{Path, PathBuf}, process::{Child, ChildStdin, ChildStdout, Command, Stdio}, sync::{Arc, Mutex}};
use tauri::{AppHandle, Emitter, Manager};

const REL: &str = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/";
const HF: &str = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/";

struct W { _c: Child, inp: ChildStdin, out: BufReader<ChildStdout> }
#[derive(Default)]
pub struct Piper { pool: Mutex<HashMap<String, Vec<Arc<Mutex<W>>>>>, dl: Mutex<()>, rr: Mutex<usize> }

fn asset() -> Result<&'static str, String> {
    Ok(match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", _) => "piper_windows_amd64.zip",
        ("linux", "aarch64") => "piper_linux_aarch64.tar.gz",
        ("linux", _) => "piper_linux_x86_64.tar.gz",
        ("macos", "aarch64") => "piper_macos_aarch64.tar.gz",
        ("macos", _) => "piper_macos_x64.tar.gz",
        _ => return Err("sistema sem Piper nativo".into()),
    })
}

// download com progresso (evento "native-dl"), grava em .part e renomeia
fn fetch(app: &AppHandle, url: &str, to: &Path) -> Result<(), String> {
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

fn extract(arc: &Path, dir: &Path) -> Result<(), String> {
    let f = fs::File::open(arc).map_err(|e| e.to_string())?;
    #[cfg(windows)] { zip::ZipArchive::new(f).and_then(|mut z| z.extract(dir)).map_err(|e| e.to_string()) }
    #[cfg(unix)] { tar::Archive::new(flate2::read::GzDecoder::new(f)).unpack(dir).map_err(|e| e.to_string()) }
}

fn exe(dir: &Path) -> PathBuf { dir.join("piper").join(if cfg!(windows) { "piper.exe" } else { "piper" }) }

impl Piper {
    fn ensure(&self, app: &AppHandle, voice: &str) -> Result<(PathBuf, PathBuf), String> {
        let _g = self.dl.lock().unwrap();
        let root = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let (bin, vd) = (exe(&root), root.join("voices"));
        fs::create_dir_all(&vd).map_err(|e| e.to_string())?;
        if !bin.exists() {
            let a = root.join(asset()?);
            fetch(app, &format!("{REL}{}", asset()?), &a)?;
            extract(&a, &root)?;
            let _ = fs::remove_file(&a);
            #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; let _ = fs::set_permissions(&bin, fs::Permissions::from_mode(0o755)); }
        }
        // ex.: pt_BR-faber-medium -> pt/pt_BR/faber/medium/
        let p: Vec<&str> = voice.splitn(3, '-').collect();
        if p.len() != 3 { return Err("voz inválida".into()); }
        let base = format!("{HF}{}/{}/{}/{}/{}", p[0].split('_').next().unwrap_or(""), p[0], enc(p[1]), p[2], enc(voice));
        let m = vd.join(format!("{voice}.onnx"));
        for (u, f) in [(format!("{base}.onnx.json"), vd.join(format!("{voice}.onnx.json"))), (format!("{base}.onnx"), m.clone())] {
            if !f.exists() { fetch(app, &u, &f)?; }
        }
        Ok((bin, m))
    }

    fn spawn(bin: &Path, model: &Path, scale: &str, out: &Path) -> Result<W, String> {
        fs::create_dir_all(out).map_err(|e| e.to_string())?;
        let dir = bin.parent().unwrap();
        let mut c = Command::new(bin);
        c.arg("--model").arg(model).arg("--output_dir").arg(out).args(["--length_scale", scale, "--sentence_silence", "0"])
            .current_dir(dir).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
        #[cfg(target_os = "linux")] c.env("LD_LIBRARY_PATH", dir);
        #[cfg(target_os = "macos")] c.env("DYLD_LIBRARY_PATH", dir);
        #[cfg(windows)] { use std::os::windows::process::CommandExt; c.creation_flags(0x0800_0000); }
        let mut ch = c.spawn().map_err(|e| e.to_string())?;
        Ok(W { inp: ch.stdin.take().unwrap(), out: BufReader::new(ch.stdout.take().unwrap()), _c: ch })
    }

    pub fn say(&self, app: &AppHandle, text: &str, voice: &str, speed: f64) -> Result<Vec<u8>, String> {
        let (bin, model) = self.ensure(app, voice)?;
        let scale = format!("{:.2}", 1.0 / speed.clamp(0.3, 3.0));
        let key = format!("{voice}|{scale}");
        let max = std::thread::available_parallelism().map(|n| (n.get() / 2).clamp(1, 4)).unwrap_or(1);
        let w = {
            let mut pool = self.pool.lock().unwrap();
            let v = pool.entry(key.clone()).or_default();
            match v.iter().find(|w| w.try_lock().is_ok()).cloned() {
                Some(w) => w,
                None if v.len() < max => {
                    let out = app.path().app_cache_dir().map_err(|e| e.to_string())?.join("piper").join(format!("{}-{}", v.len(), crate::hash(&key)));
                    let w = Arc::new(Mutex::new(Self::spawn(&bin, &model, &scale, &out)?)); v.push(w.clone()); w
                }
                None => { let mut r = self.rr.lock().unwrap(); *r += 1; v[*r % v.len()].clone() }
            }
        };
        let res = (|| {
            let mut g = w.lock().unwrap();
            writeln!(g.inp, "{}", text.replace(['\n', '\r'], " ")).and_then(|_| g.inp.flush()).map_err(|e| e.to_string())?;
            let mut line = String::new();
            if g.out.read_line(&mut line).map_err(|e| e.to_string())? == 0 { return Err("Piper encerrou".to_string()); }
            let p = PathBuf::from(line.trim());
            let b = fs::read(&p).map_err(|e| e.to_string());
            let _ = fs::remove_file(&p);
            b
        })();
        if res.is_err() { self.pool.lock().unwrap().get_mut(&key).map(|v| v.retain(|x| !Arc::ptr_eq(x, &w))); }
        res
    }
}

fn enc(s: &str) -> String { s.bytes().map(|b| if b.is_ascii_alphanumeric() || b"-_.".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") }).collect() }
