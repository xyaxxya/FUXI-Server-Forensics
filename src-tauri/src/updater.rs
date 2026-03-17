use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine as _;
use rsa::pkcs1v15::{Signature, VerifyingKey};
use rsa::pkcs8::DecodePublicKey;
use rsa::sha2::{Digest, Sha256};
use rsa::signature::Verifier;
use rsa::RsaPublicKey;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::thread;
use std::time::Duration;

const DEFAULT_CLIENT_UPDATE_META_URL: &str = "https://47.99.54.48:8787/client-update/latest";
const EMBEDDED_PUBLIC_KEY: &str = "-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAso+RQRmB4pXFPekhegex
t0h3s6+TYwTqd4LXO+i7xVZgRUtCF7V5IxfCwKOXvxbxLMZsnktNOl+lxfAuF38H
ZFlBhHIL+IyE2EvM71BF8cwQRDlA/XEyZyXvE7j3cauF4lwekA1DvPLcbZ5wzE/K
XNi/RPr4NrpJxjEnBZd1eW/8H0QOfqrL7nO/neyaXh4uq9NLxUZOmizGRJ8dgsbP
b7ZIUXpK6zW0YrJRoGZ5tGKBUBPPpzxN7BtoWCIUuwSaQBj4kNoGxXz8dkqQb3D7
XwfktfRfgZ3RyYV8Y4PjzTS+PV4pTKW8e54LVbOZQ8uwLHUNOzvG+Cv+YEZVGoow
3wIDAQAB
-----END PUBLIC KEY-----";
const MAX_DOWNLOAD_RETRIES: usize = 3;
static UPDATE_CANCELLED: OnceLock<AtomicBool> = OnceLock::new();

fn cancel_flag() -> &'static AtomicBool {
    UPDATE_CANCELLED.get_or_init(|| AtomicBool::new(false))
}

pub fn cancel_client_update() {
    cancel_flag().store(true, Ordering::Relaxed);
}

fn reset_cancel_state() {
    cancel_flag().store(false, Ordering::Relaxed);
}

#[derive(Serialize)]
pub struct ClientUpdateCheckResult {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub download_url: String,
    pub package_sha256: String,
    pub manifest_signature: String,
    pub notes: String,
    pub min_supported_version: String,
    pub force_update: bool,
    pub channel: String,
    pub message: String,
}

#[derive(Serialize, Clone)]
pub struct ClientUpdateProgress {
    pub stage: String,
    pub percentage: f64,
    pub downloaded: u64,
    pub total: u64,
    pub message: String,
}

#[derive(Deserialize, Clone)]
struct ClientUpdateMeta {
    #[serde(default)]
    latest_version: String,
    #[serde(default)]
    download_url: String,
    #[serde(default)]
    package_sha256: String,
    #[serde(default)]
    manifest_signature: String,
    #[serde(default)]
    notes: String,
    #[serde(default)]
    min_supported_version: String,
    #[serde(default)]
    force_update: bool,
    #[serde(default = "default_channel")]
    channel: String,
    #[serde(default)]
    updated_at: i64,
}

#[derive(Serialize)]
struct ClientUpdateMetaSigningPayload {
    latest_version: String,
    download_url: String,
    package_sha256: String,
    notes: String,
    min_supported_version: String,
    force_update: bool,
    channel: String,
    updated_at: i64,
}

fn default_channel() -> String {
    "stable".to_string()
}

fn client_update_meta_url() -> String {
    let from_env = std::env::var("FUXI_UPDATE_META_URL")
        .ok()
        .unwrap_or_default()
        .trim()
        .to_string();
    if from_env.is_empty() {
        DEFAULT_CLIENT_UPDATE_META_URL.to_string()
    } else {
        from_env
    }
}

fn http_fallback_meta_url() -> String {
    if let Some(rest) = DEFAULT_CLIENT_UPDATE_META_URL.strip_prefix("https://") {
        format!("http://{}", rest)
    } else {
        DEFAULT_CLIENT_UPDATE_META_URL.to_string()
    }
}

