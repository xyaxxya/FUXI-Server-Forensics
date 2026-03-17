use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine as _;
use chrono::Utc;
use rsa::pkcs1v15::{Signature, VerifyingKey};
use rsa::pkcs8::DecodePublicKey;
use rsa::sha2::Sha256;
use rsa::signature::Verifier;
use rsa::RsaPublicKey;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const EMBEDDED_PUBLIC_KEY: &str = "-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAso+RQRmB4pXFPekhegex
t0h3s6+TYwTqd4LXO+i7xVZgRUtCF7V5IxfCwKOXvxbxLMZsnktNOl+lxfAuF38H
ZFlBhHIL+IyE2EvM71BF8cwQRDlA/XEyZyXvE7j3cauF4lwekA1DvPLcbZ5wzE/K
XNi/RPr4NrpJxjEnBZd1eW/8H0QOfqrL7nO/neyaXh4uq9NLxUZOmizGRJ8dgsbP
b7ZIUXpK6zW0YrJRoGZ5tGKBUBPPpzxN7BtoWCIUuwSaQBj4kNoGxXz8dkqQb3D7
XwfktfRfgZ3RyYV8Y4PjzTS+PV4pTKW8e54LVbOZQ8uwLHUNOzvG+Cv+YEZVGoow
3wIDAQAB
-----END PUBLIC KEY-----";
const LICENSE_ONLINE_CHECK_URL: &str = "http://47.99.54.48:8787/license/online-check";
const ONLINE_CHECK_INTERVAL_SECS: u64 = 300;

static ONLINE_CHECK_CACHE: OnceLock<Mutex<Option<Instant>>> = OnceLock::new();

#[derive(Serialize, Deserialize, Clone)]
pub struct LicenseInfo {
    pub qq: String,
    pub nickname: String,
    pub machine_code: String,
    pub issued_at: i64,
    pub expires_at: i64,
    #[serde(default)]
    pub license_plan: String,
    #[serde(default)]
    pub license_label: String,
    pub features: Vec<String>,
    pub avatar: String,
}

#[derive(Serialize)]
pub struct LicenseStatus {
    pub valid: bool,
    pub message: String,
    pub machine_code: String,
    pub expires_at: Option<i64>,
    pub nickname: Option<String>,
    pub qq: Option<String>,
    pub avatar: Option<String>,
    pub license_plan: Option<String>,
    pub license_label: Option<String>,
}

#[derive(Deserialize)]
struct LicenseWrapper {
    license: String,
    signature: String,
}

#[derive(Serialize)]
struct OnlineCheckRequest {
    license_content: String,
    machine_code: String,
}

#[derive(Deserialize)]
struct OnlineCheckResponse {
    valid: bool,
    reason: String,
}

#[cfg(windows)]
pub fn get_machine_code() -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    let output = std::process::Command::new("powershell")
        .args([
            "-Command",
            "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID",
        ])
        .creation_flags(0x08000000)
        .output()
        .map_err(|e| e.to_string())?;
    let uuid = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if uuid.is_empty() {
        return Err("无法获取机器码".to_string());
    }
    Ok(uuid)
}

#[cfg(target_os = "linux")]
pub fn get_machine_code() -> Result<String, String> {
    let machine_id = fs::read_to_string("/etc/machine-id")
        .or_else(|_| fs::read_to_string("/var/lib/dbus/machine-id"))
        .map_err(|e| e.to_string())?;
    let v = machine_id.trim().to_string();
    if v.is_empty() {
        return Err("无法获取机器码".to_string());
    }
    Ok(v)
}

#[cfg(target_os = "macos")]
pub fn get_machine_code() -> Result<String, String> {
    let output = std::process::Command::new("ioreg")
        .args(["-d2", "-c", "IOPlatformExpertDevice"])
        .output()
        .map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&output.stdout);
    for line in text.lines() {
        if line.contains("IOPlatformUUID") {
            let parts: Vec<&str> = line.split('"').collect();
            if parts.len() >= 4 {
                return Ok(parts[3].to_string());
            }
        }
    }
    Err("无法获取机器码".to_string())
}

fn license_path() -> Result<PathBuf, String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let base = exe_path
        .parent()
        .ok_or("无法获取应用目录".to_string())?
        .to_path_buf();
    Ok(base.join("license.json"))
}

fn load_public_key() -> Result<RsaPublicKey, String> {
    RsaPublicKey::from_public_key_pem(EMBEDDED_PUBLIC_KEY).map_err(|e| e.to_string())
}

