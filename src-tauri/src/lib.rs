use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::Manager;

const SIDECAR_HOST: &str = "127.0.0.1";
const SIDECAR_PORT: u16 = 1430;

struct SidecarState {
  child: Mutex<Option<Child>>,
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

fn start_sidecar(app: &tauri::AppHandle) -> Result<Child, String> {
  let sidecar_dir = resource_sidecar_dir(app)?;
  let server_js = sidecar_dir.join("server.js");
  let db_path = sidecar_dir.join("dev.db");
  if !server_js.exists() {
    return Err(format!(
      "Missing Next sidecar at {:?}. Run `npm run tauri:prepare` before building Tauri.",
      server_js
    ));
  }

  let node_bin = if let Some(bundled) = resource_node_bin(app) {
    bundled
  } else if let Some(env_node) = trusted_env_node_bin() {
    env_node
  } else {
    #[cfg(target_os = "windows")]
    {
      PathBuf::from("node.exe")
    }
    #[cfg(not(target_os = "windows"))]
    {
      PathBuf::from("/opt/homebrew/bin/node")
    }
  };

  Command::new(node_bin)
    .arg(server_js)
    .current_dir(&sidecar_dir)
    .env("HOSTNAME", SIDECAR_HOST)
    .env("PORT", SIDECAR_PORT.to_string())
    .env("DATABASE_URL", format!("file:{}", db_path.display()))
    .spawn()
    .map_err(|e| format!("Failed to start Next sidecar: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(SidecarState {
      child: Mutex::new(None),
    })
    .setup(|app| {
      let child = start_sidecar(&app.handle())?;
      {
        let sidecar = app.state::<SidecarState>();
        let mut lock = sidecar
          .child
          .lock()
          .map_err(|_| "Failed to lock sidecar state".to_string())?;
        *lock = Some(child);
      }

      if !wait_for_server(SIDECAR_HOST, SIDECAR_PORT, Duration::from_secs(20)) {
        let sidecar = app.state::<SidecarState>();
        kill_sidecar(&sidecar);
        return Err("Next sidecar did not become healthy in time".into());
      }
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
