use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine as _;
use chrono;
use mysql::prelude::*;
use mysql::{OptsBuilder, Pool, PoolConstraints, PoolOpts};
use serde::{Deserialize, Serialize};
use socks::Socks5Stream;
use ssh2::Session;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager, State};
mod license;
mod updater;

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

#[derive(Deserialize, Clone)]
struct ProxyConfig {
    #[serde(rename = "type")]
    proxy_type: String,
    host: String,
    port: u16,
    username: Option<String>,
    password: Option<String>,
}

#[derive(Serialize)]
struct BenefitAiConfig {
    provider_id: String,
    api_key: String,
    base_url: String,
    model: String,
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
    note: String,
    initial_history_count: Option<usize>, // 记录登录时的历史行数
    connect_timestamp: String, // 记录连接时间戳，用于精确清理日志
}

struct AppState {
    sessions: Mutex<HashMap<String, Arc<Mutex<SessionInfo>>>>,
    session_order: Mutex<Vec<String>>,
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
    command_id: String,
    session_id: String,
    output_type: String, // "stdout" or "stderr"
    content: String,
}

#[derive(Serialize, Clone)]
struct CommandComplete {
    command_id: String,
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
    note: String,
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

#[derive(Serialize)]
struct WebSearchItem {
    title: String,
    url: String,
    snippet: String,
    engine: String,
}

#[derive(Serialize)]
struct WebPageResult {
    url: String,
    title: String,
    content: String,
}

fn decode_html_entities(input: &str) -> String {
    input
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
}

fn strip_html_tags(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut in_tag = false;
    let mut last_was_space = false;

    for ch in input.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => {
                if ch.is_whitespace() {
                    if !last_was_space {
                        output.push(' ');
                        last_was_space = true;
                    }
                } else {
                    output.push(ch);
                    last_was_space = false;
                }
            }
            _ => {}
        }
    }

    decode_html_entities(output.trim())
}

fn extract_html_title(input: &str) -> String {
    let lower = input.to_lowercase();
    if let Some(start) = lower.find("<title>") {
        if let Some(end) = lower[start + 7..].find("</title>") {
            return strip_html_tags(&input[start + 7..start + 7 + end]);
        }
    }
    String::new()
}

fn truncate_text(input: String, limit: usize) -> String {
    if input.chars().count() <= limit {
        return input;
    }

    let truncated: String = input.chars().take(limit).collect();
    format!("{truncated}...")
}

fn extract_between<'a>(input: &'a str, start: &str, end: &str) -> Option<&'a str> {
    let start_index = input.find(start)?;
    let content_start = start_index + start.len();
    let end_index = input[content_start..].find(end)?;
    Some(&input[content_start..content_start + end_index])
}

fn extract_anchor_info(input: &str) -> Option<(String, String)> {
    let anchor_pos = input.find("<a ")?;
    let anchor = &input[anchor_pos..];
    let href = extract_between(anchor, "href=\"", "\"")
        .or_else(|| extract_between(anchor, "href='", "'"))?;
    let title_start = anchor.find('>')? + 1;
    let title_end = anchor[title_start..].find("</a>")?;

    Some((
        strip_html_tags(&anchor[title_start..title_start + title_end]),
        decode_html_entities(href),
    ))
}

fn extract_first_paragraph(input: &str) -> Option<String> {
    let paragraph_pos = input.find("<p")?;
    let paragraph = &input[paragraph_pos..];
    let content_start = paragraph.find('>')? + 1;
    let content_end = paragraph[content_start..].find("</p>")?;
    Some(strip_html_tags(
        &paragraph[content_start..content_start + content_end],
    ))
}

fn is_search_result_url(url: &str) -> bool {
    let normalized = url.trim().to_ascii_lowercase();
    if !normalized.starts_with("http://") && !normalized.starts_with("https://") {
        return false;
    }

    if normalized.contains("://r.bing.com/")
        || normalized.contains("://www.bing.com/ck/")
        || normalized.contains("://cn.bing.com/ck/")
    {
        return false;
    }

    let path = normalized
        .split('?')
        .next()
        .unwrap_or(normalized.as_str())
        .split('#')
        .next()
        .unwrap_or(normalized.as_str());

    ![
        ".css", ".js", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff",
        ".woff2", ".ttf", ".map", ".xml",
    ]
    .iter()
    .any(|ext| path.ends_with(ext))
}

