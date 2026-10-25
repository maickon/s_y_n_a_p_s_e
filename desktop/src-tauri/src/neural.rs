// vozes neurais opcionais via Python (venv próprio): Kokoro pt-BR (leve) e XTTS-v2 (clonagem de voz)
use std::{fs, io::{BufRead, BufReader, Write}, path::{Path, PathBuf}, process::{Child, ChildStdin, ChildStdout, Command, Stdio}, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager};

const PY: &str = include_str!("../py/neural.py");
const KO: &str = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/";

struct P { _c: Child, inp: ChildStdin, out: BufReader<ChildStdout> }
#[derive(Default)]
pub struct Neural { p: Mutex<Option<P>>, setup: Mutex<()> }

fn cmd(p: impl AsRef<std::ffi::OsStr>) -> Command {
    #[allow(unused_mut)]
    let mut c = Command::new(p);
    #[cfg(windows)] { use std::os::windows::process::CommandExt; c.creation_flags(0x0800_0000); }
    c
}
fn root(app: &AppHandle) -> Result<PathBuf, String> { Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("neural")) }
fn venv_py(r: &Path) -> PathBuf { r.join("venv").join(if cfg!(windows) { "Scripts/python.exe" } else { "bin/python" }) }
fn log(app: &AppHandle, s: &str) { let _ = app.emit("neural-setup", s.trim()); }

// executa e repassa a saída como progresso
fn run(app: &AppHandle, c: &mut Command) -> Result<(), String> {
    let mut ch = c.stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().map_err(|e| e.to_string())?;
    let err = ch.stderr.take().unwrap();
    let a = app.clone();
    let t = std::thread::spawn(move || BufReader::new(err).lines().map_while(Result::ok).inspect(|l| log(&a, l)).last().unwrap_or_default());
    for l in BufReader::new(ch.stdout.take().unwrap()).lines().map_while(Result::ok) { log(app, &l); }
    let last = t.join().unwrap_or_default();
    if ch.wait().map_err(|e| e.to_string())?.success() { Ok(()) } else { Err(format!("falhou: {last}")) }
}

impl Neural {
    pub fn installed(app: &AppHandle, engine: &str) -> bool { root(app).map(|r| r.join(format!("{engine}.ok")).exists()).unwrap_or(false) }

    pub fn setup(&self, app: &AppHandle, engine: &str) -> Result<(), String> {
        let _g = self.setup.lock().unwrap();
        if Self::installed(app, engine) { return Ok(()); }
        let r = root(app)?;
        fs::create_dir_all(&r).map_err(|e| e.to_string())?;
        if !venv_py(&r).exists() {
            let ok = |p: &str, a: &[&str]| cmd(p).args(a).args(["-c", "import sys;assert sys.version_info>=(3,9)"]).stdout(Stdio::null()).stderr(Stdio::null()).status().map_or(false, |s| s.success());
            let (py, pre): (&str, &[&str]) = [("python3", &[][..]), ("python", &[][..]), ("py", &["-3"][..])].into_iter().find(|(p, a)| ok(p, a)).ok_or("Python 3.9+ não encontrado. Instale em python.org (marque \"Add to PATH\") e tente de novo.")?;
            log(app, "Criando ambiente Python...");
            run(app, cmd(py).args(pre).args(["-m", "venv"]).arg(r.join("venv")))?;
        }
        let pkgs: &[&str] = if engine == "xtts" { &["coqui-tts", "soundfile"] } else { &["kokoro-onnx", "soundfile"] };
        log(app, "Instalando pacotes (pode levar alguns minutos)...");
        run(app, cmd(venv_py(&r)).args(["-m", "pip", "install", "-U", "--disable-pip-version-check"]).args(pkgs))?;
        if engine == "kokoro" { for f in ["kokoro-v1.0.onnx", "voices-v1.0.bin"] { if !r.join(f).exists() { log(app, &format!("Baixando {f}...")); crate::dl::fetch(app, &format!("{KO}{f}"), &r.join(f))?; } } }
        fs::write(r.join(format!("{engine}.ok")), "").map_err(|e| e.to_string())
    }

    pub fn say(&self, app: &AppHandle, engine: &str, voice: &str, text: &str, speed: f64, refwav: &[u8]) -> Result<Vec<u8>, String> {
        if !Self::installed(app, engine) { return Err("NOT_INSTALLED".into()); }
        let r = root(app)?;
        let mut g = self.p.lock().unwrap();
        if g.is_none() {
            fs::write(r.join("neural.py"), PY).map_err(|e| e.to_string())?;
            let mut c = cmd(venv_py(&r));
            c.arg(r.join("neural.py")).env("COQUI_TOS_AGREED", "1").env("PYTHONIOENCODING", "utf-8").stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
            let mut ch = c.spawn().map_err(|e| e.to_string())?;
            *g = Some(P { inp: ch.stdin.take().unwrap(), out: BufReader::new(ch.stdout.take().unwrap()), _c: ch });
        }
        let p = g.as_mut().unwrap();
        let tmp = std::env::temp_dir();
        let (out, rf) = (tmp.join(format!("syn-neural-{}.wav", crate::hash(text))), tmp.join(format!("syn-ref-{}.wav", crate::hash(&format!("{:?}", &refwav[..refwav.len().min(4096)])))));
        if !refwav.is_empty() && !rf.exists() { fs::write(&rf, refwav).map_err(|e| e.to_string())?; }
        let req = serde_json::json!({ "engine": engine, "voice": voice, "text": text, "speed": speed, "out": out, "ref": rf });
        let res = (|| {
            writeln!(p.inp, "{req}").and_then(|_| p.inp.flush()).map_err(|e| e.to_string())?;
            let mut l = String::new();
            if p.out.read_line(&mut l).map_err(|e| e.to_string())? == 0 { return Err("processo Python encerrou".to_string()); }
            let v: serde_json::Value = serde_json::from_str(&l).map_err(|e| e.to_string())?;
            if let Some(e) = v["err"].as_str() { return Err(e.to_string()); }
            let b = fs::read(&out).map_err(|e| e.to_string()); let _ = fs::remove_file(&out); b
        })();
        if res.as_ref().err().map_or(false, |e| e.contains("encerrou")) { *g = None; }
        res
    }
}
