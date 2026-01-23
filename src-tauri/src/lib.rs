use mysql::prelude::*;
use mysql::{OptsBuilder, Pool, PoolConstraints, PoolOpts};
use serde::{Deserialize, Serialize};
use ssh2::Session;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use tauri::{Emitter, Manager, State};

// Database Connection Management
struct DbConnection {
    pool: Pool,
    tunnel_stop: Option<Arc<AtomicBool>>, // If tunnel is used, set this to true to stop it
}

#[derive(Deserialize)]
struct SshConfig {
    ip: String,
    port: u16,
    user: String,
    pass: Option<String>,
    private_key: Option<String>,
}

// PTY Session Management
struct PtySession {
    sender: std::sync::mpsc::Sender<Vec<u8>>,
    resize_sender: std::sync::mpsc::Sender<(u32, u32)>,
}

struct SessionInfo {
    session: Session,
    cwd: String,
    ip: String,
    port: u16,
    user: String,
    pass: Option<String>,
}

struct AppState {
    sessions: Mutex<HashMap<String, Arc<Mutex<SessionInfo>>>>,
    pty_sessions: Mutex<HashMap<String, PtySession>>,
    current_session_id: Mutex<Option<String>>,
    db_connections: Mutex<HashMap<String, DbConnection>>,
}

#[derive(Serialize)]
struct CommandResult {
    stdout: String,
    stderr: String,
    exit_code: i32,
    cwd: String,
}

#[derive(Deserialize)]
struct BatchCommandRequest {
    id: String,
    cmd: String,
}

#[derive(Serialize, Clone)]
struct StreamOutput {
    session_id: String,
    output_type: String, // "stdout" or "stderr"
    content: String,
}

#[derive(Serialize, Clone)]
struct CommandComplete {
    session_id: String,
    exit_code: i32,
    cwd: String,
}

use uuid::Uuid;

#[derive(Serialize)]
struct SessionSummary {
    id: String,
    ip: String,
    port: u16,
    user: String,
    is_current: bool,
}

#[derive(Serialize)]
struct DbQueryResult {
    headers: Vec<String>,
    rows: Vec<Vec<String>>,
    affected_rows: u64,
    last_insert_id: Option<u64>,
}

#[derive(Serialize)]
struct FileEntry {
    name: String,
    is_dir: bool,
    size: u64,
    mtime: u64,
}

