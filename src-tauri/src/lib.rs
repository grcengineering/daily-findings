// Daily Findings desktop sidecar bootstrap.
//
// Boot flow:
//   1. setup() opens sidecar.log in the app data dir.
//   2. (macOS only) strip the com.apple.quarantine xattr from the .app
//      bundle so users who downloaded via Safari are not blocked by
//      Gatekeeper before the bundled Node runtime ever starts.
//   3. ensure_writable_db copies the bundled SQLite seed to the user's
//      app-data dir IF AND ONLY IF the user database does not already
//      exist. The user DB is never overwritten — content updates are
//      reconciled at the application layer by src/instrumentation.ts
//      against data/release-library/session-content.json so that user
//      progress (XP, streaks, completions, analytics) is preserved.
//   4. start_sidecar spawns the Node child with BOTH stdout and stderr
//      redirected to log files in the app data dir.
//   5. wait_for_server polls 127.0.0.1:1430 (port mirrored in
//      tauri.conf.json window.url).
//
// SIDECAR_PORT must stay in sync with tauri.conf.json `windows[0].url`.

use std::fs;
use std::io::Write;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::Manager;

const SIDECAR_HOST: &str = "127.0.0.1";
const SIDECAR_PORT: u16 = 1430;

struct SidecarState {
  child: Mutex<Option<Child>>,
  log_path: Mutex<Option<PathBuf>>,
}

fn open_log(app: &tauri::AppHandle) -> Option<(fs::File, PathBuf)> {
  let app_data = app.path().app_data_dir().ok()?;
  let _ = fs::create_dir_all(&app_data);
  let log_path = app_data.join("sidecar.log");
  let file = fs::OpenOptions::new()
    .create(true)
    .write(true)
    .truncate(true)
    .open(&log_path)
    .ok()?;
  Some((file, log_path))
}

macro_rules! log {
  ($file:expr, $($arg:tt)*) => {{
    if let Some(ref mut f) = $file {
      let _ = writeln!(f, "[{}] {}", chrono_now(), format!($($arg)*));
      let _ = f.flush();
    }
    eprintln!("[daily-findings] {}", format!($($arg)*));
  }};
}

fn chrono_now() -> String {
  let d = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default();
  format!("{}", d.as_secs())
}

fn wait_for_server(host: &str, port: u16, timeout: Duration) -> bool {
  let started = Instant::now();
  while started.elapsed() < timeout {
    if TcpStream::connect((host, port)).is_ok() {
      return true;
    }
    thread::sleep(Duration::from_millis(150));
  }
  false
}

/// Returns true when `pid` looks like a Node process we own. Used to gate
/// the destructive `kill -9` in `kill_stale_port_holder` so we never nuke
/// an unrelated dev server the user has bound to port 1430.
fn pid_is_node(pid: &str) -> bool {
  #[cfg(unix)]
  {
    let output = Command::new("ps")
      .args(["-o", "comm=", "-p", pid])
      .output();
    if let Ok(out) = output {
      let comm = String::from_utf8_lossy(&out.stdout);
      let comm = comm.trim().to_lowercase();
      let basename = Path::new(&comm)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(&comm)
        .to_string();
      return basename == "node";
    }
    false
  }

  #[cfg(windows)]
  {
    let output = Command::new("tasklist")
      .args(["/FI", &format!("PID eq {}", pid), "/FO", "CSV", "/NH"])
      .output();
    if let Ok(out) = output {
      let line = String::from_utf8_lossy(&out.stdout).to_lowercase();
      return line.contains("node.exe");
    }
    false
  }
}