fn client_update_meta_candidates() -> Vec<String> {
    let from_env = std::env::var("FUXI_UPDATE_META_URL")
        .ok()
        .unwrap_or_default()
        .trim()
        .to_string();
    let mut urls = Vec::new();
    if from_env.is_empty() {
        urls.push(client_update_meta_url());
        let fallback = http_fallback_meta_url();
        if !fallback.eq_ignore_ascii_case(&urls[0]) {
            urls.push(fallback);
        }
        return urls;
    }
    for item in from_env.split(',') {
        let value = item.trim();
        if value.is_empty() {
            continue;
        }
        if !urls.iter().any(|u| u.eq_ignore_ascii_case(value)) {
            urls.push(value.to_string());
        }
    }
    if urls.is_empty() {
        urls.push(client_update_meta_url());
    }
    urls
}

fn is_allowed_update_url(url: &str) -> bool {
    let Ok(parsed) = reqwest::Url::parse(url) else {
        return false;
    };
    let scheme = parsed.scheme().to_ascii_lowercase();
    if scheme == "https" {
        return true;
    }
    if scheme != "http" {
        return false;
    }
    let host = parsed.host_str().unwrap_or("").to_ascii_lowercase();
    if host == "127.0.0.1" || host == "localhost" || host == "::1" {
        return true;
    }
    if let Ok(default_url) = reqwest::Url::parse(DEFAULT_CLIENT_UPDATE_META_URL) {
        if let Some(default_host) = default_url.host_str() {
            if host == default_host.to_ascii_lowercase() {
                return true;
            }
        }
    }
    false
}

fn resolve_download_url(download_url: &str, meta_url: &str) -> String {
    let raw = download_url.trim();
    if raw.is_empty() {
        return "".to_string();
    }
    if reqwest::Url::parse(raw).is_ok() {
        return raw.to_string();
    }
    if let Ok(base) = reqwest::Url::parse(meta_url) {
        if let Ok(joined) = base.join(raw) {
            return joined.to_string();
        }
    }
    raw.to_string()
}

fn normalize_sha256_hex(input: &str) -> String {
    input
        .trim()
        .to_ascii_lowercase()
        .chars()
        .filter(|c| c.is_ascii_hexdigit())
        .take(64)
        .collect::<String>()
}

fn update_manifest_payload(meta: &ClientUpdateMeta) -> Result<Vec<u8>, String> {
    let payload = ClientUpdateMetaSigningPayload {
        latest_version: meta.latest_version.trim().to_string(),
        download_url: meta.download_url.trim().to_string(),
        package_sha256: normalize_sha256_hex(&meta.package_sha256),
        notes: meta.notes.clone(),
        min_supported_version: meta.min_supported_version.trim().to_string(),
        force_update: meta.force_update,
        channel: {
            let c = meta.channel.trim().to_ascii_lowercase();
            if c.is_empty() {
                "stable".to_string()
            } else {
                c
            }
        },
        updated_at: meta.updated_at,
    };
    serde_json::to_vec(&payload).map_err(|e| e.to_string())
}

fn verify_update_manifest_signature(meta: &ClientUpdateMeta) -> Result<(), String> {
    let sig_raw = BASE64_STANDARD
        .decode(meta.manifest_signature.trim().as_bytes())
        .map_err(|e| format!("manifest 签名格式错误: {}", e))?;
    let signature = Signature::try_from(sig_raw.as_slice())
        .map_err(|e| format!("manifest 签名格式错误: {}", e))?;
    let public_key =
        RsaPublicKey::from_public_key_pem(EMBEDDED_PUBLIC_KEY).map_err(|e| e.to_string())?;
    let verifier = VerifyingKey::<Sha256>::new(public_key);
    let payload_raw = update_manifest_payload(meta)?;
    verifier
        .verify(&payload_raw, &signature)
        .map_err(|_| "manifest 签名校验失败".to_string())
}

fn parse_content_range_total(content_range: &str) -> Option<u64> {
    let (_, total_part) = content_range.split_once('/')?;
    if total_part.trim() == "*" {
        return None;
    }
    total_part.trim().parse::<u64>().ok()
}