fn dedupe_search_items(items: Vec<WebSearchItem>) -> Vec<WebSearchItem> {
    let mut seen = HashSet::new();
    let mut deduped = Vec::new();

    for item in items {
        let key = item.url.trim().to_ascii_lowercase();
        if seen.insert(key) {
            deduped.push(item);
        }
    }

    deduped
}

fn parse_bing_results(html: &str) -> Vec<WebSearchItem> {
    let mut items = Vec::new();
    let mut cursor = html;

    while items.len() < 6 {
        let Some(block_pos) = cursor.find("b_algo") else {
            break;
        };
        cursor = &cursor[block_pos..];

        let next_block_pos = cursor
            .get(1..)
            .and_then(|slice| slice.find("b_algo").map(|pos| pos + 1))
            .unwrap_or(cursor.len());
        let block = &cursor[..next_block_pos];

        let title_scope = if let Some(h2_pos) = block.find("<h2") {
            &block[h2_pos..]
        } else {
            block
        };

        let Some((title, clean_url)) = extract_anchor_info(title_scope) else {
            cursor = &cursor[next_block_pos..];
            continue;
        };

        let snippet = if let Some(snippet_pos) = block.find("b_caption") {
            let snippet_slice = &block[snippet_pos..];
            extract_first_paragraph(snippet_slice)
                .or_else(|| extract_between(snippet_slice, ">", "</div>").map(strip_html_tags))
                .unwrap_or_default()
        } else {
            String::new()
        };

        if is_search_result_url(&clean_url) && !title.is_empty() {
            items.push(WebSearchItem {
                title,
                url: clean_url,
                snippet: truncate_text(snippet, 280),
                engine: "bing".to_string(),
            });
        }

        cursor = &cursor[next_block_pos..];
    }

    dedupe_search_items(items)
}

fn parse_baidu_results(html: &str) -> Vec<WebSearchItem> {
    let mut items = Vec::new();
    let mut cursor = html;

    while items.len() < 6 {
        let next_result_pos = cursor
            .find("result c-container")
            .or_else(|| cursor.find("result-op c-container"))
            .or_else(|| cursor.find("<h3"));
        let Some(block_pos) = next_result_pos else {
            break;
        };
        cursor = &cursor[block_pos..];

        let next_block_pos = cursor
            .get(1..)
            .and_then(|slice| {
                slice
                    .find("result c-container")
                    .or_else(|| slice.find("result-op c-container"))
                    .or_else(|| slice.find("<h3"))
                    .map(|pos| pos + 1)
            })
            .unwrap_or(cursor.len());
        let block = &cursor[..next_block_pos];

        let title_scope = if let Some(h3_pos) = block.find("<h3") {
            &block[h3_pos..]
        } else {
            block
        };

        let Some((title, clean_url)) = extract_anchor_info(title_scope) else {
            cursor = &cursor[next_block_pos..];
            continue;
        };

        let snippet = extract_between(block, "<span class=\"content-right_8Zs40\">", "</span>")
            .or_else(|| extract_between(block, "<div class=\"c-abstract\">", "</div>"))
            .or_else(|| extract_between(block, "<div class=\"content-right_8Zs40\">", "</div>"))
            .map(strip_html_tags)
            .unwrap_or_default();

        if is_search_result_url(&clean_url) && !title.is_empty() {
            items.push(WebSearchItem {
                title,
                url: clean_url,
                snippet: truncate_text(snippet, 280),
                engine: "baidu".to_string(),
            });
        }

        cursor = &cursor[next_block_pos..];
    }

    dedupe_search_items(items)
}

fn ensure_license_valid() -> Result<(), String> {
    license::verify_local_license().map(|_| ())
}

#[tauri::command]
fn get_machine_code() -> Result<String, String> {
    license::get_machine_code()
}

#[tauri::command]
fn activate_license(license_content: String) -> Result<license::LicenseInfo, String> {
    license::activate_license(&license_content)
}

#[tauri::command]
fn get_license_status() -> Result<license::LicenseStatus, String> {
    license::get_license_status()
}