fn kill_stale_port_holder(port: u16, logfile: &mut Option<fs::File>) -> Result<(), String> {
  if TcpStream::connect((SIDECAR_HOST, port)).is_err() {
    log!(logfile, "Port {} is free", port);
    return Ok(());
  }
  log!(logfile, "Port {} is occupied, identifying holder", port);

  #[cfg(unix)]
  {
    let output = Command::new("lsof")
      .args(["-ti", &format!(":{}", port)])
      .output();
    if let Ok(out) = output {
      let pids = String::from_utf8_lossy(&out.stdout);
      for pid_str in pids.split_whitespace() {
        if pid_is_node(pid_str) {
          log!(logfile, "Killing stale node PID {} on port {}", pid_str, port);
          let _ = Command::new("kill").args(["-9", pid_str]).output();
        } else {
          log!(
            logfile,
            "Refusing to kill PID {} on port {} (not node) — aborting startup",
            pid_str,
            port
          );
          return Err(format!(
            "Port {} is in use by a non-node process (PID {}). Quit it and relaunch.",
            port, pid_str
          ));
        }
      }
    }
  }

  #[cfg(windows)]
  {
    let output = Command::new("cmd")
      .args([
        "/C",
        &format!(
          "for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :{} ^| findstr LISTENING') do @echo %a",
          port
        ),
      ])
      .output();
    if let Ok(out) = output {
      let pids = String::from_utf8_lossy(&out.stdout);
      for pid_str in pids.split_whitespace() {
        if pid_is_node(pid_str) {
          log!(logfile, "Killing stale node PID {} on port {}", pid_str, port);
          let _ = Command::new("taskkill")
            .args(["/F", "/PID", pid_str])
            .output();
        } else {
          log!(
            logfile,
            "Refusing to kill PID {} on port {} (not node) — aborting startup",
            pid_str,
            port
          );
          return Err(format!(
            "Port {} is in use by a non-node process (PID {}). Quit it and relaunch.",
            port, pid_str
          ));
        }
      }
    }
  }

  thread::sleep(Duration::from_millis(500));
  log!(
    logfile,
    "Port {} after cleanup: {}",
    port,
    if TcpStream::connect((SIDECAR_HOST, port)).is_ok() { "still occupied" } else { "free" }
  );
  Ok(())
}

fn kill_sidecar(state: &SidecarState) {
  if let Ok(mut lock) = state.child.lock() {
    if let Some(ref mut child) = *lock {
      let _ = child.kill();
      let _ = child.wait();
    }
    *lock = None;
  }
}

/// macOS only: strip the com.apple.quarantine xattr from the application
/// bundle so users who downloaded via Safari (or Chrome) are not blocked
/// by Gatekeeper on second launch. Best-effort, never fails the boot.
#[cfg(target_os = "macos")]
fn strip_quarantine_from_self(logfile: &mut Option<fs::File>) {
  let exe = match std::env::current_exe() {
    Ok(p) => p,
    Err(_) => return,
  };
  // current_exe lives at <Bundle>.app/Contents/MacOS/<binary>; walk up to .app.
  let bundle = exe
    .parent()
    .and_then(|p| p.parent())
    .and_then(|p| p.parent());
  if let Some(bundle_path) = bundle {
    if bundle_path.extension().and_then(|s| s.to_str()) == Some("app") {
      log!(
        logfile,
        "Stripping com.apple.quarantine from {}",
        bundle_path.display()
      );
      let _ = Command::new("xattr")
        .args(["-dr", "com.apple.quarantine"])
        .arg(bundle_path)
        .output();
    }
  }
}

#[cfg(not(target_os = "macos"))]
fn strip_quarantine_from_self(_logfile: &mut Option<fs::File>) {}

fn resource_sidecar_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let resource_paths = [
    "next-standalone",
    "resources/next-standalone",
  ];

  for candidate in resource_paths {
    if let Ok(path) = app
      .path()
      .resolve(candidate, tauri::path::BaseDirectory::Resource)
    {
      if path.exists() {
        return Ok(path);
      }
    }
  }

  Err("Failed to resolve sidecar resources directory".to_string())
}

fn resource_node_bin(app: &tauri::AppHandle) -> Option<PathBuf> {
  #[cfg(target_os = "windows")]
  let resource_paths = [
    "node-runtime/node.exe",
    "resources/node-runtime/node.exe",
    "node-runtime/bin/node.exe",
    "resources/node-runtime/bin/node.exe",
  ];

  #[cfg(not(target_os = "windows"))]
  let resource_paths = [
    "node-runtime/bin/node",
    "resources/node-runtime/bin/node",
  ];

  for candidate in resource_paths {
    if let Ok(path) = app
      .path()
      .resolve(candidate, tauri::path::BaseDirectory::Resource)
    {
      if path.exists() {
        return Some(path);
      }
    }
  }

  None
}