fn compute_file_sha256(file_path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(file_path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read_len = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if read_len == 0 {
            break;
        }
        hasher.update(&buffer[..read_len]);
    }
    let digest = hasher.finalize();
    Ok(digest
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>())
}

fn same_root_ci(path: &Path, root: &Path) -> bool {
    let a = path.to_string_lossy().to_ascii_lowercase();
    let b = root.to_string_lossy().to_ascii_lowercase();
    a.starts_with(&b)
}

fn ensure_update_directory_writable(exe_path: &Path) -> Result<(), String> {
    let exe_dir = exe_path.parent().ok_or("无法获取程序目录".to_string())?;
    let mut in_program_files = false;
    if let Ok(pf) = std::env::var("ProgramFiles") {
        if !pf.trim().is_empty() && same_root_ci(exe_dir, Path::new(&pf)) {
            in_program_files = true;
        }
    }
    if let Ok(pfx86) = std::env::var("ProgramFiles(x86)") {
        if !pfx86.trim().is_empty() && same_root_ci(exe_dir, Path::new(&pfx86)) {
            in_program_files = true;
        }
    }
    let probe_name = format!(
        "fuxi_update_write_test_{}.tmp",
        chrono::Utc::now().timestamp_millis()
    );
    let probe_path = exe_dir.join(probe_name);
    let write_result = fs::File::create(&probe_path);
    if let Err(e) = write_result {
        if in_program_files {
            return Err(format!(
                "当前安装目录位于受保护路径，缺少写权限: {}。请使用管理员权限运行或将程序安装到可写目录。",
                e
            ));
        }
        return Err(format!("更新前写权限检测失败: {}", e));
    }
    let _ = fs::remove_file(probe_path);
    Ok(())
}

fn download_with_resume<F>(
    client: &reqwest::blocking::Client,
    download_url: &str,
    target_part: &Path,
    mut on_progress: F,
) -> Result<(u64, u64), String>
where
    F: FnMut(ClientUpdateProgress),
{
    let mut last_error = String::new();
    for attempt in 0..MAX_DOWNLOAD_RETRIES {
        if cancel_flag().load(Ordering::Relaxed) {
            return Err("已取消更新下载".to_string());
        }
        let mut downloaded = fs::metadata(target_part).map(|m| m.len()).unwrap_or(0);
        if attempt > 0 {
            on_progress(ClientUpdateProgress {
                stage: "retry".to_string(),
                percentage: 0.0,
                downloaded,
                total: 0,
                message: format!("下载中断，正在第 {} 次重试", attempt + 1),
            });
        }

        let mut request = client.get(download_url);
        if downloaded > 0 {
            request = request.header(reqwest::header::RANGE, format!("bytes={}-", downloaded));
        }
        let response = request.send();
        let mut resp = match response {
            Ok(v) => v,
            Err(e) => {
                last_error = format!("下载失败: {}", e);
                thread::sleep(Duration::from_millis(800));
                continue;
            }
        };
        if downloaded > 0 && resp.status() == reqwest::StatusCode::OK {
            let _ = fs::remove_file(target_part);
            downloaded = 0;
        } else if !(resp.status().is_success()
            || resp.status() == reqwest::StatusCode::PARTIAL_CONTENT)
        {
            last_error = format!("下载失败: HTTP {}", resp.status());
            thread::sleep(Duration::from_millis(800));
            continue;
        }

        let total = if resp.status() == reqwest::StatusCode::PARTIAL_CONTENT {
            resp.headers()
                .get(reqwest::header::CONTENT_RANGE)
                .and_then(|v| v.to_str().ok())
                .and_then(parse_content_range_total)
                .unwrap_or(0)
        } else {
            resp.content_length().unwrap_or(0)
        };

        let mut file = if downloaded > 0 {
            fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(target_part)
                .map_err(|e| e.to_string())?
        } else {
            fs::File::create(target_part).map_err(|e| e.to_string())?
        };

        on_progress(ClientUpdateProgress {
            stage: "download".to_string(),
            percentage: if total > 0 {
                (downloaded as f64 / total as f64 * 100.0).min(100.0)
            } else {
                0.0
            },
            downloaded,
            total,
            message: if downloaded > 0 {
                "检测到断点，继续下载更新包".to_string()
            } else {
                "开始下载更新包".to_string()
            },
        });

        let mut buffer = [0u8; 64 * 1024];
        loop {
            if cancel_flag().load(Ordering::Relaxed) {
                return Err("已取消更新下载".to_string());
            }
            let read_len = match resp.read(&mut buffer) {
                Ok(v) => v,
                Err(e) => {
                    last_error = format!("下载中断: {}", e);
                    break;
                }
            };
            if read_len == 0 {
                if downloaded > 0 {
                    return Ok((downloaded, total));
                }
                break;
            }
            if let Err(e) = file.write_all(&buffer[..read_len]) {
                last_error = format!("写入更新包失败: {}", e);
                break;
            }
            downloaded += read_len as u64;
            let percentage = if total > 0 {
                (downloaded as f64 / total as f64 * 100.0).min(100.0)
            } else {
                0.0
            };
            on_progress(ClientUpdateProgress {
                stage: "download".to_string(),
                percentage,
                downloaded,
                total,
                message: format!("下载中 {:.1}%", percentage),
            });
        }
        thread::sleep(Duration::from_millis(800));
    }
    Err(if last_error.is_empty() {
        "下载更新包失败".to_string()
    } else {
        last_error
    })
}