fn should_skip_online_check() -> bool {
    let cache = ONLINE_CHECK_CACHE.get_or_init(|| Mutex::new(None));
    if let Ok(mut guard) = cache.lock() {
        if let Some(last) = *guard {
            if last.elapsed() < Duration::from_secs(ONLINE_CHECK_INTERVAL_SECS) {
                return true;
            }
        }
        *guard = Some(Instant::now());
    }
    false
}

fn parse_and_verify(
    license_content: &str,
    expected_machine_code: &str,
) -> Result<LicenseInfo, String> {
    let wrapper: LicenseWrapper =
        serde_json::from_str(license_content).map_err(|e| e.to_string())?;
    let payload_raw = BASE64_STANDARD
        .decode(wrapper.license.as_bytes())
        .map_err(|e| e.to_string())?;
    let signature_raw = BASE64_STANDARD
        .decode(wrapper.signature.as_bytes())
        .map_err(|e| e.to_string())?;

    let public_key = load_public_key()?;
    let verifying_key = VerifyingKey::<Sha256>::new(public_key);
    let signature = Signature::try_from(signature_raw.as_slice()).map_err(|e| e.to_string())?;
    verifying_key
        .verify(&payload_raw, &signature)
        .map_err(|_| "许可证签名校验失败".to_string())?;

    let info: LicenseInfo = serde_json::from_slice(&payload_raw).map_err(|e| e.to_string())?;
    if info.machine_code != expected_machine_code {
        return Err("机器码不匹配".to_string());
    }
    let plan = info.license_plan.trim().to_lowercase();
    let is_permanent = plan == "permanent";
    if !is_permanent && Utc::now().timestamp() > info.expires_at {
        return Err("许可证已过期".to_string());
    }
    Ok(info)
}

fn label_by_plan(plan: &str) -> String {
    match plan {
        "permanent" => "永曜尊享".to_string(),
        "one_year" => "一年套餐".to_string(),
        "half_year" => "半年套餐".to_string(),
        _ => "星火30天".to_string(),
    }
}

pub fn activate_license(license_content: &str) -> Result<LicenseInfo, String> {
    let machine_code = get_machine_code()?;
    let info = parse_and_verify(license_content, &machine_code)?;
    let path = license_path()?;
    fs::write(path, license_content).map_err(|e| e.to_string())?;
    Ok(info)
}

fn online_validate_license(license_content: &str, machine_code: &str) -> Result<(), String> {
    if should_skip_online_check() {
        return Ok(());
    }
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .post(LICENSE_ONLINE_CHECK_URL)
        .json(&OnlineCheckRequest {
            license_content: license_content.to_string(),
            machine_code: machine_code.to_string(),
        })
        .send();
    let Ok(resp) = resp else {
        return Ok(());
    };
    let payload = resp.json::<OnlineCheckResponse>();
    let Ok(payload) = payload else {
        return Ok(());
    };
    if payload.valid {
        return Ok(());
    }
    Err(payload.reason)
}

pub fn verify_local_license() -> Result<LicenseInfo, String> {
    let path = license_path()?;
    let content = fs::read_to_string(&path).map_err(|_| "未找到许可证文件".to_string())?;
    let machine_code = get_machine_code()?;
    let info = parse_and_verify(&content, &machine_code)?;
    match online_validate_license(&content, &machine_code) {
        Ok(_) => Ok(info),
        Err(reason) => {
            if reason.contains("revoked") || reason.contains("吊销") {
                let _ = fs::remove_file(&path);
                return Err("许可证已被吊销，已自动移除本地授权文件".to_string());
            }
            Err(format!("在线校验失败: {}", reason))
        }
    }
}

pub fn get_license_status() -> Result<LicenseStatus, String> {
    let machine_code = get_machine_code()?;
    match verify_local_license() {
        Ok(info) => {
            let normalized_plan = if info.license_plan.trim().is_empty() {
                "thirty_days".to_string()
            } else {
                info.license_plan.clone()
            };
            let normalized_label = if info.license_label.trim().is_empty() {
                label_by_plan(&normalized_plan)
            } else {
                info.license_label.clone()
            };
            Ok(LicenseStatus {
            valid: true,
            message: "许可证有效".to_string(),
            machine_code,
            expires_at: Some(info.expires_at),
            nickname: Some(info.nickname),
            qq: Some(info.qq),
            avatar: Some(info.avatar),
                license_plan: Some(normalized_plan),
                license_label: Some(normalized_label),
            })
        }
        Err(err) => Ok(LicenseStatus {
            valid: false,
            message: err,
            machine_code,
            expires_at: None,
            nickname: None,
            qq: None,
            avatar: None,
            license_plan: None,
            license_label: None,
        }),
    }
}