#[tauri::command]
fn get_ai_benefit_config() -> Result<Option<BenefitAiConfig>, String> {
    let api_key = option_env!("FUXI_FREE_API_KEY")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            std::env::var("FUXI_FREE_API_KEY")
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        });

    let Some(api_key) = api_key else {
        return Ok(None);
    };

    let base_url = option_env!("FUXI_FREE_BASE_URL")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            std::env::var("FUXI_FREE_BASE_URL")
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
        .unwrap_or_else(|| "https://linkapi.ai/v1".to_string());

    let model = option_env!("FUXI_FREE_MODEL")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            std::env::var("FUXI_FREE_MODEL")
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
        .unwrap_or_else(|| "gpt-5.3-codex".to_string());

    let provider_id = option_env!("FUXI_FREE_PROVIDER_ID")
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            std::env::var("FUXI_FREE_PROVIDER_ID")
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
        .unwrap_or_else(|| "fuxi".to_string());

    Ok(Some(BenefitAiConfig {
        provider_id,
        api_key,
        base_url,
        model,
    }))
}

#[tauri::command]
async fn check_client_update(
    current_version: String,
) -> Result<updater::ClientUpdateCheckResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ensure_license_valid()?;
        updater::check_client_update(&current_version)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn perform_client_update(
    app: tauri::AppHandle,
    download_url: String,
    version: String,
    package_sha256: String,
) -> Result<String, String> {
    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        ensure_license_valid()?;
        let emit_handle = app_handle.clone();
        let mut last_emit_at = std::time::Instant::now() - Duration::from_millis(300);
        let mut last_percentage = -1.0_f64;
        updater::perform_client_update(
            &download_url,
            &version,
            &package_sha256,
            move |progress| {
                let now = std::time::Instant::now();
                let important_stage = matches!(
                    progress.stage.as_str(),
                    "verify" | "replace" | "restart" | "cancelled" | "retry"
                );
                let should_emit = important_stage
                    || (progress.percentage - last_percentage).abs() >= 1.0
                    || now.duration_since(last_emit_at) >= Duration::from_millis(120);
                if should_emit {
                    last_emit_at = now;
                    last_percentage = progress.percentage;
                    let _ = emit_handle.emit("client-update-progress", progress);
                }
            },
        )?;
        Ok::<(), String>(())
    })
    .await
    .map_err(|e| e.to_string())??;
    app.exit(0);
    Ok("更新程序已启动".to_string())
}

#[tauri::command]
fn cancel_client_update() -> Result<String, String> {
    updater::cancel_client_update();
    Ok("已请求取消更新下载".to_string())
}

fn connect_via_http_proxy(ip: &str, port: u16, proxy: &ProxyConfig) -> Result<TcpStream, String> {
    let mut stream =
        TcpStream::connect(format!("{}:{}", proxy.host, proxy.port)).map_err(|e| e.to_string())?;
    stream
        .set_read_timeout(Some(Duration::from_secs(10)))
        .map_err(|e| e.to_string())?;
    stream
        .set_write_timeout(Some(Duration::from_secs(10)))
        .map_err(|e| e.to_string())?;

    let target = format!("{}:{}", ip, port);
    let mut request = format!(
        "CONNECT {} HTTP/1.1\r\nHost: {}\r\nProxy-Connection: Keep-Alive\r\n",
        target, target
    );

    if let Some(username) = proxy.username.as_ref() {
        let password = proxy.password.as_deref().unwrap_or("");
        let credentials = BASE64_STANDARD.encode(format!("{}:{}", username, password));
        request.push_str(&format!("Proxy-Authorization: Basic {}\r\n", credentials));
    }

    request.push_str("\r\n");
    stream
        .write_all(request.as_bytes())
        .map_err(|e| e.to_string())?;
    stream.flush().map_err(|e| e.to_string())?;

    let mut response = Vec::new();
    let mut buffer = [0u8; 1024];
    loop {
        let read = stream.read(&mut buffer).map_err(|e| e.to_string())?;
        if read == 0 {
            break;
        }
        response.extend_from_slice(&buffer[..read]);
        if response.windows(4).any(|w| w == b"\r\n\r\n") || response.len() > 16 * 1024 {
            break;
        }
    }

    let response_text = String::from_utf8_lossy(&response);
    let first_line = response_text.lines().next().unwrap_or_default();
    if !(first_line.starts_with("HTTP/1.1 200") || first_line.starts_with("HTTP/1.0 200")) {
        return Err(format!("HTTP代理连接失败: {}", first_line));
    }

    Ok(stream)
}