fn compare_version(a: &str, b: &str) -> i32 {
    let pa = a
        .split('.')
        .map(|x| x.parse::<i32>().unwrap_or(0))
        .collect::<Vec<_>>();
    let pb = b
        .split('.')
        .map(|x| x.parse::<i32>().unwrap_or(0))
        .collect::<Vec<_>>();
    let len = pa.len().max(pb.len());
    for i in 0..len {
        let va = *pa.get(i).unwrap_or(&0);
        let vb = *pb.get(i).unwrap_or(&0);
        if va > vb {
            return 1;
        }
        if va < vb {
            return -1;
        }
    }
    0
}

pub fn check_client_update(current_version: &str) -> Result<ClientUpdateCheckResult, String> {
    let meta_urls = client_update_meta_candidates();
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;
    let mut errors: Vec<String> = Vec::new();
    for meta_url in meta_urls {
        if !is_allowed_update_url(&meta_url) {
            errors.push(format!("更新元数据地址不受信任: {}", meta_url));
            continue;
        }
        let resp = match client.get(&meta_url).send() {
            Ok(v) => v,
            Err(e) => {
                errors.push(format!("{} -> {}", meta_url, e));
                continue;
            }
        };
        if !resp.status().is_success() {
            errors.push(format!("{} -> HTTP {}", meta_url, resp.status()));
            continue;
        }
        let mut data = match resp.json::<ClientUpdateMeta>() {
            Ok(v) => v,
            Err(e) => {
                errors.push(format!("{} -> 解析失败: {}", meta_url, e));
                continue;
            }
        };
        data.download_url = resolve_download_url(&data.download_url, &meta_url);

        let latest = data.latest_version.trim().to_string();
        let url = data.download_url.trim().to_string();
        let package_sha256 = normalize_sha256_hex(&data.package_sha256);
        let min_supported_version = data.min_supported_version.trim().to_string();
        let channel = {
            let c = data.channel.trim().to_ascii_lowercase();
            if c.is_empty() {
                "stable".to_string()
            } else {
                c
            }
        };
        if latest.is_empty() || url.is_empty() {
            return Ok(ClientUpdateCheckResult {
                has_update: false,
                current_version: current_version.to_string(),
                latest_version: latest,
                download_url: url,
                package_sha256: "".to_string(),
                manifest_signature: "".to_string(),
                notes: data.notes,
                min_supported_version,
                force_update: data.force_update,
                channel,
                message: "当前没有可用更新配置".to_string(),
            });
        }
        if !is_allowed_update_url(&url) {
            errors.push(format!("更新下载地址不受信任: {}", url));
            continue;
        }
        let has_sha256 = package_sha256.len() == 64;
        let has_manifest_signature = !data.manifest_signature.trim().is_empty();
        if has_manifest_signature && !has_sha256 {
            errors.push("更新配置中的 package_sha256 不合法".to_string());
            continue;
        }
        if has_manifest_signature {
            verify_update_manifest_signature(&data)?;
        }
        let has_update = compare_version(&latest, current_version) > 0;
        let use_legacy_mode = !has_sha256 || !has_manifest_signature;
        return Ok(ClientUpdateCheckResult {
            has_update,
            current_version: current_version.to_string(),
            latest_version: latest.clone(),
            download_url: url,
            package_sha256,
            manifest_signature: data.manifest_signature.trim().to_string(),
            notes: data.notes,
            min_supported_version,
            force_update: data.force_update,
            channel,
            message: if has_update {
                if use_legacy_mode {
                    format!("发现新版本 {}（兼容模式）", latest)
                } else {
                    format!("发现新版本 {}", latest)
                }
            } else {
                format!("当前已是最新版本 ({})", current_version)
            },
        });
    }
    if errors.is_empty() {
        Err("更新服务不可用".to_string())
    } else {
        Err(format!("更新服务不可用: {}", errors.join(" | ")))
    }
}

