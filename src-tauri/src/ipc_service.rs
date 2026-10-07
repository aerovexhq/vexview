use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenPayload {
    pub target: Option<String>,
    pub targets: Vec<String>,
    pub edit: bool,
    pub fullscreen: bool,
    pub slideshow: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", content = "payload")]
pub enum IpcMessage {
    Open(OpenPayload),
    Quit,
    Ping,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcResponse {
    pub ok: bool,
    pub message: Option<String>,
}

pub fn get_socket_path() -> PathBuf {
    if let Ok(runtime_dir) = std::env::var("XDG_RUNTIME_DIR") {
        PathBuf::from(runtime_dir).join("vexview.sock")
    } else {
        let username = std::env::var("USER").unwrap_or_else(|_| "user".to_string());
        std::env::temp_dir().join(format!("vexview-{}.sock", username))
    }
}

#[cfg(unix)]
pub fn try_send_to_instance(msg: &IpcMessage) -> Result<bool, String> {
    use std::io::{BufRead, BufReader, Write};
    use std::os::unix::net::UnixStream;

    let socket_path = get_socket_path();
    if !socket_path.exists() {
        return Ok(false);
    }

    match UnixStream::connect(&socket_path) {
        Ok(mut stream) => {
            let serialized = serde_json::to_string(msg).map_err(|e| e.to_string())?;
            stream
                .write_all(serialized.as_bytes())
                .map_err(|e| e.to_string())?;
            stream.write_all(b"\n").map_err(|e| e.to_string())?;
            stream.flush().map_err(|e| e.to_string())?;

            let mut reader = BufReader::new(stream);
            let mut line = String::new();
            let _ = reader.read_line(&mut line);
            Ok(true)
        }
        Err(e) => {
            if e.kind() == std::io::ErrorKind::ConnectionRefused
                || e.kind() == std::io::ErrorKind::NotFound
            {
                let _ = std::fs::remove_file(&socket_path);
            }
            Ok(false)
        }
    }
}

#[cfg(not(unix))]
pub fn try_send_to_instance(_msg: &IpcMessage) -> Result<bool, String> {
    Ok(false)
}

#[cfg(unix)]
pub fn start_ipc_listener(app_handle: tauri::AppHandle) {
    use std::io::{BufRead, BufReader, Write};
    use std::os::unix::fs::PermissionsExt;
    use std::os::unix::net::UnixListener;
    use tauri::{Emitter, Manager};

    let socket_path = get_socket_path();
    let _ = std::fs::remove_file(&socket_path);
    if let Some(parent) = socket_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let listener = match UnixListener::bind(&socket_path) {
        Ok(l) => l,
        Err(e) => {
            log::warn!("Failed to bind vexview IPC socket at {:?}: {}", socket_path, e);
            return;
        }
    };

    let _ = std::fs::set_permissions(&socket_path, std::fs::Permissions::from_mode(0o700));

    std::thread::spawn(move || {
        for stream_res in listener.incoming() {
            match stream_res {
                Ok(mut stream) => {
                    let stream_clone = match stream.try_clone() {
                        Ok(c) => c,
                        Err(_) => continue,
                    };
                    let mut reader = BufReader::new(stream_clone);
                    let mut line = String::new();
                    if reader.read_line(&mut line).is_ok() {
                        let trimmed = line.trim();
                        if let Ok(msg) = serde_json::from_str::<IpcMessage>(trimmed) {
                            match msg {
                                IpcMessage::Open(payload) => {
                                    let handle = app_handle.clone();
                                    let payload_clone = payload.clone();
                                    let _ = app_handle.run_on_main_thread(move || {
                                        if let Some(window) = handle.get_webview_window("main") {
                                            let _ = window.show();
                                            let _ = window.unminimize();
                                            let _ = window.set_focus();
                                            if payload_clone.fullscreen {
                                                let _ = window.set_fullscreen(true);
                                            }
                                        }
                                        let _ = handle.emit("cli-open-target", payload_clone);
                                    });
                                    let resp = IpcResponse {
                                        ok: true,
                                        message: None,
                                    };
                                    if let Ok(resp_bytes) = serde_json::to_vec(&resp) {
                                        let _ = stream.write_all(&resp_bytes);
                                        let _ = stream.write_all(b"\n");
                                        let _ = stream.flush();
                                    }
                                }
                                IpcMessage::Quit => {
                                    let resp = IpcResponse {
                                        ok: true,
                                        message: Some("exiting".to_string()),
                                    };
                                    if let Ok(resp_bytes) = serde_json::to_vec(&resp) {
                                        let _ = stream.write_all(&resp_bytes);
                                        let _ = stream.write_all(b"\n");
                                        let _ = stream.flush();
                                    }
                                    let handle = app_handle.clone();
                                    let _ = app_handle.run_on_main_thread(move || {
                                        handle.exit(0);
                                    });
                                    break;
                                }
                                IpcMessage::Ping => {
                                    let resp = IpcResponse {
                                        ok: true,
                                        message: Some("pong".to_string()),
                                    };
                                    if let Ok(resp_bytes) = serde_json::to_vec(&resp) {
                                        let _ = stream.write_all(&resp_bytes);
                                        let _ = stream.write_all(b"\n");
                                        let _ = stream.flush();
                                    }
                                }
                            }
                        }
                    }
                }
                Err(_) => {}
            }
        }
        let _ = std::fs::remove_file(&socket_path);
    });
}

#[cfg(not(unix))]
pub fn start_ipc_listener(_app_handle: tauri::AppHandle) {}