fn connect_tcp_stream(
    ip: &str,
    port: u16,
    proxy: &Option<ProxyConfig>,
) -> Result<TcpStream, String> {
    let Some(proxy_cfg) = proxy.as_ref() else {
        return TcpStream::connect(format!("{}:{}", ip, port)).map_err(|e| e.to_string());
    };

    let mode = proxy_cfg.proxy_type.to_lowercase();
    if mode == "socks5" {
        let stream = match proxy_cfg.username.as_ref() {
            Some(username) => Socks5Stream::connect_with_password(
                format!("{}:{}", proxy_cfg.host, proxy_cfg.port),
                (ip, port),
                username,
                proxy_cfg.password.as_deref().unwrap_or(""),
            )
            .map_err(|e| e.to_string())?,
            None => {
                Socks5Stream::connect(format!("{}:{}", proxy_cfg.host, proxy_cfg.port), (ip, port))
                    .map_err(|e| e.to_string())?
            }
        };
        return Ok(stream.into_inner());
    }

    if mode == "http" || mode == "http_connect" {
        return connect_via_http_proxy(ip, port, proxy_cfg);
    }

    if mode == "direct" {
        return TcpStream::connect(format!("{}:{}", ip, port)).map_err(|e| e.to_string());
    }

    Err(format!("Unsupported proxy type: {}", proxy_cfg.proxy_type))
}

fn collect_pentest_tool_dirs() -> Vec<PathBuf> {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut dirs: Vec<PathBuf> = vec![
        cwd.join("src-tauri")
            .join("resources")
            .join("pentest-tools"),
        cwd.join("resources").join("pentest-tools"),
        cwd.join("pentest-tools"),
    ];

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            dirs.push(exe_dir.join("resources").join("pentest-tools"));
            dirs.push(exe_dir.join("pentest-tools"));
            if let Some(parent) = exe_dir.parent() {
                dirs.push(parent.join("resources").join("pentest-tools"));
                dirs.push(parent.join("pentest-tools"));
            }
        }
    }

    if let Some(parent) = cwd.parent() {
        dirs.push(
            parent
                .join("src-tauri")
                .join("resources")
                .join("pentest-tools"),
        );
        dirs.push(parent.join("resources").join("pentest-tools"));
        dirs.push(parent.join("pentest-tools"));
    }
    let mut unique = Vec::new();
    for dir in dirs {
        if !unique.iter().any(|x: &PathBuf| x == &dir) {
            unique.push(dir);
        }
    }
    unique
}