#[cfg(target_os = "windows")]
fn escape_for_bat(path: &str) -> String {
    path.replace("^", "^^").replace("&", "^&")
}

#[cfg(target_os = "windows")]
pub fn perform_client_update<F>(
    download_url: &str,
    version: &str,
    package_sha256: &str,
    mut on_progress: F,
) -> Result<(), String>
where
    F: FnMut(ClientUpdateProgress),
{
    reset_cancel_state();
    if !is_allowed_update_url(download_url) {
        return Err("更新下载地址不受信任".to_string());
    }
    let expected_sha256 = normalize_sha256_hex(package_sha256);
    let verify_sha256 = !expected_sha256.is_empty();
    if verify_sha256 && expected_sha256.len() != 64 {
        return Err("更新包 SHA256 不合法".to_string());
    }
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    ensure_update_directory_writable(&exe_path)?;
    let exe_dir = exe_path
        .parent()
        .ok_or("无法获取程序目录".to_string())?
        .to_path_buf();

    let safe_version = version
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '.' || *c == '_' || *c == '-')
        .collect::<String>();
    let safe_version = if safe_version.is_empty() {
        "latest".to_string()
    } else {
        safe_version
    };

    let target_new_exe = exe_dir.join(format!("fuxi_update_{}.new.exe", safe_version));
    let target_part = exe_dir.join(format!("fuxi_update_{}.part", safe_version));
    let target_bak = exe_dir.join(format!(
        "{}.bak",
        exe_path
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("fuxi-server-forensics.exe")
    ));
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;
    let (downloaded, total) = match download_with_resume(&client, download_url, &target_part, |p| {
        on_progress(p);
    }) {
        Ok(v) => v,
        Err(e) => {
            if e.contains("已取消更新下载") {
                let _ = fs::remove_file(&target_part);
                on_progress(ClientUpdateProgress {
                    stage: "cancelled".to_string(),
                    percentage: 0.0,
                    downloaded: fs::metadata(&target_part).map(|m| m.len()).unwrap_or(0),
                    total: 0,
                    message: "已取消更新下载".to_string(),
                });
            }
            return Err(e);
        }
    };
    if downloaded == 0 {
        return Err("下载的更新包为空".to_string());
    }

    if verify_sha256 {
        on_progress(ClientUpdateProgress {
            stage: "verify".to_string(),
            percentage: 100.0,
            downloaded,
            total,
            message: "下载完成，正在校验完整性".to_string(),
        });
        let actual_sha256 = compute_file_sha256(&target_part)?;
        if actual_sha256 != expected_sha256 {
            let _ = fs::remove_file(&target_part);
            return Err("更新包校验失败：SHA256 不匹配，已中止更新".to_string());
        }
    } else {
        on_progress(ClientUpdateProgress {
            stage: "verify".to_string(),
            percentage: 100.0,
            downloaded,
            total,
            message: "下载完成，未提供 SHA256，按兼容模式继续更新".to_string(),
        });
    }
    let _ = fs::remove_file(&target_new_exe);
    fs::rename(&target_part, &target_new_exe).map_err(|e| e.to_string())?;

    on_progress(ClientUpdateProgress {
        stage: "replace".to_string(),
        percentage: 100.0,
        downloaded,
        total,
        message: "下载完成，正在替换程序".to_string(),
    });

    let updater_script = std::env::temp_dir().join(format!(
        "fuxi_update_{}.bat",
        chrono::Utc::now().timestamp_millis()
    ));
    let exe_path_s = escape_for_bat(&exe_path.to_string_lossy());
    let new_exe_s = escape_for_bat(&target_new_exe.to_string_lossy());
    let bak_exe_s = escape_for_bat(&target_bak.to_string_lossy());
    let script_s = escape_for_bat(&updater_script.to_string_lossy());
    let exe_name_s = escape_for_bat(
        &exe_path
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("fuxi-server-forensics.exe"),
    );

    let mut script = String::new();
    script.push_str("@echo off\r\n");
    script.push_str("setlocal\r\n");
    script.push_str("for /L %%i in (1,1,30) do (\r\n");
    script.push_str(&format!(
        "  copy /Y \"{}\" \"{}\" >nul 2>nul\r\n",
        exe_path_s, bak_exe_s
    ));
    script.push_str(&format!(
        "  copy /Y \"{}\" \"{}\" >nul 2>nul\r\n",
        new_exe_s, exe_path_s
    ));
    script.push_str("  if %errorlevel%==0 goto copied\r\n");
    script.push_str("  timeout /t 1 /nobreak >nul\r\n");
    script.push_str(")\r\n");
    script.push_str("goto rollback\r\n");
    script.push_str(":copied\r\n");
    script.push_str(&format!("start \"\" \"{}\"\r\n", exe_path_s));
    script.push_str("if not %errorlevel%==0 goto rollback\r\n");
    script.push_str("timeout /t 8 /nobreak >nul\r\n");
    script.push_str(&format!(
        "tasklist /FI \"IMAGENAME eq {}\" | find /I \"{}\" >nul\r\n",
        exe_name_s, exe_name_s
    ));
    script.push_str("if not %errorlevel%==0 goto rollback\r\n");
    script.push_str("goto cleanup\r\n");
    script.push_str(":rollback\r\n");
    script.push_str(&format!(
        "copy /Y \"{}\" \"{}\" >nul 2>nul\r\n",
        bak_exe_s, exe_path_s
    ));
    script.push_str(&format!("start \"\" \"{}\"\r\n", exe_path_s));
    script.push_str(":cleanup\r\n");
    script.push_str(&format!("del /F /Q \"{}\" >nul 2>nul\r\n", new_exe_s));
    script.push_str(&format!("del /F /Q \"{}\" >nul 2>nul\r\n", script_s));

    {
        let mut f = fs::File::create(&updater_script).map_err(|e| e.to_string())?;
        f.write_all(script.as_bytes()).map_err(|e| e.to_string())?;
    }

    Command::new("cmd")
        .args(["/C", "start", "", "/MIN", &updater_script.to_string_lossy()])
        .spawn()
        .map_err(|e| e.to_string())?;

    thread::sleep(Duration::from_millis(400));
    on_progress(ClientUpdateProgress {
        stage: "restart".to_string(),
        percentage: 100.0,
        downloaded,
        total,
        message: "更新程序已启动，即将重启".to_string(),
    });
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn perform_client_update<F>(
    _download_url: &str,
    _version: &str,
    _package_sha256: &str,
    _on_progress: F,
) -> Result<(), String>
where
    F: FnMut(ClientUpdateProgress),
{
    Err("当前平台暂不支持自动更新".to_string())
}