fn trusted_env_node_bin() -> Option<PathBuf> {
  let raw = std::env::var("TAURI_NODE_BIN").ok()?;
  let candidate = PathBuf::from(raw);
  if candidate.is_absolute() && candidate.exists() {
    Some(candidate)
  } else {
    None
  }
}

/// The bundled seed database lives at exactly one canonical path:
///   <sidecar_dir>/dev.db
/// scripts/prepare-tauri-sidecar.mjs guarantees this and prunes any
/// stale duplicates that Next's standalone copy may have dragged in.
fn find_bundled_db(sidecar_dir: &Path) -> Option<PathBuf> {
  let canonical = sidecar_dir.join("dev.db");
  if canonical.exists() {
    Some(canonical)
  } else {
    None
  }
}

fn writable_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let app_data = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;
  fs::create_dir_all(&app_data)
    .map_err(|e| format!("Failed to create app data directory: {e}"))?;
  Ok(app_data.join("dev.db"))
}

/// Copy the bundled seed DB into the user's app data dir IF AND ONLY IF
/// no user DB exists yet. We never overwrite an existing user DB —
/// content updates are reconciled at runtime by src/instrumentation.ts
/// against the shipped session-content.json so user progress (XP, streaks,
/// completions, analytics, reading positions) is preserved across upgrades.
fn ensure_writable_db(
  app: &tauri::AppHandle,
  sidecar_dir: &Path,
  logfile: &mut Option<fs::File>,
) -> Result<PathBuf, String> {
  let dest = writable_db_path(app)?;
  log!(logfile, "Writable DB target: {}", dest.display());

  if dest.exists() {
    let dest_size = fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
    log!(
      logfile,
      "User DB exists ({}B) — preserving. Content will be reconciled at app layer.",
      dest_size
    );
    return Ok(dest);
  }

  let bundled = find_bundled_db(sidecar_dir).ok_or_else(|| {
    let msg = format!(
      "Missing bundled seed database at {}/dev.db",
      sidecar_dir.display()
    );
    log!(logfile, "ERROR: {}", msg);
    msg
  })?;
  log!(
    logfile,
    "Bundled seed DB: {} ({}B)",
    bundled.display(),
    fs::metadata(&bundled).map(|m| m.len()).unwrap_or(0)
  );

  fs::copy(&bundled, &dest).map_err(|e| {
    let msg = format!(
      "Failed to copy database from {} to {}: {e}",
      bundled.display(),
      dest.display()
    );
    log!(logfile, "COPY ERROR: {}", msg);
    msg
  })?;
  let _ = fs::remove_file(dest.with_extension("db-journal"));
  let _ = fs::remove_file(dest.with_extension("db-wal"));
  let _ = fs::remove_file(dest.with_extension("db-shm"));
  let final_size = fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
  log!(
    logfile,
    "Seeded user DB from bundle: {} ({}B)",
    dest.display(),
    final_size
  );
  Ok(dest)
}