fn get_or_create_pentest_tool_dir() -> Result<PathBuf, String> {
    let mut dirs = collect_pentest_tool_dirs();
    if let Some(existing) = dirs.iter().find(|d| d.exists()) {
        return Ok(existing.clone());
    }
    let target = dirs
        .drain(..)
        .next()
        .ok_or("无法确定工具目录".to_string())?;
    fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    Ok(target)
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum RemoteOs {
    Windows,
    Unix,
    Unknown,
}

fn detect_remote_os(session: &Session) -> RemoteOs {
    let probe = |command: &str| -> Option<String> {
        let mut channel = session.channel_session().ok()?;
        channel.exec(command).ok()?;
        let mut stdout = String::new();
        let mut stderr = String::new();
        let _ = channel.read_to_string(&mut stdout);
        let _ = channel.stderr().read_to_string(&mut stderr);
        let _ = channel.send_eof();
        let _ = channel.wait_eof();
        let _ = channel.wait_close();
        let joined = format!("{} {}", stdout, stderr).to_lowercase();
        if joined.trim().is_empty() {
            None
        } else {
            Some(joined)
        }
    };

    if let Some(result) = probe("uname -s") {
        if result.contains("linux")
            || result.contains("darwin")
            || result.contains("freebsd")
            || result.contains("unix")
        {
            return RemoteOs::Unix;
        }
        if result.contains("windows")
            || result.contains("mingw")
            || result.contains("msys")
            || result.contains("cygwin")
        {
            return RemoteOs::Windows;
        }
    }

    if let Some(result) = probe("cmd /C ver") {
        if result.contains("windows") {
            return RemoteOs::Windows;
        }
    }

    if let Some(result) = probe(r#"powershell -NoProfile -Command "$PSVersionTable.OS""#) {
        if result.contains("windows") {
            return RemoteOs::Windows;
        }
    }

    RemoteOs::Unknown
}

fn tool_candidates_by_remote_os(tool_name: &str, remote_os: RemoteOs) -> Vec<String> {
    let base = tool_name.to_string();
    let exe = format!("{}.exe", tool_name);
    if tool_name.to_lowercase().ends_with(".exe") {
        return vec![tool_name.to_string()];
    }
    match remote_os {
        RemoteOs::Windows => vec![exe, base],
        RemoteOs::Unix => vec![base, exe],
        RemoteOs::Unknown => vec![base, exe],
    }
}

fn find_pentest_tool_file(tool_name: &str, remote_os: RemoteOs) -> Option<PathBuf> {
    if tool_name.contains('/') || tool_name.contains('\\') {
        return None;
    }
    let candidates = tool_candidates_by_remote_os(tool_name, remote_os);
    for dir in collect_pentest_tool_dirs() {
        for file_name in &candidates {
            let path = dir.join(file_name);
            if path.exists() && path.is_file() {
                return Some(path);
            }
        }
    }
    None
}

fn preferred_remote_file_name(tool_name: &str, remote_os: RemoteOs) -> String {
    if tool_name.to_lowercase().ends_with(".exe") {
        return tool_name.to_string();
    }
    match remote_os {
        RemoteOs::Windows => format!("{}.exe", tool_name),
        RemoteOs::Unix => tool_name.to_string(),
        RemoteOs::Unknown => tool_name.to_string(),
    }
}

fn escape_single_quotes(input: &str) -> String {
    input.replace('\'', "'\\''")
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
    proxy: Option<ProxyConfig>,
) -> Result<String, String> {
    ensure_license_valid()?;
    let tcp = connect_tcp_stream(&ip, port, &proxy)?;
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

    // 获取当前 bash_history 的行数（用于后续只删除新增的）
    let initial_history_count = {
        let mut channel = sess.channel_session().map_err(|e| e.to_string())?;
        channel.exec("wc -l < ~/.bash_history 2>/dev/null || echo 0").map_err(|e| e.to_string())?;
        let mut count_str = String::new();
        channel.read_to_string(&mut count_str).map_err(|e| e.to_string())?;
        channel.wait_close().map_err(|e| e.to_string())?;
        count_str.trim().parse::<usize>().ok()
    };

    // Generate unique session ID
    let session_id = Uuid::new_v4().to_string();

    // 记录连接时间戳（用于后续精确清理日志）
    let connect_timestamp = chrono::Local::now().format("%b %d %H:%M").to_string();

    // Create session info
    let session_info = SessionInfo {
        session: sess,
        cwd: initial_cwd,
        ip: ip.clone(),
        port,
        user: user.clone(),
        pass: pass.clone(),
        note: String::new(),
        initial_history_count,
        connect_timestamp,
    };

    // Store session wrapped in Arc<Mutex>
    {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(session_id.clone(), Arc::new(Mutex::new(session_info)));
        state.session_order.lock().unwrap().push(session_id.clone());
    }

    *state.current_session_id.lock().unwrap() = Some(session_id.clone());

    Ok(session_id)
}

#[tauri::command]
fn get_pentest_tool_dir() -> Result<String, String> {
    let path = get_or_create_pentest_tool_dir()?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_remote_os(state: State<'_, AppState>, session_id: String) -> Result<String, String> {
    let session_arc = {
        let sessions = state.sessions.lock().unwrap();
        sessions
            .get(&session_id)
            .cloned()
            .ok_or(format!("Session {} not found", session_id))?
    };
    let session_info = session_arc.lock().unwrap();
    let os = match detect_remote_os(&session_info.session) {
        RemoteOs::Windows => "windows",
        RemoteOs::Unix => "linux",
        RemoteOs::Unknown => "unknown",
    };
    Ok(os.to_string())
}

#[tauri::command]
async fn upload_pentest_tool(
    state: State<'_, AppState>,
    session_id: String,
    tool_name: String,
    remote_dir: String,
    remote_file_name: Option<String>,
    local_path: Option<String>,
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
        let remote_os = detect_remote_os(&session_info.session);
        let local_file = if let Some(path) = local_path {
            let p = PathBuf::from(path);
            if p.exists() && p.is_file() {
                p
            } else {
                return Err(format!("本地工具路径无效: {}", p.to_string_lossy()));
            }
        } else {
            find_pentest_tool_file(&tool_name, remote_os).ok_or_else(|| {
                let dir = get_or_create_pentest_tool_dir()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|_| "pentest-tools".to_string());
                format!("未找到工具文件 {}，请将文件放入目录：{}", tool_name, dir)
            })?
        };

        let bytes = fs::read(&local_file).map_err(|e| e.to_string())?;
        let upload_name = remote_file_name
            .unwrap_or_else(|| preferred_remote_file_name(&tool_name, remote_os))
            .replace('\\', "/");
        let remote_base = if remote_dir.trim().is_empty() {
            "/tmp".to_string()
        } else {
            remote_dir.trim().trim_end_matches('/').to_string()
        };
        let remote_path = format!("{}/{}", remote_base, upload_name);

        let sftp = session_info.session.sftp().map_err(|e| e.to_string())?;
        let mut file = sftp
            .create(Path::new(&remote_path))
            .map_err(|e| e.to_string())?;
        file.write_all(&bytes).map_err(|e| e.to_string())?;

        if remote_os != RemoteOs::Windows {
            let mut channel = session_info
                .session
                .channel_session()
                .map_err(|e| e.to_string())?;
            let escaped = escape_single_quotes(&remote_path);
            channel
                .exec(&format!("chmod +x '{}'", escaped))
                .map_err(|e| e.to_string())?;
            let mut stdout = Vec::new();
            let mut stderr = Vec::new();
            let _ = channel.read_to_end(&mut stdout);
            let _ = channel.stderr().read_to_end(&mut stderr);
            let _ = channel.send_eof();
            let _ = channel.wait_eof();
            channel.wait_close().map_err(|e| e.to_string())?;
        }

        Ok(format!(
            "上传成功: {} -> {} ({} bytes)",
            local_file.to_string_lossy(),
            remote_path,
            bytes.len()
        ))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn disconnect_ssh(
    state: State<'_, AppState>,
    session_id: Option<String>,
    auto_cleanup: Option<bool>,
) -> Result<String, String> {
    let id_to_disconnect = match session_id {
        Some(id) => Some(id),
        None => state.current_session_id.lock().unwrap().clone(),
    };

    if let Some(id) = id_to_disconnect {
        // 在断开前，如果启用自动清理，先清理痕迹
        if auto_cleanup.unwrap_or(true) {
            // 尝试清理（失败不影响断开连接）
            let _ = tauri::async_runtime::block_on(async {
                // 清理本次登录后新增的 bash 历史
                let _ = cleanup_current_user_history(state.clone(), id.clone()).await;
                
                // 清理本次连接的 SSH 日志
                let _ = cleanup_ssh_log_for_user(state.clone(), id.clone()).await;
            });
        }

        let mut removed = false;
        let mut next_current: Option<String> = None;
        {
            let mut sessions = state.sessions.lock().unwrap();
            let mut order = state.session_order.lock().unwrap();

            if sessions.remove(&id).is_some() {
                removed = true;
                // Remove from order
                if let Some(pos) = order.iter().position(|x| x == &id) {
                    order.remove(pos);
                }

                if order.is_empty() {
                    next_current = None;
                } else {
                    next_current = order.first().cloned();
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
    ensure_license_valid()?;
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
        let command_id_clone = command_id.clone();

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
                            command_id: command_id_clone.clone(),
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
                    command_id: command_id_clone.clone(),
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
                command_id: command_id_clone,
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
    
    // 重新获取历史行数
    let initial_history_count = {
        let mut channel = sess.channel_session().map_err(|e| e.to_string())?;
        channel.exec("wc -l < ~/.bash_history 2>/dev/null || echo 0").map_err(|e| e.to_string())?;
        let mut count_str = String::new();
        channel.read_to_string(&mut count_str).map_err(|e| e.to_string())?;
        channel.wait_close().map_err(|e| e.to_string())?;
        count_str.trim().parse::<usize>().ok()
    };
    
    session_info.session = sess;
    session_info.cwd = "/".to_string();
    session_info.initial_history_count = initial_history_count;
    session_info.connect_timestamp = chrono::Local::now().format("%b %d %H:%M").to_string();
    
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
    ensure_license_valid()?;
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
    ensure_license_valid()?;
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
    let order = state.session_order.lock().unwrap();

    let summaries: Vec<SessionSummary> = order
        .iter()
        .filter_map(|id| {
            sessions.get(id).map(|info_arc| {
                let info = info_arc.lock().unwrap();
                SessionSummary {
                    id: id.clone(),
                    ip: info.ip.clone(),
                    port: info.port,
                    user: info.user.clone(),
                    is_current: current_id.as_ref() == Some(id),
                    note: info.note.clone(),
                }
            })
        })
        .collect();

    Ok(summaries)
}

#[tauri::command]
fn reorder_sessions(state: State<'_, AppState>, new_order: Vec<String>) -> Result<(), String> {
    let mut order = state.session_order.lock().unwrap();
    // Validate that new_order contains valid session IDs?
    // Or just trust frontend?
    // Better to ensure we don't lose sessions that might have been added concurrently (race condition),
    // but for this single-user local app, replacing is usually fine.
    // However, robust implementation:
    // 1. Ensure all IDs in new_order exist in `sessions` (optional, but good)
    // 2. Ensure all IDs in `sessions` are in `new_order` (to prevent hiding sessions)

    // Simple implementation: Just replace.
    *order = new_order;
    Ok(())
}

#[tauri::command]
fn update_session_note(
    state: State<'_, AppState>,
    session_id: String,
    note: String,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    if let Some(session_arc) = sessions.get(&session_id) {
        let mut info = session_arc.lock().unwrap();
        info.note = note;
        Ok(())
    } else {
        Err(format!("Session {} not found", session_id))
    }
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
    ensure_license_valid()?;
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

    // 自动禁用当前会话的历史记录（不影响已有的 .bash_history）
    // 使用 HISTFILE=/dev/null 将历史写入到 /dev/null，而不是删除原有文件
    let disable_history_cmd = "unset HISTFILE; export HISTSIZE=0; export HISTFILESIZE=0\n";
    channel.write_all(disable_history_cmd.as_bytes()).map_err(|e| e.to_string())?;
    channel.flush().map_err(|e| e.to_string())?;

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
    ensure_license_valid()?;
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
    db: Option<String>,
) -> Result<DbQueryResult, String> {
    let pool = {
        let dbs = state.db_connections.lock().unwrap();
        let conn = dbs.get(&id).ok_or("DB Session not found")?;
        conn.pool.clone()
    };

    tauri::async_runtime::spawn_blocking(move || {
        let mut conn = pool.get_conn().map_err(|e| e.to_string())?;

        if let Some(database) = db {
            // Check if db is different from current?
            // pool.get_conn() might return a connection with any previous state if not reset,
            // but usually we just set it to be sure.
            conn.query_drop(format!("USE `{}`", database))
                .map_err(|e| e.to_string())?;
        }

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
    ensure_license_valid()?;
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

#[tauri::command]
async fn web_search(query: String) -> Result<Vec<WebSearchItem>, String> {
    ensure_license_valid()?;
    tauri::async_runtime::spawn_blocking(move || {
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(15))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            .build()
            .map_err(|e| e.to_string())?;

        let bing_html = client
            .get("https://www.bing.com/search")
            .query(&[("q", query.as_str()), ("setlang", "zh-Hans")])
            .send()
            .and_then(|response| response.error_for_status())
            .map_err(|e| e.to_string())?
            .text()
            .map_err(|e| e.to_string())?;

        let mut items = parse_bing_results(&bing_html);

        if items.len() < 3 {
            let baidu_html = client
                .get("https://www.baidu.com/s")
                .query(&[("wd", query.as_str())])
                .send()
                .and_then(|response| response.error_for_status())
                .map_err(|e| e.to_string())?
                .text()
                .map_err(|e| e.to_string())?;
            items.extend(parse_baidu_results(&baidu_html));
            items = dedupe_search_items(items);
            items.truncate(6);
        }

        Ok(items)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn fetch_webpage(url: String) -> Result<WebPageResult, String> {
    ensure_license_valid()?;
    tauri::async_runtime::spawn_blocking(move || {
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(20))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            .build()
            .map_err(|e| e.to_string())?;

        let response = client
            .get(&url)
            .send()
            .and_then(|response| response.error_for_status())
            .map_err(|e| e.to_string())?;

        let body = response.text().map_err(|e| e.to_string())?;
        let title = extract_html_title(&body);
        let content = truncate_text(strip_html_tags(&body), 12000);

        Ok(WebPageResult {
            url,
            title,
            content,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_bing_results_uses_primary_result_anchor() {
        let html = r#"
        <li class="b_algo">
          <link rel="stylesheet" href="https://r.bing.com/rs/4c/gq/cc,nc/K4L6NoSyjvNKc9E9DD920sTC_hg.css?or=n">
          <h2>
            <a href="https://www.weather.com.cn/weather/101210101.shtml">杭州天气预报</a>
          </h2>
          <div class="b_caption">
            <p>杭州明天天气预报，包含温度、降水和风力。</p>
          </div>
        </li>
        "#;

        let items = parse_bing_results(html);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].title, "杭州天气预报");
        assert_eq!(items[0].url, "https://www.weather.com.cn/weather/101210101.shtml");
        assert!(items[0].snippet.contains("杭州明天天气预报"));
    }
}

#[tauri::command]
async fn cleanup_ssh_log_for_user(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<String, String> {
    ensure_license_valid()?;
    
    let session_arc = {
        let sessions = state.sessions.lock().unwrap();
        sessions
            .get(&session_id)
            .cloned()
            .ok_or(format!("Session {} not found", session_id))?
    };

    tauri::async_runtime::spawn_blocking(move || {
        let session_info = session_arc.lock().unwrap();
        let user = session_info.user.clone();
        let ip = session_info.ip.clone();
        let timestamp = session_info.connect_timestamp.clone();
        
        // 只清理本次连接的日志记录
        // 使用时间戳 + 用户名 + IP 进行精确匹配
        // 例如：Mar 24 10:30:15 ... sshd[12345]: Accepted password for root from 192.168.1.100
        let cleanup_cmd = format!(
            "sudo sed -i '/{}.*{}.*{}/d' /var/log/auth.log 2>/dev/null; sudo sed -i '/{}.*{}.*{}/d' /var/log/secure 2>/dev/null",
            timestamp, user, ip, timestamp, user, ip
        );
        
        drop(session_info);
        let mut session_info_mut = session_arc.lock().unwrap();
        let result = execute_single_command(&mut session_info_mut, &cleanup_cmd, 10000)?;
        
        if result.exit_code != 0 && !result.stderr.is_empty() {
            // sudo 失败可能是权限问题，尝试不用 sudo
            let cleanup_cmd_no_sudo = format!(
                "sed -i '/{}.*{}.*{}/d' /var/log/auth.log 2>/dev/null; sed -i '/{}.*{}.*{}/d' /var/log/secure 2>/dev/null",
                timestamp, user, ip, timestamp, user, ip
            );
            let result2 = execute_single_command(&mut session_info_mut, &cleanup_cmd_no_sudo, 10000)?;
            if result2.exit_code != 0 {
                return Err(format!("清理失败（需要 root 权限）: {}", result.stderr));
            }
        }
        
        Ok(format!("已清理用户 {} 从 {} 在 {} 的连接日志", user, ip, timestamp))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn cleanup_current_user_history(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<String, String> {
    ensure_license_valid()?;
    
    let session_arc = {
        let sessions = state.sessions.lock().unwrap();
        sessions
            .get(&session_id)
            .cloned()
            .ok_or(format!("Session {} not found", session_id))?
    };

    tauri::async_runtime::spawn_blocking(move || {
        let session_info = session_arc.lock().unwrap();
        let initial_count = session_info.initial_history_count;
        
        // 如果记录了初始行数，只删除新增的行
        let cleanup_cmd = if let Some(count) = initial_count {
            // 方案：使用 sed 只保留前 N 行
            format!(
                "sed -i '{},$d' ~/.bash_history 2>/dev/null; history -c; history -r",
                count + 1
            )
        } else {
            // 如果没有记录初始行数（旧会话），清空所有
            "history -c; rm -f ~/.bash_history; touch ~/.bash_history".to_string()
        };
        
        // 需要重新获取可变引用
        drop(session_info);
        let mut session_info_mut = session_arc.lock().unwrap();
        let result = execute_single_command(&mut session_info_mut, &cleanup_cmd, 10000)?;
        
        if result.exit_code != 0 && !result.stderr.is_empty() {
            return Err(format!("清理失败: {}", result.stderr));
        }
        
        Ok(format!("已清理本次登录后的 {} 条新增历史记录", 
            initial_count.map(|c| format!("约 {}", c)).unwrap_or_else(|| "所有".to_string())))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("Tauri App Starting...");
    tauri::Builder::default()
        .setup(|app| {
            app.manage(AppState {
                sessions: Mutex::new(HashMap::new()),
                session_order: Mutex::new(Vec::new()),
                pty_sessions: Mutex::new(HashMap::new()),
                current_session_id: Mutex::new(None),
                db_connections: Mutex::new(HashMap::new()),
            });
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler!(
            get_machine_code,
            activate_license,
            get_license_status,
            get_ai_benefit_config,
            check_client_update,
            perform_client_update,
            cancel_client_update,
            connect_ssh,
            get_pentest_tool_dir,
            get_remote_os,
            upload_pentest_tool,
            disconnect_ssh,
            exec_command,
            batch_exec_command,
            exec_command_stream,
            exec_local_command,
            web_search,
            fetch_webpage,
            list_sessions,
            update_session_note,
            reorder_sessions,
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
            sftp_delete,
            cleanup_ssh_log_for_user,
            cleanup_current_user_history
        ))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
