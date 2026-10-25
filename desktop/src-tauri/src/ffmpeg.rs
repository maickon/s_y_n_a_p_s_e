// export nativo: quadros RGBA (IPC) -> stdin do FFmpeg, com codificador de GPU quando disponível
use std::{fs, io::{Read, Write}, path::{Path, PathBuf}, process::{Child, ChildStdin, Command, Stdio}, sync::Mutex};
use tauri::{AppHandle, Manager};
use crate::dl::fetch;

#[derive(Default)]
pub struct Ff { job: Mutex<Option<Job>>, bin: Mutex<Option<(PathBuf, String)>> }
struct Job { child: Child, inp: Option<ChildStdin>, out: PathBuf, tmp: PathBuf }

fn cmd(bin: &Path) -> Command {
    #[allow(unused_mut)]
    let mut c = Command::new(bin);
    #[cfg(windows)] { use std::os::windows::process::CommandExt; c.creation_flags(0x0800_0000); }
    c
}
fn ok(bin: &Path, args: &[&str]) -> bool { cmd(bin).args(args).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).status().map(|s| s.success()).unwrap_or(false) }

fn url() -> Option<&'static str> {
    Some(match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", _) => "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
        ("linux", "aarch64") => "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linuxarm64-gpl.tar.xz",
        ("linux", _) => "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz",
        ("macos", _) => "https://evermeet.cx/ffmpeg/getrelease/zip",
        _ => return None,
    })
}

// extrai só o executável ffmpeg do pacote
fn unpack(arc: &Path, to: &Path) -> Result<(), String> {
    let e = |e: &dyn std::fmt::Display| e.to_string();
    let name = if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" };
    let mut data = Vec::new();
    if arc.extension().map_or(false, |x| x == "zip") {
        let mut z = zip::ZipArchive::new(fs::File::open(arc).map_err(|x| e(&x))?).map_err(|x| e(&x))?;
        let i = (0..z.len()).find(|&i| z.by_index(i).map_or(false, |f| f.name().rsplit('/').next() == Some(name))).ok_or("ffmpeg não encontrado no pacote")?;
        z.by_index(i).map_err(|x| e(&x))?.read_to_end(&mut data).map_err(|x| e(&x))?;
    } else {
        #[cfg(unix)] {
            let mut raw = Vec::new();
            lzma_rs::xz_decompress(&mut std::io::BufReader::new(fs::File::open(arc).map_err(|x| e(&x))?), &mut raw).map_err(|x| format!("{x:?}"))?;
            let mut t = tar::Archive::new(&raw[..]);
            for f in t.entries().map_err(|x| e(&x))? {
                let mut f = f.map_err(|x| e(&x))?;
                if f.path().map_or(false, |p| p.ends_with(format!("bin/{name}"))) { f.read_to_end(&mut data).map_err(|x| e(&x))?; break; }
            }
        }
    }
    if data.is_empty() { return Err("ffmpeg não encontrado no pacote".into()); }
    fs::write(to, data).map_err(|x| e(&x))?;
    #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; let _ = fs::set_permissions(to, fs::Permissions::from_mode(0o755)); }
    Ok(())
}

