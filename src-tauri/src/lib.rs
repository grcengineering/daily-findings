use std::fs;
use std::io::Write;
use std::net::TcpStream;
use std::path::PathBuf;
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

fn kill_sidecar(state: &SidecarState) {
  if let Ok(mut lock) = state.child.lock() {
    if let Some(ref mut child) = *lock {
      let _ = child.kill();
      let _ = child.wait();
    }
    *lock = None;
  }
}

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

fn find_bundled_db(sidecar_dir: &PathBuf) -> Option<PathBuf> {
  let candidates = [
    sidecar_dir.join("dev.db"),
    sidecar_dir.join("prisma").join("dev.db"),
    sidecar_dir.join("prisma").join("prisma").join("dev.db"),
  ];
  candidates.into_iter().find(|c| c.exists())
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

fn ensure_writable_db(
  app: &tauri::AppHandle,
  sidecar_dir: &PathBuf,
  logfile: &mut Option<fs::File>,
) -> Result<PathBuf, String> {
  let bundled = find_bundled_db(sidecar_dir).ok_or_else(|| {
    let msg = format!(
      "Missing sidecar database. Checked: {}/dev.db, {}/prisma/dev.db",
      sidecar_dir.display(),
      sidecar_dir.display()
    );
    log!(logfile, "ERROR: {}", msg);
    msg
  })?;
  log!(
    logfile,
    "Bundled DB: {} ({}B)",
    bundled.display(),
    fs::metadata(&bundled).map(|m| m.len()).unwrap_or(0)
  );

  let dest = writable_db_path(app)?;
  log!(logfile, "Writable DB target: {}", dest.display());

  let should_copy = if dest.exists() {
    let bundled_size = fs::metadata(&bundled).map(|m| m.len()).unwrap_or(0);
    let dest_size = fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
    log!(
      logfile,
      "Dest exists: bundled={}B dest={}B copy={}",
      bundled_size,
      dest_size,
      bundled_size > dest_size
    );
    bundled_size > dest_size
  } else {
    log!(logfile, "Dest does not exist, will copy");
    true
  };

  if should_copy {
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
    log!(logfile, "DB copied successfully");
  }

  let final_size = fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
  log!(logfile, "Final DB: {} ({}B)", dest.display(), final_size);
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

  let sidecar_log_path = app
    .path()
    .app_data_dir()
    .ok()
    .map(|d| d.join("next-stderr.log"));

  let stderr_cfg = if let Some(ref path) = sidecar_log_path {
    match fs::File::create(path) {
      Ok(f) => {
        log!(logfile, "Sidecar stderr → {}", path.display());
        Stdio::from(f)
      }
      Err(_) => Stdio::null(),
    }
  } else {
    Stdio::null()
  };

  Command::new(&node_bin)
    .arg(&server_js)
    .current_dir(&sidecar_dir)
    .env("HOSTNAME", SIDECAR_HOST)
    .env("PORT", SIDECAR_PORT.to_string())
    .env("DATABASE_URL", &db_url)
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
    })
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
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