#[tauri::command]
async fn sftp_ls(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<Vec<FileEntry>, String> {
    let session_arc = {
        let sessions = state.sessions.lock().unwrap();
        sessions
            .get(&session_id)
            .cloned()
            .ok_or(format!("Session {} not found", session_id))?
    };

    tauri::async_runtime::spawn_blocking(move || {
        let session_info = session_arc.lock().unwrap();
        let sftp = session_info.session.sftp().map_err(|e| e.to_string())?;

        let path_path = std::path::Path::new(&path);

        let entries = sftp.readdir(path_path).map_err(|e| e.to_string())?;

        let mut files = Vec::new();
        for (p, stat) in entries {
            let name = p
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            if name == "." || name == ".." {
                continue;
            }

            files.push(FileEntry {
                name,
                is_dir: stat.is_dir(),
                size: stat.size.unwrap_or(0),
                mtime: stat.mtime.unwrap_or(0),
            });
        }

        files.sort_by(|a, b| {
            if a.is_dir == b.is_dir {
                a.name.cmp(&b.name)
            } else {
                b.is_dir.cmp(&a.is_dir)
            }
        });

        Ok(files)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn sftp_read(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<String, String> {
    let session_arc = {
        let sessions = state.sessions.lock().unwrap();
        sessions
            .get(&session_id)
            .cloned()
            .ok_or(format!("Session {} not found", session_id))?
    };

    tauri::async_runtime::spawn_blocking(move || {
        let session_info = session_arc.lock().unwrap();
        let sftp = session_info.session.sftp().map_err(|e| e.to_string())?;

        let mut file = sftp
            .open(std::path::Path::new(&path))
            .map_err(|e| e.to_string())?;
        let mut content = String::new();
        // Limit read size to avoid crashing on huge files? For now, read all.
        // Or maybe just first 100KB for preview.
        // Let's read all but catch error if not UTF-8
        file.read_to_string(&mut content)
            .map_err(|e| e.to_string())?;

        Ok(content)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn sftp_read_binary(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<Vec<u8>, String> {
    let session_arc = {
        let sessions = state.sessions.lock().unwrap();
        sessions
            .get(&session_id)
            .cloned()
            .ok_or(format!("Session {} not found", session_id))?
    };

    tauri::async_runtime::spawn_blocking(move || {
        let session_info = session_arc.lock().unwrap();
        let sftp = session_info.session.sftp().map_err(|e| e.to_string())?;

        let mut file = sftp
            .open(std::path::Path::new(&path))
            .map_err(|e| e.to_string())?;
        let mut content = Vec::new();
        file.read_to_end(&mut content).map_err(|e| e.to_string())?;

        Ok(content)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn sftp_write_binary(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
    content: Vec<u8>,
) -> Result<(), String> {
    let session_arc = {
        let sessions = state.sessions.lock().unwrap();
        sessions
            .get(&session_id)
            .cloned()
            .ok_or(format!("Session {} not found", session_id))?
    };

    tauri::async_runtime::spawn_blocking(move || {
        let session_info = session_arc.lock().unwrap();
        let sftp = session_info.session.sftp().map_err(|e| e.to_string())?;

        let mut file = sftp
            .create(std::path::Path::new(&path))
            .map_err(|e| e.to_string())?;
        file.write_all(&content).map_err(|e| e.to_string())?;

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn sftp_delete(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
    is_dir: bool,
) -> Result<(), String> {
    let session_arc = {
        let sessions = state.sessions.lock().unwrap();
        sessions
            .get(&session_id)
            .cloned()
            .ok_or(format!("Session {} not found", session_id))?
    };

    tauri::async_runtime::spawn_blocking(move || {
        let session_info = session_arc.lock().unwrap();
        let sftp = session_info.session.sftp().map_err(|e| e.to_string())?;

        let path_path = std::path::Path::new(&path);

        if is_dir {
            sftp.rmdir(path_path).map_err(|e| e.to_string())?;
        } else {
            sftp.unlink(path_path).map_err(|e| e.to_string())?;
        }

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn connect_ssh(
    state: State<'_, AppState>,
    ip: String,
    port: u16,
    user: String,
    pass: Option<String>,
    private_key: Option<String>,
) -> Result<String, String> {
    let tcp = TcpStream::connect(format!("{}:{}", ip, port)).map_err(|e| e.to_string())?;
    let mut sess = Session::new().unwrap();
    sess.set_tcp_stream(tcp);
    sess.handshake().map_err(|e| e.to_string())?;

    if let Some(ref p) = pass {
        sess.userauth_password(&user, p)
            .map_err(|e| e.to_string())?;
    } else if let Some(pk) = private_key {
        sess.userauth_pubkey_file(&user, None, std::path::Path::new(&pk), None)
            .map_err(|e| e.to_string())?;
    } else {
        return Err("Password or private key required".to_string());
    }

    if !sess.authenticated() {
        return Err("Authentication failed".to_string());
    }

    // Get initial CWD
    let mut channel = sess.channel_session().map_err(|e| e.to_string())?;
    channel.exec("pwd").map_err(|e| e.to_string())?;
    let mut s = String::new();
    channel.read_to_string(&mut s).map_err(|e| e.to_string())?;
    channel.wait_close().map_err(|e| e.to_string())?;
    let initial_cwd = s.trim().to_string();

    // Generate unique session ID
    let session_id = Uuid::new_v4().to_string();

    // Create session info
    let session_info = SessionInfo {
        session: sess,
        cwd: initial_cwd,
        ip: ip.clone(),
        port,
        user: user.clone(),
        pass: pass.clone(),
    };

    // Store session wrapped in Arc<Mutex>
    {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(session_id.clone(), Arc::new(Mutex::new(session_info)));
    }

    *state.current_session_id.lock().unwrap() = Some(session_id.clone());

    Ok(session_id)
}

#[tauri::command]
fn disconnect_ssh(
    state: State<'_, AppState>,
    session_id: Option<String>,
) -> Result<String, String> {
    let id_to_disconnect = match session_id {
        Some(id) => Some(id),
        None => state.current_session_id.lock().unwrap().clone(),
    };

    if let Some(id) = id_to_disconnect {
        let mut removed = false;
        let mut next_current: Option<String> = None;
        {
            let mut sessions = state.sessions.lock().unwrap();
            if sessions.remove(&id).is_some() {
                removed = true;
                if sessions.is_empty() {
                    next_current = None;
                } else {
                    next_current = sessions.keys().next().cloned();
                }
            }
        }

        if removed {
            let mut current_session = state.current_session_id.lock().unwrap();
            if current_session.as_ref() == Some(&id) {
                *current_session = next_current;
            }
            Ok(format!("Disconnected session {}", id))
        } else {
            Err(format!("Session {} not found", id))
        }
    } else {
        Err("No session to disconnect".to_string())
    }
}

#[tauri::command]
async fn exec_command_stream(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    cmd: String,
    session_id: Option<String>,
) -> Result<String, String> {
    // Get session to use
    let id_to_use = session_id.or_else(|| state.current_session_id.lock().unwrap().clone());

    if let Some(id) = id_to_use {
        // Generate unique command ID
        let command_id = Uuid::new_v4().to_string();

        let session_arc = {
            let sessions = state.sessions.lock().unwrap();
            sessions
                .get(&id)
                .cloned()
                .ok_or(format!("Session {} not found", id))?
        };

        // Spawn blocking task to avoid holding up the async runtime
        let app_clone = app.clone();
        let session_id_clone = id.clone();
        let _command_id_clone = command_id.clone();

        std::thread::spawn(move || {
            let mut session_info = session_arc.lock().unwrap();
            let current_cwd = session_info.cwd.clone();
            let sess = &mut session_info.session;

            // Wrapper to preserve CWD
            const MARKER: &str = "___CWD___";
            let wrapped_cmd = format!(
                "cd \"{}\" && {{ {}; }}; RET=$?; echo \"{}\"; pwd; exit $RET",
                current_cwd, cmd, MARKER
            );

            let mut channel = match sess.channel_session() {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Failed to create channel: {}", e);
                    return;
                }
            };

            if let Err(e) = channel.exec(&wrapped_cmd) {
                eprintln!("Failed to exec command: {}", e);
                return;
            }

            let mut stdout = String::new();
            let mut stderr = String::new();
            let mut all_output = String::new();

            // Read stdout in chunks
            let mut buffer = [0; 1024];
            loop {
                match channel.read(&mut buffer) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let chunk = String::from_utf8_lossy(&buffer[..n]);
                        stdout.push_str(&chunk);
                        all_output.push_str(&chunk);

                        // Send stdout chunk
                        let output = StreamOutput {
                            session_id: session_id_clone.clone(),
                            output_type: "stdout".to_string(),
                            content: chunk.to_string(),
                        };
                        let _ = app_clone.emit("command_output", output);
                    }
                    Err(e) => {
                        eprintln!("Error reading stdout: {}", e);
                        break;
                    }
                }
            }

            // Read stderr in chunks
            let mut buffer = [0; 1024];
            while let Ok(n) = channel.stderr().read(&mut buffer) {
                if n == 0 {
                    break; // EOF
                }
                let chunk = String::from_utf8_lossy(&buffer[..n]);
                stderr.push_str(&chunk);

                // Send stderr chunk
                let output = StreamOutput {
                    session_id: session_id_clone.clone(),
                    output_type: "stderr".to_string(),
                    content: chunk.to_string(),
                };
                let _ = app_clone.emit("command_output", output);
            }

            // Wait for command to complete
            let _ = channel.wait_close();
            let exit_code = channel.exit_status().unwrap_or(-1);

            // Parse output to get new CWD
            let new_cwd = if let Some((_, cwd_part)) = all_output.rsplit_once(MARKER) {
                cwd_part.trim().to_string()
            } else {
                current_cwd.clone()
            };

            // Send command complete event (frontend will handle CWD update)
            let complete = CommandComplete {
                session_id: session_id_clone.clone(),
                exit_code,
                cwd: new_cwd,
            };
            let _ = app_clone.emit("command_complete", complete);
        });

        Ok(command_id)
    } else {
        Err("No session connected".to_string())
    }
}

fn reconnect_ssh_session(session_info: &mut SessionInfo, timeout: u32) -> Result<(), String> {
    let password = session_info
        .pass
        .clone()
        .ok_or("SSH session lost and no password stored for reconnect".to_string())?;

    let tcp =
        TcpStream::connect(format!("{}:{}", session_info.ip, session_info.port)).map_err(|e| {
            format!(
                "SSH session lost and reconnect TCP failed ({}:{}): {}",
                session_info.ip, session_info.port, e
            )
        })?;

    let mut sess = Session::new().map_err(|e| format!("Failed to create SSH session: {}", e))?;
    sess.set_tcp_stream(tcp);
    sess.handshake()
        .map_err(|e| format!("SSH session lost and reconnect handshake failed: {}", e))?;
    sess.userauth_password(&session_info.user, &password)
        .map_err(|e| format!("SSH session lost and reconnect auth failed: {}", e))?;

    if !sess.authenticated() {
        return Err("SSH session lost and reconnect authentication failed".to_string());
    }

    sess.set_timeout(timeout);
    session_info.session = sess;
    session_info.cwd = "/".to_string();
    Ok(())
}

// Helper function to execute a single command on a session
fn execute_single_command(
    session_info: &mut SessionInfo,
    cmd: &str,
    timeout: u32,
) -> Result<CommandResult, String> {
    let current_cwd = session_info.cwd.clone();
    session_info.session.set_timeout(timeout);

    const MARKER: &str = "___CWD___";
    let wrapped_cmd = format!(
        "cd \"{}\" && {{ {}; }}; RET=$?; echo \"{}\"; pwd; exit $RET",
        current_cwd, cmd, MARKER
    );

    let mut channel = match session_info.session.channel_session() {
        Ok(ch) => ch,
        Err(e) => {
            reconnect_ssh_session(session_info, timeout)?;
            session_info
                .session
                .channel_session()
                .map_err(|e2| format!("{}; after reconnect: {}", e, e2))?
        }
    };
    channel.exec(&wrapped_cmd).map_err(|e| e.to_string())?;

    let mut s = String::new();
    channel
        .read_to_string(&mut s)
        .map_err(|e: std::io::Error| e.to_string())?;

    let mut e = String::new();
    channel
        .stderr()
        .read_to_string(&mut e)
        .map_err(|e: std::io::Error| e.to_string())?;

    channel.wait_close().map_err(|e| e.to_string())?;
    let exit_code = channel.exit_status().map_err(|e| e.to_string())?;

    // Parse stdout to separate actual output and new CWD
    let (stdout, new_cwd) = if let Some((out, cwd_part)) = s.rsplit_once(MARKER) {
        let cwd = cwd_part.trim().to_string();
        (out.to_string(), cwd)
    } else {
        (s, current_cwd)
    };

    // Update session CWD if we got a valid CWD back
    if !new_cwd.is_empty() {
        session_info.cwd = new_cwd.clone();
    }

    Ok(CommandResult {
        stdout,
        stderr: e,
        exit_code,
        cwd: new_cwd,
    })
}

#[tauri::command]
async fn exec_command(
    state: State<'_, AppState>,
    cmd: String,
    session_id: Option<String>,
    timeout: Option<u32>,
) -> Result<CommandResult, String> {
    let id_to_use = session_id.or_else(|| state.current_session_id.lock().unwrap().clone());

    if let Some(id) = id_to_use {
        let session_arc = {
            let sessions = state.sessions.lock().unwrap();
            sessions
                .get(&id)
                .cloned()
                .ok_or(format!("Session {} not found", id))?
        };

        // Use spawn_blocking to run the synchronous SSH operation in a thread pool
        let result = tauri::async_runtime::spawn_blocking(move || {
            let mut session_info = session_arc.lock().unwrap();
            execute_single_command(&mut session_info, &cmd, timeout.unwrap_or(30000))
        })
        .await
        .map_err(|e| e.to_string())??;

        Ok(result)
    } else {
        Err("No session connected".to_string())
    }
}

#[tauri::command]
async fn batch_exec_command(
    state: State<'_, AppState>,
    commands: Vec<BatchCommandRequest>,
    session_id: Option<String>,
    timeout: Option<u32>,
) -> Result<HashMap<String, CommandResult>, String> {
    let id_to_use = session_id.or_else(|| state.current_session_id.lock().unwrap().clone());

    if let Some(id) = id_to_use {
        let session_arc = {
            let sessions = state.sessions.lock().unwrap();
            sessions
                .get(&id)
                .cloned()
                .ok_or(format!("Session {} not found", id))?
        };

        let result = tauri::async_runtime::spawn_blocking(move || {
            let mut session_info = session_arc.lock().unwrap();
            let mut results = HashMap::new();

            for req in commands {
                // Individual command timeout or default
                let res =
                    execute_single_command(&mut session_info, &req.cmd, timeout.unwrap_or(30000));
                match res {
                    Ok(r) => {
                        results.insert(req.id, r);
                    }
                    Err(e) => {
                        results.insert(
                            req.id,
                            CommandResult {
                                stdout: String::new(),
                                stderr: e,
                                exit_code: -1,
                                cwd: session_info.cwd.clone(),
                            },
                        );
                    }
                }
            }
            results
        })
        .await
        .map_err(|e| e.to_string())?;

        Ok(result)
    } else {
        Err("No session connected".to_string())
    }
}

#[tauri::command]
fn list_sessions(state: State<'_, AppState>) -> Result<Vec<SessionSummary>, String> {
    let current_id = state.current_session_id.lock().unwrap().clone();
    let sessions = state.sessions.lock().unwrap();

    let summaries: Vec<SessionSummary> = sessions
        .iter()
        .map(|(id, info_arc)| {
            let info = info_arc.lock().unwrap();
            SessionSummary {
                id: id.clone(),
                ip: info.ip.clone(),
                port: info.port,
                user: info.user.clone(),
                is_current: current_id.as_ref() == Some(id),
            }
        })
        .collect();

    Ok(summaries)
}

#[tauri::command]
fn switch_session(state: State<'_, AppState>, session_id: String) -> Result<String, String> {
    {
        let sessions = state.sessions.lock().unwrap();
        if !sessions.contains_key(&session_id) {
            return Err(format!("Session {} not found", session_id));
        }
    }

    *state.current_session_id.lock().unwrap() = Some(session_id.clone());
    Ok(format!("Switched to session {}", session_id))
}

#[tauri::command]
fn start_pty_session(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    cols: u32,
    rows: u32,
) -> Result<String, String> {
    // Retrieve session info
    let session_arc = {
        let sessions = state.sessions.lock().unwrap();
        sessions
            .get(&session_id)
            .cloned()
            .ok_or(format!("Session {} not found", session_id))?
    };

    let (ip, port, user, pass) = {
        let info = session_arc.lock().unwrap();
        (
            info.ip.clone(),
            info.port,
            info.user.clone(),
            info.pass.clone(),
        )
    };

    let password =
        pass.ok_or("No password stored for this session. Re-authentication required.".to_string())?;

    // Connect SSH
    let tcp = TcpStream::connect(format!("{}:{}", ip, port)).map_err(|e| e.to_string())?;
    let mut sess = Session::new().unwrap();
    sess.set_tcp_stream(tcp);
    sess.handshake().map_err(|e| e.to_string())?;
    sess.userauth_password(&user, &password)
        .map_err(|e| e.to_string())?;

    if !sess.authenticated() {
        return Err("Authentication failed".to_string());
    }

    let mut channel = sess.channel_session().map_err(|e| e.to_string())?;
    channel
        .request_pty("xterm-256color", None, Some((cols, rows, 0, 0)))
        .map_err(|e| e.to_string())?;
    channel.shell().map_err(|e| e.to_string())?;

    let pty_id = Uuid::new_v4().to_string();
    let pty_id_clone = pty_id.clone();

    // Channel for writing to PTY
    let (sender, receiver) = std::sync::mpsc::channel::<Vec<u8>>();
    // Channel for resizing
    let (resize_sender, resize_receiver) = std::sync::mpsc::channel::<(u32, u32)>();

    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        sess.set_blocking(false);

        loop {
            // 1. Write data from frontend
            while let Ok(data) = receiver.try_recv() {
                let _ = channel.write_all(&data);
                let _ = channel.flush();
            }

            // 2. Handle Resize
            while let Ok((c, r)) = resize_receiver.try_recv() {
                let _ = channel.request_pty_size(c, r, Some(0), Some(0));
            }

            // 3. Read data from SSH
            match channel.read(&mut buf) {
                Ok(n) if n > 0 => {
                    let data = buf[..n].to_vec();
                    let content = String::from_utf8_lossy(&data).to_string();
                    let _ = app.emit(
                        "pty_data",
                        serde_json::json!({
                            "id": pty_id_clone,
                            "data": content
                        }),
                    );
                }
                Ok(_) => { /* No data */ }
                Err(e) => {
                    if e.kind() != std::io::ErrorKind::WouldBlock {
                        break; // Error or closed
                    }
                }
            }

            // 4. Check if closed
            if channel.eof() {
                break;
            }

            thread::sleep(std::time::Duration::from_millis(10));
        }
        let _ = channel.close();
    });

    let mut pty_sessions = state.pty_sessions.lock().unwrap();
    pty_sessions.insert(
        pty_id.clone(),
        PtySession {
            sender,
            resize_sender,
        },
    );

    Ok(pty_id)
}

#[tauri::command]
fn write_pty(state: State<'_, AppState>, id: String, data: String) -> Result<(), String> {
    let sessions = state.pty_sessions.lock().unwrap();
    if let Some(session) = sessions.get(&id) {
        let _ = session.sender.send(data.into_bytes());
        Ok(())
    } else {
        Err("PTY session not found".to_string())
    }
}

#[tauri::command]
fn resize_pty(state: State<'_, AppState>, id: String, cols: u32, rows: u32) -> Result<(), String> {
    let sessions = state.pty_sessions.lock().unwrap();
    if let Some(session) = sessions.get(&id) {
        let _ = session.resize_sender.send((cols, rows));
        Ok(())
    } else {
        Err("PTY session not found".to_string())
    }
}

#[tauri::command]
fn stop_pty_session(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let mut sessions = state.pty_sessions.lock().unwrap();
    if sessions.remove(&id).is_some() {
        Ok(())
    } else {
        Err("PTY session not found".to_string())
    }
}

#[tauri::command]
async fn connect_db(
    state: State<'_, AppState>,
    id: String,
    host: String,
    port: u16,
    user: String,
    pass: String,
    database: String,
    ssh_config: Option<SshConfig>,
) -> Result<String, String> {
    println!(
        "[Connect DB] ID: {}, Host: {}, Port: {}, User: {}, DB: {}",
        id, host, port, user, database
    );

    let (final_host, final_port, tunnel_stop) = if let Some(ssh) = ssh_config {
        println!("[Connect DB] Using SSH Tunnel: {}:{}", ssh.ip, ssh.port);
        // 1. Connect SSH (Dedicated Session)
        let tcp = TcpStream::connect(format!("{}:{}", ssh.ip, ssh.port))
            .map_err(|e| format!("SSH TCP Connect failed: {}", e))?;
        let mut sess = Session::new().unwrap();
        sess.set_tcp_stream(tcp);
        sess.handshake()
            .map_err(|e| format!("SSH Handshake failed: {}", e))?;

        if let Some(pk) = ssh.private_key {
            println!("[Connect DB] SSH Auth: Private Key ({})", pk);
            sess.userauth_pubkey_file(&ssh.user, None, std::path::Path::new(&pk), None)
                .map_err(|e| format!("SSH Pubkey Auth failed: {}", e))?;
        } else if let Some(p) = ssh.pass {
            println!("[Connect DB] SSH Auth: Password");
            sess.userauth_password(&ssh.user, &p)
                .map_err(|e| format!("SSH Password Auth failed: {}", e))?;
        } else {
            return Err("SSH Password or Key required".to_string());
        }

        if !sess.authenticated() {
            return Err("SSH Auth failed".to_string());
        }

        // 2. Start Listener on random port
        let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
        let local_port = listener.local_addr().map_err(|e| e.to_string())?.port();
        println!("[Connect DB] SSH Tunnel Local Port: {}", local_port);

        let stop_signal = Arc::new(AtomicBool::new(false));
        let stop_clone = stop_signal.clone();

        let mut target_host = host.clone();
        let target_port = port;

        // Auto-fix: If DB Host is same as SSH Host, use 127.0.0.1 for tunnel target
        // This handles the case where user wants to connect to "localhost" DB on the SSH server
        // but entered the public IP in both fields.
        if target_host == ssh.ip {
            println!("[Connect DB] Auto-fix: DB Host equals SSH Host ({}), using 127.0.0.1 for tunnel target", target_host);
            target_host = "127.0.0.1".to_string();
        }

        // 3. Spawn Tunnel Thread
        // Note: Since ssh2::Channel borrows from Session, and we want to run this in a thread,
        // we move the Session into the thread. The Session is dedicated to this tunnel.
        thread::spawn(move || {
            // Set non-blocking to check for stop signal
            listener.set_nonblocking(true).ok();
            println!(
                "[SSH Tunnel] Started forwarding to {}:{}",
                target_host, target_port
            );

            // We can only handle one active connection efficiently with this simple blocking model
            // or we need a complex non-blocking loop handling multiple channels.
            // For a single user DB connection, one TCP stream (reused) is often enough if Pool size is 1.

            loop {
                if stop_clone.load(Ordering::Relaxed) {
                    println!("[SSH Tunnel] Stop signal received");
                    break;
                }

                match listener.accept() {
                    Ok((mut stream, addr)) => {
                        println!("[SSH Tunnel] New connection from {}", addr);
                        // Open Channel
                        match sess.channel_direct_tcpip(&target_host, target_port, None) {
                            Ok(mut channel) => {
                                println!("[SSH Tunnel] Channel opened");
                                // Bridge Loop (Blocking with timeout/non-blocking check)
                                stream.set_nonblocking(true).ok();
                                // We can't set channel non-blocking easily on the fly without sess.set_blocking(false)
                                // But sess is owned here.
                                sess.set_blocking(false);

                                let mut buf = [0u8; 8192];
                                loop {
                                    if stop_clone.load(Ordering::Relaxed) {
                                        break;
                                    }

                                    let mut active = false;

                                    // Stream -> Channel
                                    match stream.read(&mut buf) {
                                        Ok(n) => {
                                            if n > 0 {
                                                if let Err(e) = channel.write_all(&buf[..n]) {
                                                    println!(
                                                        "[SSH Tunnel] Write to channel failed: {}",
                                                        e
                                                    );
                                                    break;
                                                }
                                                active = true;
                                            } else {
                                                println!("[SSH Tunnel] Client EOF");
                                                break; // EOF
                                            }
                                        }
                                        Err(ref e)
                                            if e.kind() == std::io::ErrorKind::WouldBlock => {}
                                        Err(e) => {
                                            println!("[SSH Tunnel] Read from stream failed: {}", e);
                                            break;
                                        }
                                    }

                                    // Channel -> Stream
                                    match channel.read(&mut buf) {
                                        Ok(n) => {
                                            if n > 0 {
                                                if let Err(e) = stream.write_all(&buf[..n]) {
                                                    println!(
                                                        "[SSH Tunnel] Write to stream failed: {}",
                                                        e
                                                    );
                                                    break;
                                                }
                                                active = true;
                                            } else {
                                                println!("[SSH Tunnel] Remote EOF");
                                                break; // EOF
                                            }
                                        }
                                        Err(ref e)
                                            if e.kind() == std::io::ErrorKind::WouldBlock => {}
                                        Err(e) => {
                                            println!(
                                                "[SSH Tunnel] Read from channel failed: {}",
                                                e
                                            );
                                            break;
                                        }
                                    }

                                    if !active {
                                        thread::sleep(std::time::Duration::from_millis(1));
                                    }
                                }
                                sess.set_blocking(true); // Reset?
                                println!("[SSH Tunnel] Connection closed");
                            }
                            Err(e) => eprintln!("Tunnel open failed: {}", e),
                        }
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(std::time::Duration::from_millis(100));
                    }
                    Err(e) => {
                        println!("[SSH Tunnel] Accept failed: {}", e);
                        break;
                    }
                }
            }
        });

        ("127.0.0.1".to_string(), local_port, Some(stop_signal))
    } else {
        println!("[Connect DB] Direct Connection");
        (host, port, None)
    };

    println!(
        "[Connect DB] MySQL Options: Host={}, Port={}",
        final_host, final_port
    );

    // Connect MySQL
    let mut opts_builder = OptsBuilder::new()
        .ip_or_hostname(Some(final_host))
        .tcp_port(final_port)
        .user(Some(user))
        .pass(Some(pass))
        .db_name(Some(database));

    // Important: Limit pool size to 1 if using tunnel to avoid concurrency issues with our simple tunnel
    if tunnel_stop.is_some() {
        // PoolConstraints::new(min, max, max_lifetime) or similar.
        // In mysql 27, PoolConstraints::new(min, max) returns Option<PoolConstraints>
        if let Some(constraints) = PoolConstraints::new(1, 1) {
            let pool_opts = PoolOpts::default().with_constraints(constraints);
            opts_builder = opts_builder.pool_opts(pool_opts);
        }
    }

    let opts = mysql::Opts::from(opts_builder);
    println!("[Connect DB] Creating Pool...");
    let pool = Pool::new(opts).map_err(|e| {
        println!("[Connect DB] Pool Creation Failed: {}", e);
        e.to_string()
    })?;

    // Store
    let mut dbs = state.db_connections.lock().unwrap();
    if let Some(old_conn) = dbs.insert(id.clone(), DbConnection { pool, tunnel_stop }) {
        if let Some(stop) = old_conn.tunnel_stop {
            stop.store(true, Ordering::Relaxed);
        }
    }

    println!("[Connect DB] Success: {}", id);
    Ok(id)
}

#[tauri::command]
fn disconnect_db(state: State<'_, AppState>, id: String) -> Result<String, String> {
    let mut dbs = state.db_connections.lock().unwrap();
    if let Some(conn) = dbs.remove(&id) {
        if let Some(stop) = conn.tunnel_stop {
            stop.store(true, Ordering::Relaxed);
        }
        // Pool is dropped, connections closed.
        Ok(format!("Disconnected DB {}", id))
    } else {
        Err("DB Session not found".to_string())
    }
}

#[tauri::command]
async fn exec_sql(
    state: State<'_, AppState>,
    id: String,
    query: String,
) -> Result<DbQueryResult, String> {
    let pool = {
        let dbs = state.db_connections.lock().unwrap();
        let conn = dbs.get(&id).ok_or("DB Session not found")?;
        conn.pool.clone()
    };

    tauri::async_runtime::spawn_blocking(move || {
        let mut conn = pool.get_conn().map_err(|e| e.to_string())?;

        let result = conn.query_iter(query).map_err(|e| e.to_string())?;

        let mut headers = Vec::new();
        let mut rows = Vec::new();

        // Get columns
        for col in result.columns().as_ref() {
            headers.push(col.name_str().to_string());
        }

        let affected = result.affected_rows();
        let last_id = result.last_insert_id();

        for row in result {
            let r = row.map_err(|e| e.to_string())?;
            let mut row_data = Vec::new();
            for i in 0..r.len() {
                let val: Option<String> = r.get_opt(i).unwrap_or(Ok(None)).ok().flatten();
                row_data.push(val.unwrap_or_else(|| "NULL".to_string()));
            }
            rows.push(row_data);
        }

        Ok(DbQueryResult {
            headers,
            rows,
            affected_rows: affected,
            last_insert_id: last_id,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

// Need to update exec_sql signature to async to use pool properly without blocking main loop?
// Actually mysql crate is blocking. If I make the function `async`, I should wrap the blocking call.

#[tauri::command]
async fn exec_local_command(cmd: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "windows")]
        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &cmd])
            .output()
            .map_err(|e| e.to_string())?;

        #[cfg(not(target_os = "windows"))]
        let output = std::process::Command::new("sh")
            .arg("-c")
            .arg(&cmd)
            .output()
            .map_err(|e| e.to_string())?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if output.status.success() {
            Ok(stdout)
        } else {
            Ok(format!(
                "Execution failed (Exit code: {}):\nStdout: {}\nStderr: {}",
                output.status, stdout, stderr
            ))
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(AppState {
                sessions: Mutex::new(HashMap::new()),
                pty_sessions: Mutex::new(HashMap::new()),
                current_session_id: Mutex::new(None),
                db_connections: Mutex::new(HashMap::new()),
            });
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler!(
            connect_ssh,
            disconnect_ssh,
            exec_command,
            batch_exec_command,
            exec_command_stream,
            exec_local_command,
            list_sessions,
            switch_session,
            start_pty_session,
            write_pty,
            resize_pty,
            stop_pty_session,
            connect_db,
            disconnect_db,
            exec_sql,
            sftp_ls,
            sftp_read,
            sftp_read_binary,
            sftp_write_binary,
            sftp_delete
        ))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