impl Ff {
    // ffmpeg do sistema ou baixado; escolhe o 1º codificador H.264 que funciona de fato
    fn ensure(&self, app: &AppHandle) -> Result<(PathBuf, String), String> {
        let mut g = self.bin.lock().unwrap();
        if let Some(b) = g.clone() { return Ok(b); }
        let local = app.path().app_data_dir().map_err(|e| e.to_string())?.join(if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" });
        let bin = if ok(Path::new("ffmpeg"), &["-version"]) { PathBuf::from("ffmpeg") } else {
            if !local.exists() {
                let u = url().ok_or("sistema sem FFmpeg")?;
                fs::create_dir_all(local.parent().unwrap()).map_err(|e| e.to_string())?;
                let a = local.with_extension(if u.ends_with(".tar.xz") { "tar.xz" } else { "zip" });
                fetch(app, u, &a)?;
                let r = unpack(&a, &local); let _ = fs::remove_file(&a); r?;
            }
            local
        };
        let enc = ["h264_nvenc", "h264_qsv", "h264_amf", "h264_videotoolbox", "libx264"].into_iter()
            .find(|c| ok(&bin, &["-hide_banner", "-f", "lavfi", "-i", "color=s=256x256:d=0.1", "-frames:v", "2", "-c:v", c, "-f", "null", "-"]))
            .ok_or("nenhum codificador H.264 disponível")?.to_string();
        *g = Some((bin.clone(), enc.clone()));
        Ok((bin, enc))
    }

    pub fn start(&self, app: &AppHandle, w: u32, h: u32, fps: u32, name: &str, wav: &[u8]) -> Result<String, String> {
        self.cancel();
        let (bin, enc) = self.ensure(app)?;
        let dir = app.path().video_dir().or_else(|_| app.path().download_dir()).map_err(|e| e.to_string())?.join("SYNAPSE");
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let (out, tmp) = (dir.join(name), std::env::temp_dir().join(format!("synapse-{}.wav", crate::hash(name))));
        fs::write(&tmp, wav).map_err(|e| e.to_string())?;
        let q: &[&str] = match enc.as_str() {
            "libx264" => &["-preset", "veryfast", "-crf", "19"],
            "h264_nvenc" => &["-preset", "p5", "-cq", "21"],
            "h264_qsv" => &["-global_quality", "21"],
            "h264_amf" => &["-quality", "quality", "-rc", "cqp", "-qp_i", "20", "-qp_p", "22"],
            _ => &["-b:v", "10M"],
        };
        let (s, r) = (format!("{w}x{h}"), fps.to_string());
        let mut c = cmd(&bin);
        c.args(["-y", "-hide_banner", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", &s, "-r", &r, "-i", "-"]).arg("-i").arg(&tmp)
            .args(["-c:v", &enc]).args(q).args(["-pix_fmt", "yuv420p", "-g", &(fps * 2).to_string(), "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart"]).arg(&out)
            .stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::null());
        let mut child = c.spawn().map_err(|e| e.to_string())?;
        let inp = child.stdin.take();
        *self.job.lock().unwrap() = Some(Job { child, inp, out, tmp });
        Ok(enc)
    }

    pub fn frame(&self, rgba: &[u8]) -> Result<(), String> {
        let mut g = self.job.lock().unwrap();
        let j = g.as_mut().ok_or("nenhuma exportação ativa")?;
        j.inp.as_mut().ok_or("entrada fechada")?.write_all(rgba).map_err(|e| format!("FFmpeg parou: {e}"))
    }

    pub fn finish(&self) -> Result<String, String> {
        let mut j = self.job.lock().unwrap().take().ok_or("nenhuma exportação ativa")?;
        drop(j.inp.take());
        let st = j.child.wait().map_err(|e| e.to_string())?;
        let _ = fs::remove_file(&j.tmp);
        if !st.success() { return Err("FFmpeg falhou ao finalizar".into()); }
        Ok(j.out.to_string_lossy().into())
    }

    pub fn cancel(&self) {
        if let Some(mut j) = self.job.lock().unwrap().take() { let _ = j.child.kill(); let _ = j.child.wait(); let _ = fs::remove_file(&j.out); let _ = fs::remove_file(&j.tmp); }
    }
}

// mostra o arquivo no gerenciador de arquivos
pub fn reveal(p: &str) {
    let p = Path::new(p);
    let _ = if cfg!(windows) { Command::new("explorer").arg(format!("/select,{}", p.display())).spawn() }
        else if cfg!(target_os = "macos") { Command::new("open").arg("-R").arg(p).spawn() }
        else { Command::new("xdg-open").arg(p.parent().unwrap_or(p)).spawn() };
}