fn start_sidecar(
  app: &tauri::AppHandle,
  logfile: &mut Option<fs::File>,
) -> Result<Child, String> {
  let sidecar_dir = resource_sidecar_dir(app)?;
  log!(logfile, "sidecar_dir: {}", sidecar_dir.display());

  let server_js = sidecar_dir.join("server.js");
  log!(logfile, "server.js exists: {}", server_js.exists());

  let db_path = ensure_writable_db(app, &sidecar_dir, logfile)?;
  let db_url = format!("file:{}", db_path.display());
  log!(logfile, "DATABASE_URL: {}", db_url);

  if !server_js.exists() {
    return Err(format!(
      "Missing Next sidecar at {:?}. Run `npm run tauri:prepare` before building Tauri.",
      server_js
    ));
  }

  let node_bin = if let Some(bundled) = resource_node_bin(app) {
    log!(logfile, "Using bundled node: {}", bundled.display());
    bundled
  } else if let Some(env_node) = trusted_env_node_bin() {
    log!(logfile, "Using env node: {}", env_node.display());
    env_node
  } else {
    #[cfg(target_os = "windows")]
    let fallback = PathBuf::from("node.exe");
    #[cfg(not(target_os = "windows"))]
    let fallback = PathBuf::from("/opt/homebrew/bin/node");
    log!(logfile, "Using fallback node: {}", fallback.display());
    fallback
  };

  let app_data = app.path().app_data_dir().ok();
  let stderr_path = app_data.as_ref().map(|d| d.join("next-stderr.log"));
  let stdout_path = app_data.as_ref().map(|d| d.join("next-stdout.log"));

  let stderr_cfg = match stderr_path.as_ref().and_then(|p| {
    fs::File::create(p).ok().map(|f| (f, p.clone()))
  }) {
    Some((f, p)) => {
      log!(logfile, "Sidecar stderr -> {}", p.display());
      Stdio::from(f)
    }
    None => Stdio::null(),
  };

  let stdout_cfg = match stdout_path.as_ref().and_then(|p| {
    fs::File::create(p).ok().map(|f| (f, p.clone()))
  }) {
    Some((f, p)) => {
      log!(logfile, "Sidecar stdout -> {}", p.display());
      Stdio::from(f)
    }
    None => Stdio::null(),
  };

  kill_stale_port_holder(SIDECAR_PORT, logfile)?;

  let mut child = Command::new(&node_bin)
    .arg(&server_js)
    .current_dir(&sidecar_dir)
    .env("HOSTNAME", SIDECAR_HOST)
    .env("PORT", SIDECAR_PORT.to_string())
    .env("DATABASE_URL", &db_url)
    .stdout(stdout_cfg)
    .stderr(stderr_cfg)
    .spawn()
    .map_err(|e| {
      let msg = format!(
        "Failed to start Next sidecar: {e}. node={}, server={}",
        node_bin.display(),
        server_js.display()
      );
      log!(logfile, "SPAWN ERROR: {}", msg);
      msg
    })?;

  thread::sleep(Duration::from_millis(500));
  match child.try_wait() {
    Ok(Some(status)) => {
      let msg = format!("Sidecar exited immediately with {status}");
      log!(logfile, "ERROR: {}", msg);
      return Err(msg);
    }
    Ok(None) => {
      log!(logfile, "Sidecar process alive (pid={})", child.id());
    }
    Err(e) => {
      log!(logfile, "Could not check sidecar status: {e}");
    }
  }

  Ok(child)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(SidecarState {
      child: Mutex::new(None),
      log_path: Mutex::new(None),
    })
    .setup(|app| {
      let (mut logfile, log_path) = match open_log(&app.handle()) {
        Some((f, p)) => (Some(f), Some(p)),
        None => (None, None),
      };
      log!(logfile, "=== Daily Findings starting ===");
      log!(logfile, "Version: {}", env!("CARGO_PKG_VERSION"));

      strip_quarantine_from_self(&mut logfile);

      let child = start_sidecar(&app.handle(), &mut logfile)?;
      {
        let sidecar = app.state::<SidecarState>();
        let mut lock = sidecar
          .child
          .lock()
          .map_err(|_| "Failed to lock sidecar state".to_string())?;
        *lock = Some(child);
        if let Ok(mut lp) = sidecar.log_path.lock() {
          *lp = log_path;
        };
      }

      log!(logfile, "Waiting for sidecar on {}:{}", SIDECAR_HOST, SIDECAR_PORT);
      if !wait_for_server(SIDECAR_HOST, SIDECAR_PORT, Duration::from_secs(20)) {
        log!(logfile, "ERROR: sidecar did not become healthy in 20s");
        let sidecar = app.state::<SidecarState>();
        kill_sidecar(&sidecar);
        return Err("Next sidecar did not become healthy in time".into());
      }
      log!(logfile, "Sidecar healthy, app ready");
      Ok(())
    })
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { .. } = event {
        if let Some(state) = window.try_state::<SidecarState>() {
          kill_sidecar(&state);
        }
      }
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app, event| {
      if let tauri::RunEvent::Exit = event {
        if let Some(state) = app.try_state::<SidecarState>() {
          kill_sidecar(&state);
        }
      }
    });
}
