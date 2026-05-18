use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine as _;
use regex::Regex;
use reqwest::blocking::Client;
use reqwest::header::LOCATION;
use rustls::pki_types::ServerName;
use rustls::{ClientConfig, ClientConnection, RootCertStore, StreamOwned};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};
use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::net::{IpAddr, TcpStream, ToSocketAddrs};
use std::sync::Arc;
use std::time::Duration;
use url::Url;
use webpki_roots::TLS_SERVER_ROOTS;
use x509_parser::extensions::GeneralName;
use x509_parser::prelude::{FromDer, X509Certificate};

use super::{ensure_license_valid_async, extract_html_title, strip_html_tags, truncate_text};

const MAX_REDIRECTS: usize = 5;
const DEFAULT_HOME_BODY_LIMIT: usize = 256 * 1024;
const DEFAULT_SMALL_BODY_LIMIT: usize = 64 * 1024;
const DEFAULT_ICON_BODY_LIMIT: usize = 1024 * 1024;
const DEFAULT_HOME_TIMEOUT_MS: u64 = 12_000;
const DEFAULT_PROBE_TIMEOUT_MS: u64 = 5_000;

const COMMON_ADMIN_PATHS: &[&str] = &[
    "/admin",
    "/admin/",
    "/admin/index",
    "/admin/index.php",
    "/admin/index.html",
    "/admin/login",
    "/admin/login/",
    "/admin/login.php",
    "/admin/login.html",
    "/admin.php",
    "/admin.html",
    "/admin-api",
    "/admin-api/",
    "/api/admin",
    "/api/admin/",
    "/administrator",
    "/administrator/",
    "/auth/login",
    "/backend",
    "/backend/",
    "/backend/login",
    "/cms",
    "/cms/",
    "/console",
    "/console/",
    "/console/login",
    "/control",
    "/dashboard",
    "/dashboard/login",
    "/home/login",
    "/index/login",
    "/login.html",
    "/login.php",
    "/manage",
    "/manage/",
    "/manage/login",
    "/manager",
    "/manager/html",
    "/merchant",
    "/merchant/login",
    "/agent",
    "/agent/login",
    "/panel",
    "/panel/login",
    "/phpmyadmin",
    "/pma",
    "/signin",
    "/login",
    "/system",
    "/system/login",
    "/user/login",
    "/users/login",
    "/wp-admin/",
    "/wp-login.php",
];

const ADMIN_KEYWORDS: &[&str] = &[
    "admin",
    "login",
    "signin",
    "auth",
    "back",
    "backend",
    "console",
    "manage",
    "panel",
    "portal",
    "dashboard",
    "member",
    "user",
    "control",
    "system",
    "manager",
    "phpmyadmin",
    "wp-admin",
    "wp-login",
];

const CMS_KEYWORDS: &[&str] = &[
    "wordpress",
    "drupal",
    "joomla",
    "thinkphp",
    "laravel",
    "discuz",
    "phpcms",
    "dedecms",
    "ecshop",
    "typecho",
    "empirecms",
];

const CONTENT_KEYWORDS: &[&str] = &["blog", "news", "article", "media", "magazine", "press"];
const ECOMMERCE_KEYWORDS: &[&str] = &[
    "shop", "cart", "order", "checkout", "payment", "product", "store",
];
const PORTAL_KEYWORDS: &[&str] = &[
    "portal",
    "dashboard",
    "console",
    "center",
    "platform",
    "gateway",
];
const API_KEYWORDS: &[&str] = &["api", "swagger", "openapi", "json", "graphql", "rest"];

const DNS_RECORD_TYPES: &[&str] = &["A", "AAAA", "CNAME", "NS", "MX", "TXT", "CAA"];

const JS_FETCH_LIMIT: usize = 6;
const JS_BODY_LIMIT: usize = 128 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReconRdapRecord {
    pub lookup_url: String,
    pub handle: Option<String>,
    pub name: Option<String>,
    pub registrar: Option<String>,
    pub organization: Option<String>,
    pub country: Option<String>,
    pub start_address: Option<String>,
    pub end_address: Option<String>,
    pub nameservers: Vec<String>,
    pub created: Option<String>,
    pub updated: Option<String>,
    pub expires: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WebReconDnsRecord {
    pub record_type: String,
    pub name: String,
    pub value: String,
    pub ttl: Option<u32>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WebReconSecurityHeader {
    pub name: String,
    pub value: Option<String>,
    pub present: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReconFormFinding {
    pub action: String,
    pub method: String,
    pub fields: Vec<String>,
    pub has_password: bool,
    pub login_likely: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReconPathFinding {
    pub path: String,
    pub source: String,
    pub status: u16,
    pub title: Option<String>,
    pub login_likely: bool,
    pub redirect_url: Option<String>,
    pub snippet: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReconEndpointFinding {
    pub path: String,
    pub source: String,
    pub endpoint_type: String,
    pub status: Option<u16>,
    pub evidence: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReconBusinessProfile {
    pub category: String,
    pub confidence: f32,
    pub keywords: Vec<String>,
    pub features: Vec<String>,
    pub evidence: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReconArchitectureProfile {
    pub edge: Vec<String>,
    pub server: Vec<String>,
    pub runtime: Vec<String>,
    pub frontend: Vec<String>,
    pub cms: Vec<String>,
    pub api: Vec<String>,
    pub integrations: Vec<String>,
    pub build_hints: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReconCredentialSignal {
    pub surface: String,
    pub risk: String,
    pub evidence: String,
    pub attempted: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReconAuthSurface {
    pub has_auth_surface: bool,
    pub has_login_form: bool,
    pub has_admin_entry: bool,
    pub has_api_auth_hint: bool,
    pub risk_level: String,
    pub risk_score: u32,
    pub signals: Vec<String>,
    pub evidence: Vec<String>,
    pub suggested_next_step: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReconTlsCertificate {
    pub subject: Option<String>,
    pub common_name: Option<String>,
    pub organization: Option<String>,
    pub issuer: Option<String>,
    pub issuer_organization: Option<String>,
    pub serial_number: Option<String>,
    pub sha256: Option<String>,
    pub not_before: Option<String>,
    pub not_after: Option<String>,
    pub subject_alt_names: Vec<String>,
    pub is_wildcard: bool,
    pub self_signed: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReconArtifactFinding {
    pub artifact_type: String,
    pub url: String,
    pub status: u16,
    pub content_type: Option<String>,
    pub title: Option<String>,
    pub evidence: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReconExternalHost {
    pub host: String,
    pub source: String,
    pub category: String,
    pub evidence: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReconIpIntelligence {
    pub ip: String,
    pub country: Option<String>,
    pub region: Option<String>,
    pub city: Option<String>,
    pub isp: Option<String>,
    pub organization: Option<String>,
    pub asn: Option<String>,
    pub as_name: Option<String>,
    pub source: String,
    pub error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReconTargetReport {
    pub target: String,
    pub lookup_host: String,
    pub normalized_url: String,
    pub final_url: Option<String>,
    pub redirect_chain: Vec<String>,
    pub status: Option<u16>,
    pub blocked: bool,
    pub error: Option<String>,
    pub resolved_ips: Vec<String>,
    pub ip_intelligence: Vec<WebReconIpIntelligence>,
    pub rdap: Option<WebReconRdapRecord>,
    pub dns_records: Vec<WebReconDnsRecord>,
    pub server_header: Option<String>,
    pub powered_by: Option<String>,
    pub content_type: Option<String>,
    pub security_headers: Vec<WebReconSecurityHeader>,
    pub title: Option<String>,
    pub meta_description: Option<String>,
    pub generator: Option<String>,
    pub favicon_url: Option<String>,
    pub favicon_md5: Option<String>,
    pub favicon_mmh3: Option<i32>,
    pub tech_stack: Vec<String>,
    pub tls_certificate: Option<WebReconTlsCertificate>,
    pub artifact_findings: Vec<WebReconArtifactFinding>,
    pub external_hosts: Vec<WebReconExternalHost>,
    pub path_hints: Vec<String>,
    pub admin_candidates: Vec<WebReconPathFinding>,
    pub api_candidates: Vec<WebReconEndpointFinding>,
    pub forms: Vec<WebReconFormFinding>,
    pub business_profile: WebReconBusinessProfile,
    pub architecture: WebReconArchitectureProfile,
    pub auth_surface: WebReconAuthSurface,
    pub credential_signals: Vec<WebReconCredentialSignal>,
    pub site_kind: String,
    pub notes: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReconTechCount {
    pub tech: String,
    pub count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReconBatchStats {
    pub total: usize,
    pub reachable: usize,
    pub blocked: usize,
    pub login_pages: usize,
    pub admin_candidates: usize,
    pub api_candidates: usize,
    pub credential_surfaces: usize,
    pub high_risk_targets: usize,
    pub related_clusters: usize,
    pub unique_techs: usize,
    pub tech_counts: Vec<WebReconTechCount>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReconCorrelationCluster {
    pub cluster_type: String,
    pub value: String,
    pub label: String,
    pub confidence: f32,
    pub targets: Vec<String>,
    pub evidence: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReconBatchResult {
    pub stats: WebReconBatchStats,
    pub clusters: Vec<WebReconCorrelationCluster>,
    pub items: Vec<WebReconTargetReport>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebReconProgressEvent {
    pub task_id: String,
    pub current: usize,
    pub total: usize,
    pub target: Option<String>,
    pub stage: String,
    pub message: String,
    pub reachable: usize,
    pub admin_candidates: usize,
    pub api_candidates: usize,
    pub credential_surfaces: usize,
}

struct ClusterAccumulator {
    cluster_type: String,
    value: String,
    label: String,
    confidence: f32,
    targets: HashSet<String>,
    evidence: Vec<String>,
}

#[derive(Clone)]
struct HttpSnapshot {
    server: Option<String>,
    powered_by: Option<String>,
    content_type: Option<String>,
    location: Option<String>,
    strict_transport_security: Option<String>,
    x_frame_options: Option<String>,
    x_content_type_options: Option<String>,
    content_security_policy: Option<String>,
    referrer_policy: Option<String>,
    permissions_policy: Option<String>,
}

#[derive(Clone)]
struct FetchObservation {
    final_url: Url,
    status: u16,
    snapshot: HttpSnapshot,
    body: Vec<u8>,
    redirect_chain: Vec<String>,
}

fn trim_value(value: &str) -> String {
    value.trim().trim_matches('\u{0}').to_string()
}

fn normalize_host(host: &str) -> String {
    host.trim().trim_end_matches('.').to_string()
}

fn is_same_site_host(base_url: &Url, host: &str) -> bool {
    let candidate = normalize_host(host);
    let Some(base_host) = base_url.host_str().map(normalize_host) else {
        return false;
    };

    if candidate.eq_ignore_ascii_case(&base_host) {
        return true;
    }

    if let Some(domain) = base_url.domain().map(|value| value.to_lowercase()) {
        let candidate_lower = candidate.to_lowercase();
        if candidate_lower == domain || candidate_lower.ends_with(&format!(".{domain}")) {
            return true;
        }
    }

    false
}

fn classify_external_host(host: &str, raw: &str) -> String {
    let text = format!("{} {}", host.to_lowercase(), raw.to_lowercase());
    if text.contains("telegram")
        || text.contains("t.me")
        || text.contains("whatsapp")
        || text.contains("wa.me")
        || text.contains("tawk.to")
        || text.contains("crisp.chat")
        || text.contains("intercom")
        || text.contains("zendesk")
        || text.contains("zopim")
        || text.contains("livechat")
        || text.contains("freshchat")
        || text.contains("jivo")
        || text.contains("meiqia")
        || text.contains("qiyukf")
        || text.contains("udesk")
        || text.contains("sobot")
        || text.contains("easemob")
        || text.contains("客服")
    {
        return "contact".to_string();
    }
    if text.contains("oss-")
        || text.contains(".oss.")
        || text.contains("aliyuncs.com")
        || text.contains("cos.")
        || text.contains("myqcloud.com")
        || text.contains("qcloud.com")
        || text.contains("obs.")
        || text.contains("myhuaweicloud.com")
        || text.contains("s3.")
        || text.contains("s3-")
        || text.contains("amazonaws.com")
        || text.contains("storage.googleapis.com")
        || text.contains("blob.core.windows.net")
        || text.contains("objectstorage")
    {
        return "storage".to_string();
    }
    if text.contains("stripe")
        || text.contains("paypal")
        || text.contains("checkout")
        || text.contains("alipay")
        || text.contains("wxpay")
        || text.contains("wechatpay")
    {
        return "payment".to_string();
    }
    if text.contains("recaptcha")
        || text.contains("hcaptcha")
        || text.contains("turnstile")
        || text.contains("captcha")
    {
        return "captcha".to_string();
    }
    if text.contains("google-analytics")
        || text.contains("googletagmanager")
        || text.contains("doubleclick")
        || text.contains("hm.baidu")
        || text.contains("umami")
        || text.contains("matomo")
    {
        return "analytics".to_string();
    }
    if text.contains("auth0")
        || text.contains("okta")
        || text.contains("firebaseapp")
        || text.contains("clerk")
        || text.contains("login")
        || text.contains("oauth")
    {
        return "auth".to_string();
    }
    if text.contains("cloudflare")
        || text.contains("cloudfront")
        || text.contains("jsdelivr")
        || text.contains("unpkg")
        || text.contains("bootstrapcdn")
        || text.contains("gstatic")
        || text.contains("googleapis")
        || text.contains("alicdn")
        || text.contains("myqcloud")
        || text.contains("cdn")
        || text.contains("static")
    {
        return "cdn".to_string();
    }
    "external".to_string()
}

fn bytes_to_hex(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push_str(&format!("{byte:02x}"));
    }
    output
}

fn extract_attr_value(attrs: &str, name: &str) -> Option<String> {
    let lower = attrs.to_lowercase();
    let needle = format!("{name}=");
    let index = lower.find(&needle)?;
    let rest = attrs.get(index + needle.len()..)?.trim_start();

    if let Some(stripped) = rest.strip_prefix('"') {
        let end = stripped.find('"')?;
        return Some(trim_value(&stripped[..end]));
    }

    if let Some(stripped) = rest.strip_prefix('\'') {
        let end = stripped.find('\'')?;
        return Some(trim_value(&stripped[..end]));
    }

    let end = rest
        .find(|ch: char| ch.is_whitespace() || ch == '>')
        .unwrap_or(rest.len());
    Some(trim_value(&rest[..end]))
}

fn attr_matches(attrs: &str, name: &str, expected: &str) -> bool {
    extract_attr_value(attrs, name)
        .map(|value| value.eq_ignore_ascii_case(expected))
        .unwrap_or(false)
}

fn attr_contains_any(attrs: &str, name: &str, expected: &[&str]) -> bool {
    extract_attr_value(attrs, name)
        .map(|value| {
            let lower = value.to_lowercase();
            expected
                .iter()
                .any(|needle| lower.contains(&needle.to_lowercase()))
        })
        .unwrap_or(false)
}

fn clean_text(value: &str) -> String {
    truncate_text(
        strip_html_tags(value)
            .replace('\u{0}', "")
            .trim()
            .to_string(),
        240,
    )
}

fn default_business_profile() -> WebReconBusinessProfile {
    WebReconBusinessProfile {
        category: "unknown".to_string(),
        confidence: 0.0,
        keywords: Vec::new(),
        features: Vec::new(),
        evidence: Vec::new(),
    }
}

fn default_architecture_profile() -> WebReconArchitectureProfile {
    WebReconArchitectureProfile {
        edge: Vec::new(),
        server: Vec::new(),
        runtime: Vec::new(),
        frontend: Vec::new(),
        cms: Vec::new(),
        api: Vec::new(),
        integrations: Vec::new(),
        build_hints: Vec::new(),
    }
}

fn default_auth_surface() -> WebReconAuthSurface {
    WebReconAuthSurface {
        has_auth_surface: false,
        has_login_form: false,
        has_admin_entry: false,
        has_api_auth_hint: false,
        risk_level: "none".to_string(),
        risk_score: 0,
        signals: Vec::new(),
        evidence: Vec::new(),
        suggested_next_step:
            "No obvious authentication surface detected from this public pass.".to_string(),
    }
}

fn header_value(headers: &reqwest::header::HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(trim_value)
        .filter(|value| !value.is_empty())
}

fn snapshot_headers(headers: &reqwest::header::HeaderMap) -> HttpSnapshot {
    HttpSnapshot {
        server: header_value(headers, "server"),
        powered_by: header_value(headers, "x-powered-by"),
        content_type: header_value(headers, "content-type"),
        location: header_value(headers, LOCATION.as_str()),
        strict_transport_security: header_value(headers, "strict-transport-security"),
        x_frame_options: header_value(headers, "x-frame-options"),
        x_content_type_options: header_value(headers, "x-content-type-options"),
        content_security_policy: header_value(headers, "content-security-policy"),
        referrer_policy: header_value(headers, "referrer-policy"),
        permissions_policy: header_value(headers, "permissions-policy"),
    }
}

fn security_headers(snapshot: &HttpSnapshot) -> Vec<WebReconSecurityHeader> {
    [
        (
            "Strict-Transport-Security",
            snapshot.strict_transport_security.clone(),
        ),
        ("X-Frame-Options", snapshot.x_frame_options.clone()),
        (
            "X-Content-Type-Options",
            snapshot.x_content_type_options.clone(),
        ),
        (
            "Content-Security-Policy",
            snapshot.content_security_policy.clone(),
        ),
        ("Referrer-Policy", snapshot.referrer_policy.clone()),
        ("Permissions-Policy", snapshot.permissions_policy.clone()),
    ]
    .into_iter()
    .map(|(name, value)| WebReconSecurityHeader {
        name: name.to_string(),
        present: value.as_ref().map(|v| !v.is_empty()).unwrap_or(false),
        value,
    })
    .collect()
}

fn is_public_ipv4(ip: std::net::Ipv4Addr) -> bool {
    let octets = ip.octets();
    if ip.is_loopback()
        || ip.is_private()
        || ip.is_link_local()
        || ip.is_multicast()
        || ip.is_unspecified()
        || ip.is_broadcast()
    {
        return false;
    }
    if octets[0] == 0 || octets[0] == 100 && (64..128).contains(&octets[1]) {
        return false;
    }
    if octets[0] == 192 && octets[1] == 0 && octets[2] == 0 {
        return false;
    }
    if octets[0] == 192 && octets[1] == 0 && octets[2] == 2 {
        return false;
    }
    if octets[0] == 198 && (octets[1] == 18 || octets[1] == 19) {
        return false;
    }
    if octets[0] == 198 && octets[1] == 51 && octets[2] == 100 {
        return false;
    }
    if octets[0] == 203 && octets[1] == 0 && octets[2] == 113 {
        return false;
    }
    if octets[0] >= 224 {
        return false;
    }
    true
}

fn is_public_ipv6(ip: std::net::Ipv6Addr) -> bool {
    !ip.is_loopback()
        && !ip.is_multicast()
        && !ip.is_unspecified()
        && !ip.is_unique_local()
        && !ip.is_unicast_link_local()
}

fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_public_ipv4(v4),
        IpAddr::V6(v6) => is_public_ipv6(v6),
    }
}

fn host_port_for_url(url: &Url) -> u16 {
    url.port_or_known_default()
        .unwrap_or_else(|| if url.scheme() == "https" { 443 } else { 80 })
}

fn resolve_host_ips(host: &str, port: u16, allow_private: bool) -> Result<Vec<IpAddr>, String> {
    let host = normalize_host(host);
    if host.eq_ignore_ascii_case("localhost") {
        if allow_private {
            return Ok(vec![IpAddr::from([127, 0, 0, 1])]);
        }
        return Err("Target host resolves to localhost".to_string());
    }

    if let Ok(ip) = host.parse::<IpAddr>() {
        if allow_private || is_public_ip(ip) {
            return Ok(vec![ip]);
        }
        return Err(format!("Target IP {} is private or reserved", ip));
    }

    let mut seen = HashSet::new();
    let mut ips = Vec::new();

    for addr in (host.as_str(), port)
        .to_socket_addrs()
        .map_err(|e| e.to_string())?
    {
        let ip = addr.ip();
        if allow_private || is_public_ip(ip) {
            if seen.insert(ip) {
                ips.push(ip);
            }
        }
    }

    if ips.is_empty() {
        if allow_private {
            return Err(format!("Failed to resolve host {}", host));
        }
        return Err(format!(
            "Target {} resolves only to private or reserved addresses",
            host
        ));
    }

    Ok(ips)
}

fn build_candidate_urls(input: &str) -> Vec<Url> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }

    if trimmed.contains("://") {
        return Url::parse(trimmed).ok().into_iter().collect();
    }

    ["https", "http"]
        .iter()
        .filter_map(|scheme| Url::parse(&format!("{scheme}://{trimmed}")).ok())
        .collect()
}

fn read_limited_bytes(
    response: reqwest::blocking::Response,
    limit: usize,
) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    response
        .take(limit as u64)
        .read_to_end(&mut buf)
        .map_err(|e| e.to_string())?;
    Ok(buf)
}

fn fetch_with_redirects(
    client: &Client,
    initial_url: Url,
    allow_private_targets: bool,
    timeout: Duration,
    body_limit: usize,
) -> Result<FetchObservation, String> {
    let mut current_url = initial_url;
    let mut redirect_chain = vec![current_url.to_string()];

    for _ in 0..=MAX_REDIRECTS {
        let host = current_url
            .host_str()
            .ok_or_else(|| format!("URL {} has no host", current_url))?;
        let port = host_port_for_url(&current_url);
        let _ = resolve_host_ips(host, port, allow_private_targets)?;

        let response = client
            .get(current_url.clone())
            .timeout(timeout)
            .send()
            .map_err(|e| e.to_string())?;

        let status = response.status();
        let snapshot = snapshot_headers(response.headers());

        if status.is_redirection() {
            if let Some(location) = snapshot.location.clone() {
                let next_url = current_url
                    .join(&location)
                    .map_err(|e| format!("Invalid redirect target {}: {}", location, e))?;
                redirect_chain.push(next_url.to_string());
                current_url = next_url;
                continue;
            }
        }

        let body = read_limited_bytes(response, body_limit)?;
        return Ok(FetchObservation {
            final_url: current_url,
            status: status.as_u16(),
            snapshot,
            body,
            redirect_chain,
        });
    }

    Err("Too many redirects".to_string())
}

fn connect_tcp(host: &str, port: u16, timeout: Duration) -> Result<TcpStream, String> {
    let mut last_error = None;
    for addr in (host, port).to_socket_addrs().map_err(|e| e.to_string())? {
        match TcpStream::connect_timeout(&addr, timeout) {
            Ok(stream) => {
                stream
                    .set_read_timeout(Some(timeout))
                    .map_err(|e| e.to_string())?;
                stream
                    .set_write_timeout(Some(timeout))
                    .map_err(|e| e.to_string())?;
                return Ok(stream);
            }
            Err(err) => last_error = Some(err.to_string()),
        }
    }
    Err(last_error.unwrap_or_else(|| format!("Failed to connect to {host}:{port}")))
}

fn x509_name_attr_string<'a>(
    attr: Option<&x509_parser::x509::AttributeTypeAndValue<'a>>,
) -> Option<String> {
    attr.and_then(|value| value.as_str().ok())
        .map(trim_value)
        .filter(|value| !value.is_empty())
}

fn format_san_ip(bytes: &[u8]) -> Option<String> {
    match bytes.len() {
        4 => Some(std::net::Ipv4Addr::new(bytes[0], bytes[1], bytes[2], bytes[3]).to_string()),
        16 => {
            let mut parts = [0u8; 16];
            parts.copy_from_slice(bytes);
            Some(std::net::Ipv6Addr::from(parts).to_string())
        }
        _ => None,
    }
}

fn parse_tls_certificate(der_bytes: &[u8]) -> Result<WebReconTlsCertificate, String> {
    let (_, cert) = X509Certificate::from_der(der_bytes).map_err(|e| e.to_string())?;
    let subject = Some(cert.subject().to_string()).filter(|value| !value.trim().is_empty());
    let issuer = Some(cert.issuer().to_string()).filter(|value| !value.trim().is_empty());
    let common_name = x509_name_attr_string(cert.subject().iter_common_name().next());
    let organization = x509_name_attr_string(cert.subject().iter_organization().next());
    let issuer_organization = x509_name_attr_string(cert.issuer().iter_organization().next());

    let mut subject_alt_names = Vec::new();
    if let Ok(Some(san)) = cert.subject_alternative_name() {
        for name in &san.value.general_names {
            match name {
                GeneralName::DNSName(name) => push_unique(&mut subject_alt_names, name),
                GeneralName::URI(uri) => push_unique(&mut subject_alt_names, uri),
                GeneralName::IPAddress(bytes) => {
                    if let Some(ip) = format_san_ip(bytes) {
                        push_unique(&mut subject_alt_names, &ip);
                    }
                }
                _ => {}
            }
        }
    }

    let is_wildcard = common_name
        .as_ref()
        .map(|value| value.starts_with("*."))
        .unwrap_or(false)
        || subject_alt_names
            .iter()
            .any(|value| value.starts_with("*."));

    let digest = Sha256::digest(der_bytes);

    Ok(WebReconTlsCertificate {
        subject,
        common_name,
        organization,
        issuer,
        issuer_organization,
        serial_number: Some(cert.raw_serial_as_string()).filter(|value| !value.is_empty()),
        sha256: Some(bytes_to_hex(digest.as_slice())),
        not_before: Some(cert.validity().not_before.to_string())
            .filter(|value| !value.trim().is_empty()),
        not_after: Some(cert.validity().not_after.to_string())
            .filter(|value| !value.trim().is_empty()),
        subject_alt_names,
        is_wildcard,
        self_signed: cert.subject() == cert.issuer(),
    })
}

fn fetch_tls_certificate(
    url: &Url,
    timeout: Duration,
) -> Result<Option<WebReconTlsCertificate>, String> {
    if url.scheme() != "https" {
        return Ok(None);
    }

    let host = url
        .host_str()
        .ok_or_else(|| format!("URL {} has no host", url))?;
    let port = host_port_for_url(url);
    let stream = connect_tcp(host, port, timeout)?;
    let root_store = RootCertStore::from_iter(TLS_SERVER_ROOTS.iter().cloned());
    let config = ClientConfig::builder()
        .with_root_certificates(root_store)
        .with_no_client_auth();
    let server_name = ServerName::try_from(host.to_string()).map_err(|e| e.to_string())?;
    let conn = ClientConnection::new(Arc::new(config), server_name).map_err(|e| e.to_string())?;
    let mut tls_stream = StreamOwned::new(conn, stream);

    while tls_stream.conn.is_handshaking() {
        let (read_bytes, written_bytes) = tls_stream
            .conn
            .complete_io(&mut tls_stream.sock)
            .map_err(|e| e.to_string())?;
        if read_bytes == 0 && written_bytes == 0 {
            break;
        }
    }

    let Some(peer_cert) = tls_stream
        .conn
        .peer_certificates()
        .and_then(|certs| certs.first())
    else {
        return Ok(None);
    };

    parse_tls_certificate(peer_cert.as_ref()).map(Some)
}

fn parse_security_txt_evidence(body: &str) -> Vec<String> {
    let mut evidence = Vec::new();
    for line in body.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let lower = trimmed.to_lowercase();
        if lower.starts_with("contact:")
            || lower.starts_with("expires:")
            || lower.starts_with("policy:")
            || lower.starts_with("preferred-languages:")
            || lower.starts_with("canonical:")
        {
            evidence.push(truncate_text(trimmed.to_string(), 180));
        }
        if evidence.len() >= 6 {
            break;
        }
    }
    evidence
}

fn parse_manifest_evidence(body: &str) -> Vec<String> {
    let mut evidence = Vec::new();
    let Ok(json) = serde_json::from_str::<Value>(body) else {
        return evidence;
    };

    for key in [
        "name",
        "short_name",
        "start_url",
        "scope",
        "display",
        "theme_color",
    ] {
        if let Some(value) = json.get(key).and_then(|value| value.as_str()) {
            let cleaned = trim_value(value);
            if !cleaned.is_empty() {
                evidence.push(format!("{key}: {}", truncate_text(cleaned, 120)));
            }
        }
    }
    if let Some(count) = json
        .get("icons")
        .and_then(|value| value.as_array())
        .map(|items| items.len())
    {
        evidence.push(format!("icons: {count}"));
    }
    evidence.truncate(8);
    evidence
}

fn collect_manifest_hints(body: &str, base_url: &Url) -> Vec<String> {
    let mut hints = Vec::new();
    let Ok(json) = serde_json::from_str::<Value>(body) else {
        return hints;
    };

    for key in ["start_url", "scope", "id"] {
        if let Some(value) = json.get(key).and_then(|value| value.as_str()) {
            if let Some(path) = path_from_url(base_url, value) {
                push_unique(&mut hints, &path);
            }
        }
    }

    hints
}

fn fetch_artifact_body(
    client: &Client,
    url: Url,
    allow_private_targets: bool,
    timeout: Duration,
) -> Option<FetchObservation> {
    fetch_with_redirects(
        client,
        url,
        allow_private_targets,
        timeout,
        DEFAULT_SMALL_BODY_LIMIT,
    )
    .ok()
    .filter(|obs| obs.status < 400)
}

fn probe_standard_artifacts(
    client: &Client,
    base_url: &Url,
    manifest_url: Option<&str>,
    allow_private_targets: bool,
    timeout: Duration,
) -> (Vec<WebReconArtifactFinding>, Vec<String>) {
    let mut findings = Vec::new();
    let mut path_hints = Vec::new();
    let mut seen_urls = HashSet::new();

    let mut candidates: Vec<(String, Url)> = Vec::new();
    if let Ok(url) = base_url.join("/.well-known/security.txt") {
        candidates.push(("security-txt".to_string(), url));
    }
    if let Some(manifest_url) = manifest_url {
        if let Ok(url) = Url::parse(manifest_url) {
            candidates.push(("web-manifest".to_string(), url));
        }
    }
    for fallback in ["/manifest.json", "/site.webmanifest"] {
        if let Ok(url) = base_url.join(fallback) {
            candidates.push(("web-manifest".to_string(), url));
        }
    }

    for (artifact_type, url) in candidates {
        let Some(obs) = fetch_artifact_body(client, url, allow_private_targets, timeout) else {
            continue;
        };
        let final_url = obs.final_url.to_string();
        if !seen_urls.insert(format!("{}|{}", artifact_type, final_url.to_lowercase())) {
            continue;
        }

        let body_text = String::from_utf8_lossy(&obs.body).into_owned();
        let content_type = obs.snapshot.content_type.clone();
        let title = if artifact_type == "web-manifest" {
            serde_json::from_str::<Value>(&body_text)
                .ok()
                .and_then(|json| {
                    json.get("name")
                        .or_else(|| json.get("short_name"))
                        .and_then(|value| value.as_str())
                        .map(trim_value)
                })
        } else {
            None
        };
        let evidence = if artifact_type == "web-manifest" {
            let manifest_hints = collect_manifest_hints(&body_text, base_url);
            merge_path_hints(&mut path_hints, manifest_hints, 12);
            parse_manifest_evidence(&body_text)
        } else {
            parse_security_txt_evidence(&body_text)
        };

        findings.push(WebReconArtifactFinding {
            artifact_type,
            url: final_url,
            status: obs.status,
            content_type,
            title,
            evidence,
        });
    }

    (findings, path_hints)
}

fn extract_meta_content(body: &str, name: &str) -> Option<String> {
    let meta_re = Regex::new(r"(?is)<meta\b([^>]*)>").ok()?;
    for capture in meta_re.captures_iter(body) {
        let attrs = capture.get(1)?.as_str();
        if attr_matches(attrs, "name", name) || attr_matches(attrs, "property", name) {
            if let Some(content) = extract_attr_value(attrs, "content") {
                let cleaned = clean_text(&content);
                if !cleaned.is_empty() {
                    return Some(cleaned);
                }
            }
        }
    }
    None
}

fn extract_icon_url(body: &str, base_url: &Url) -> Option<String> {
    let link_re = Regex::new(r"(?is)<link\b([^>]*)>").ok()?;
    for capture in link_re.captures_iter(body) {
        let attrs = capture.get(1)?.as_str();
        if attr_contains_any(attrs, "rel", &["icon", "shortcut icon", "apple-touch-icon"]) {
            if let Some(href) = extract_attr_value(attrs, "href") {
                if let Ok(joined) = base_url.join(&href) {
                    return Some(joined.to_string());
                }
            }
        }
    }
    None
}

fn extract_manifest_url(body: &str, base_url: &Url) -> Option<String> {
    let link_re = Regex::new(r"(?is)<link\b([^>]*)>").ok()?;
    for capture in link_re.captures_iter(body) {
        let attrs = capture.get(1)?.as_str();
        if attr_contains_any(attrs, "rel", &["manifest"]) {
            if let Some(href) = extract_attr_value(attrs, "href") {
                if let Ok(joined) = base_url.join(&href) {
                    return Some(joined.to_string());
                }
            }
        }
    }
    None
}

fn collect_external_hosts(body: &str, base_url: &Url) -> Vec<WebReconExternalHost> {
    let mut findings = Vec::new();
    let mut seen = HashSet::new();

    let attr_re = match Regex::new(
        r#"(?is)\b(?:href|src|action|data-url|data-api)\s*=\s*["']((?:https?:)?//[^"'\s<>]+)["']"#,
    ) {
        Ok(value) => value,
        Err(_) => return findings,
    };

    let quoted_re = match Regex::new(r#"(?i)["']((?:https?:)?//[^"'\s<>]{4,240})["']"#) {
        Ok(value) => value,
        Err(_) => return findings,
    };

    let push_url = |raw: &str,
                    source: &str,
                    findings: &mut Vec<WebReconExternalHost>,
                    seen: &mut HashSet<String>| {
        let normalized_raw = if raw.starts_with("//") {
            format!("{}:{raw}", base_url.scheme())
        } else {
            raw.to_string()
        };
        let Ok(url) = Url::parse(&normalized_raw) else {
            return;
        };
        let Some(host) = url.host_str().map(normalize_host) else {
            return;
        };
        if is_same_site_host(base_url, &host) {
            return;
        }
        let key = format!("{}|{}", host.to_lowercase(), source);
        if seen.insert(key) {
            findings.push(WebReconExternalHost {
                category: classify_external_host(&host, raw),
                host,
                source: source.to_string(),
                evidence: raw.to_string(),
            });
        }
    };

    for capture in attr_re.captures_iter(body) {
        let raw = capture.get(1).map(|m| m.as_str()).unwrap_or_default();
        push_url(raw, "html-attr", &mut findings, &mut seen);
        if findings.len() >= 24 {
            return findings;
        }
    }

    for capture in quoted_re.captures_iter(body) {
        let raw = capture.get(1).map(|m| m.as_str()).unwrap_or_default();
        push_url(raw, "quoted-url", &mut findings, &mut seen);
        if findings.len() >= 24 {
            break;
        }
    }

    findings
}

fn extract_forms(body: &str, base_url: &Url) -> Vec<WebReconFormFinding> {
    let mut forms = Vec::new();
    let form_re = match Regex::new(r"(?is)<form\b([^>]*)>(.*?)</form>") {
        Ok(value) => value,
        Err(_) => return forms,
    };
    let input_re = match Regex::new(r"(?is)<input\b([^>]*)>") {
        Ok(value) => value,
        Err(_) => return forms,
    };

    for capture in form_re.captures_iter(body) {
        let attrs = capture.get(1).map(|m| m.as_str()).unwrap_or_default();
        let inner = capture.get(2).map(|m| m.as_str()).unwrap_or_default();
        let method = extract_attr_value(attrs, "method")
            .unwrap_or_else(|| "GET".to_string())
            .to_uppercase();
        let action_raw = extract_attr_value(attrs, "action").unwrap_or_default();
        let action = if action_raw.is_empty() {
            base_url.to_string()
        } else {
            base_url
                .join(&action_raw)
                .map(|url| url.to_string())
                .unwrap_or(action_raw.clone())
        };

        let mut fields = Vec::new();
        let mut has_password = false;
        let mut field_seen = HashSet::new();

        for input_cap in input_re.captures_iter(inner) {
            let input_attrs = input_cap.get(1).map(|m| m.as_str()).unwrap_or_default();
            let field_type = extract_attr_value(input_attrs, "type").unwrap_or_default();
            let field_name = extract_attr_value(input_attrs, "name")
                .or_else(|| extract_attr_value(input_attrs, "id"))
                .unwrap_or_default();
            let summary = match (field_name.is_empty(), field_type.is_empty()) {
                (false, false) => format!("{field_name}:{field_type}"),
                (false, true) => field_name.clone(),
                (true, false) => field_type.clone(),
                (true, true) => String::new(),
            };
            if !summary.is_empty() && field_seen.insert(summary.clone()) {
                fields.push(summary);
            }
            if field_type.eq_ignore_ascii_case("password")
                || field_name.to_lowercase().contains("password")
            {
                has_password = true;
            }
        }

        let lower = format!("{attrs} {inner}").to_lowercase();
        let login_likely = has_password
            || ADMIN_KEYWORDS.iter().any(|keyword| lower.contains(keyword))
            || lower.contains("captcha")
            || lower.contains("verification")
            || lower.contains("secure login");

        forms.push(WebReconFormFinding {
            action,
            method,
            fields,
            has_password,
            login_likely,
        });
    }

    forms
}

fn path_from_url(base_url: &Url, raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let lower = trimmed.to_lowercase();
    if trimmed.starts_with('#')
        || lower.starts_with("javascript:")
        || lower.starts_with("mailto:")
        || lower.starts_with("tel:")
        || lower.starts_with("data:")
        || lower.starts_with("blob:")
    {
        return None;
    }

    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        let parsed = Url::parse(trimmed).ok()?;
        if parsed
            .host_str()
            .map(|host| is_same_site_host(base_url, host))
            .unwrap_or(false)
        {
            let mut path = parsed.path().to_string();
            if let Some(query) = parsed.query() {
                path.push('?');
                path.push_str(query);
            }
            return Some(if path.starts_with('/') {
                path
            } else {
                format!("/{path}")
            });
        }
        return None;
    }

    let mut path = trimmed.to_string();
    if !path.starts_with('/') {
        path.insert(0, '/');
    }
    Some(path)
}

fn is_interesting_path(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.contains('?')
        || lower.ends_with(".php")
        || lower.ends_with(".jsp")
        || lower.ends_with(".aspx")
        || lower.ends_with(".do")
        || lower.ends_with(".action")
        || lower.ends_with(".cgi")
        || lower.ends_with(".pl")
        || lower.ends_with(".rb")
        || lower.split(['/', '?', '&', '=']).any(|segment| {
            ADMIN_KEYWORDS
                .iter()
                .any(|keyword| segment.contains(keyword))
        })
}

fn is_api_path(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.contains("/api/")
        || lower.starts_with("/api")
        || lower.contains("/ajax/")
        || lower.contains("/graphql")
        || lower.contains("/rest/")
        || lower.contains("/v1/")
        || lower.contains("/v2/")
        || lower.contains("/v3/")
        || lower.contains("openapi")
        || lower.contains("swagger")
        || lower.ends_with(".json")
}

fn collect_robot_hints(body: &str, base_url: &Url) -> Vec<String> {
    let mut paths = Vec::new();
    let mut seen = HashSet::new();

    for line in body.lines() {
        let trimmed = line.trim();
        let prefix = if trimmed.len() >= 9 && trimmed[..9].eq_ignore_ascii_case("disallow:") {
            Some("Disallow:")
        } else if trimmed.len() >= 6 && trimmed[..6].eq_ignore_ascii_case("allow:") {
            Some("Allow:")
        } else if trimmed.len() >= 8 && trimmed[..8].eq_ignore_ascii_case("sitemap:") {
            Some("Sitemap:")
        } else {
            None
        };

        let Some(prefix) = prefix else {
            continue;
        };
        let raw = trimmed[prefix.len()..].trim();
        if let Some(path) = path_from_url(base_url, raw) {
            if is_interesting_path(&path) && seen.insert(path.clone()) {
                paths.push(path);
            }
        }
    }

    paths
}

fn collect_sitemap_hints(body: &str, base_url: &Url) -> Vec<String> {
    let mut paths = Vec::new();
    let mut seen = HashSet::new();
    let loc_re = match Regex::new(r"(?is)<loc>\s*(.*?)\s*</loc>") {
        Ok(value) => value,
        Err(_) => return paths,
    };

    for capture in loc_re.captures_iter(body) {
        let raw = capture.get(1).map(|m| m.as_str()).unwrap_or_default();
        if let Some(path) = path_from_url(base_url, raw) {
            if is_interesting_path(&path) && seen.insert(path.clone()) {
                paths.push(path);
            }
        }
    }

    paths
}

fn is_static_asset_path(path: &str) -> bool {
    let lower = path
        .split('?')
        .next()
        .unwrap_or(path)
        .split('#')
        .next()
        .unwrap_or(path)
        .to_lowercase();
    [
        ".css", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".woff", ".woff2",
        ".ttf", ".eot", ".map", ".mp4", ".mp3", ".pdf", ".zip", ".rar", ".7z",
    ]
    .iter()
    .any(|ext| lower.ends_with(ext))
}

fn collect_html_path_hints(body: &str, base_url: &Url) -> Vec<String> {
    let mut paths = Vec::new();
    let mut seen = HashSet::new();

    let attr_re = match Regex::new(
        r#"(?is)\b(?:href|src|action|data-url|data-api)\s*=\s*["']([^"']+)["']"#,
    ) {
        Ok(value) => value,
        Err(_) => return paths,
    };

    for capture in attr_re.captures_iter(body) {
        let raw = capture.get(1).map(|m| m.as_str()).unwrap_or_default();
        if let Some(path) = path_from_url(base_url, raw) {
            if !is_static_asset_path(&path)
                && (is_interesting_path(&path) || is_api_path(&path))
                && seen.insert(path.clone())
            {
                paths.push(path);
            }
        }
    }

    let quoted_path_re = match Regex::new(r#"(?i)["']((?:/|https?://)[^"'\s<>]{2,240})["']"#) {
        Ok(value) => value,
        Err(_) => return paths,
    };

    for capture in quoted_path_re.captures_iter(body) {
        let raw = capture.get(1).map(|m| m.as_str()).unwrap_or_default();
        if let Some(path) = path_from_url(base_url, raw) {
            if !is_static_asset_path(&path)
                && (is_interesting_path(&path) || is_api_path(&path))
                && seen.insert(path.clone())
            {
                paths.push(path);
            }
        }
        if paths.len() >= 60 {
            break;
        }
    }

    paths
}

fn collect_form_paths(forms: &[WebReconFormFinding]) -> Vec<String> {
    let mut paths = Vec::new();
    let mut seen = HashSet::new();
    for form in forms {
        let parsed = Url::parse(&form.action).ok();
        let candidate = parsed
            .as_ref()
            .map(|url| url.path().to_string())
            .filter(|path| !path.is_empty())
            .unwrap_or_else(|| form.action.clone());
        if is_interesting_path(&candidate) && seen.insert(candidate.clone()) {
            paths.push(candidate);
        }
    }
    paths
}

fn build_path_hints(
    base_url: &Url,
    body: &str,
    forms: &[WebReconFormFinding],
    robots: Option<&str>,
    sitemap: Option<&str>,
) -> Vec<String> {
    let mut hints = Vec::new();
    let mut seen = HashSet::new();

    for path in collect_form_paths(forms) {
        if seen.insert(path.clone()) {
            hints.push(path);
        }
    }

    for path in collect_html_path_hints(body, base_url) {
        if seen.insert(path.clone()) {
            hints.push(path);
        }
    }

    if let Some(robots_body) = robots {
        for path in collect_robot_hints(robots_body, base_url) {
            if seen.insert(path.clone()) {
                hints.push(path);
            }
        }
    }

    if let Some(sitemap_body) = sitemap {
        for path in collect_sitemap_hints(sitemap_body, base_url) {
            if seen.insert(path.clone()) {
                hints.push(path);
            }
        }
    }

    let body_lower = body.to_lowercase();
    for keyword in ADMIN_KEYWORDS {
        if body_lower.contains(keyword) {
            let guess = format!("/{keyword}");
            if seen.insert(guess.clone()) {
                hints.push(guess);
            }
        }
    }

    hints.truncate(60);
    hints
}

fn merge_path_hints(target: &mut Vec<String>, new_paths: Vec<String>, limit: usize) {
    let mut seen: HashSet<String> = target.iter().cloned().collect();
    for path in new_paths {
        if seen.insert(path.clone()) {
            target.push(path);
        }
        if target.len() >= limit {
            break;
        }
    }
}

fn collect_script_urls(body: &str, base_url: &Url) -> Vec<Url> {
    let mut urls = Vec::new();
    let mut seen = HashSet::new();
    let script_re = match Regex::new(r#"(?is)<script\b([^>]*)>"#) {
        Ok(value) => value,
        Err(_) => return urls,
    };

    for capture in script_re.captures_iter(body) {
        let attrs = capture.get(1).map(|m| m.as_str()).unwrap_or_default();
        let Some(src) = extract_attr_value(attrs, "src") else {
            continue;
        };
        let Ok(url) = base_url.join(&src) else {
            continue;
        };
        if url.host_str() != base_url.host_str() {
            continue;
        }
        let path = url.path().to_lowercase();
        if !path.ends_with(".js") && !path.contains(".js?") {
            continue;
        }
        if seen.insert(url.to_string()) {
            urls.push(url);
        }
        if urls.len() >= JS_FETCH_LIMIT {
            break;
        }
    }

    urls
}

fn collect_js_path_hints(
    client: &Client,
    base_url: &Url,
    body: &str,
    allow_private_targets: bool,
    timeout: Duration,
) -> Vec<String> {
    let mut paths = Vec::new();
    let mut seen = HashSet::new();

    for script_url in collect_script_urls(body, base_url) {
        let Ok(obs) = fetch_with_redirects(
            client,
            script_url,
            allow_private_targets,
            timeout,
            JS_BODY_LIMIT,
        ) else {
            continue;
        };
        if obs.status >= 400 {
            continue;
        }
        let js_body = String::from_utf8_lossy(&obs.body);
        for path in collect_html_path_hints(&js_body, base_url) {
            if (is_api_path(&path) || is_interesting_path(&path)) && seen.insert(path.clone()) {
                paths.push(path);
            }
            if paths.len() >= 40 {
                return paths;
            }
        }
    }

    paths
}

fn probe_path_candidates(path_hints: &[String]) -> Vec<(String, String)> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    for path in path_hints {
        if is_interesting_path(path) && seen.insert(path.clone()) {
            candidates.push((path.clone(), "hint".to_string()));
        }
    }

    for path in COMMON_ADMIN_PATHS {
        let path = (*path).to_string();
        if seen.insert(path.clone()) {
            candidates.push((path, "common".to_string()));
        }
    }

    candidates
}

fn endpoint_type_for_path(path: &str) -> Option<String> {
    let lower = path.to_lowercase();
    if lower.contains("graphql") {
        return Some("graphql".to_string());
    }
    if lower.contains("swagger") || lower.contains("openapi") || lower.contains("api-doc") {
        return Some("api-docs".to_string());
    }
    if lower.contains("/admin") || lower.contains("/manage") || lower.contains("/console") {
        return Some("admin-api".to_string());
    }
    if is_api_path(path) {
        return Some("api".to_string());
    }
    None
}

fn build_api_candidates(path_hints: &[String]) -> Vec<WebReconEndpointFinding> {
    let mut findings = Vec::new();
    let mut seen = HashSet::new();
    for path in path_hints {
        let Some(endpoint_type) = endpoint_type_for_path(path) else {
            continue;
        };
        if seen.insert(path.to_lowercase()) {
            findings.push(WebReconEndpointFinding {
                path: path.clone(),
                source: "path-hint".to_string(),
                endpoint_type,
                status: None,
                evidence: None,
            });
        }
        if findings.len() >= 30 {
            break;
        }
    }
    findings
}

fn title_from_body(body: &str) -> Option<String> {
    let title = extract_html_title(body);
    if title.trim().is_empty() {
        None
    } else {
        Some(title.trim().to_string())
    }
}

fn detect_tech_stack(body: &str, snapshot: &HttpSnapshot, final_url: &Url) -> Vec<String> {
    let mut techs: Vec<String> = Vec::new();
    let body_lower = body.to_lowercase();
    let server = snapshot.server.as_deref().unwrap_or("").to_lowercase();
    let powered_by = snapshot.powered_by.as_deref().unwrap_or("").to_lowercase();
    let content_type = snapshot
        .content_type
        .as_deref()
        .unwrap_or("")
        .to_lowercase();
    let final_host = final_url.host_str().unwrap_or("").to_lowercase();

    let mut push = |name: &str| {
        if !techs
            .iter()
            .any(|existing| existing.eq_ignore_ascii_case(name))
        {
            techs.push(name.to_string());
        }
    };

    if server.contains("cloudflare")
        || snapshot.content_security_policy.is_some() && final_host.contains("cloudflare")
    {
        push("Cloudflare");
    }
    if server.contains("nginx") {
        push("Nginx");
    }
    if server.contains("apache") {
        push("Apache");
    }
    if server.contains("microsoft-iis") {
        push("IIS");
    }
    if server.contains("apache-coyote")
        || server.contains("tomcat")
        || body_lower.contains("tomcat")
    {
        push("Tomcat");
        push("Java");
    }
    if powered_by.contains("php") || body_lower.contains(".php") {
        push("PHP");
    }
    if powered_by.contains("asp.net") || server.contains("asp.net") {
        push("ASP.NET");
    }
    if powered_by.contains("express") || body_lower.contains("express") {
        push("Node.js");
        push("Express");
    }
    if body_lower.contains("spring boot") || body_lower.contains("springframework") {
        push("Spring Boot");
        push("Java");
    }
    if body_lower.contains("jenkins") {
        push("Jenkins");
        push("Java");
    }
    if body_lower.contains("phpmyadmin") || body_lower.contains("pma_username") {
        push("phpMyAdmin");
        push("PHP");
    }
    if body_lower.contains("wordpress") || body_lower.contains("wp-content") {
        push("WordPress");
        push("PHP");
    }
    if body_lower.contains("drupal") {
        push("Drupal");
        push("PHP");
    }
    if body_lower.contains("joomla") {
        push("Joomla");
        push("PHP");
    }
    if body_lower.contains("thinkphp") {
        push("ThinkPHP");
        push("PHP");
    }
    if body_lower.contains("laravel") {
        push("Laravel");
        push("PHP");
    }
    if body_lower.contains("discuz") {
        push("Discuz!");
        push("PHP");
    }
    if body_lower.contains("phpcms") {
        push("PHPCMS");
        push("PHP");
    }
    if body_lower.contains("dedecms") {
        push("DedeCMS");
        push("PHP");
    }
    if body_lower.contains("ecshop") {
        push("ECShop");
        push("PHP");
    }
    if body_lower.contains("typecho") {
        push("Typecho");
        push("PHP");
    }
    if body_lower.contains("jquery") {
        push("jQuery");
    }
    if body_lower.contains("vue") {
        push("Vue");
    }
    if body_lower.contains("react") {
        push("React");
    }
    if body_lower.contains("angular") {
        push("Angular");
    }
    if body_lower.contains("bootstrap") {
        push("Bootstrap");
    }
    if body_lower.contains("layui") {
        push("LayUI");
    }
    if body_lower.contains("element-ui") || body_lower.contains("element plus") {
        push("Element UI");
    }
    if body_lower.contains("next.js") || body_lower.contains("_next/") {
        push("Next.js");
        push("React");
    }
    if body_lower.contains("nuxt") {
        push("Nuxt.js");
        push("Vue");
    }
    if body_lower.contains("webpack") {
        push("Webpack");
    }
    if body_lower.contains("vite") || body_lower.contains("/@vite/") {
        push("Vite");
    }
    if content_type.contains("application/json") {
        push("JSON API");
    }

    techs
}

fn classify_site_kind(
    status: Option<u16>,
    title: Option<&str>,
    body: &str,
    forms: &[WebReconFormFinding],
    admin_candidates: &[WebReconPathFinding],
    tech_stack: &[String],
    content_type: Option<&str>,
) -> String {
    let title_lower = title.unwrap_or("").to_lowercase();
    let body_lower = body.to_lowercase();
    let content_type_lower = content_type.unwrap_or("").to_lowercase();
    let has_login_form = forms.iter().any(|form| form.login_likely);
    let has_admin_hit = admin_candidates.iter().any(|candidate| {
        candidate.login_likely || candidate.status == 401 || candidate.status == 403
    });

    if matches!(status, Some(404))
        && (title_lower.contains("404") || body_lower.contains("not found"))
    {
        return "error-page".to_string();
    }
    if has_login_form
        || has_admin_hit
        || ADMIN_KEYWORDS
            .iter()
            .any(|keyword| title_lower.contains(keyword) || body_lower.contains(keyword))
    {
        return "login-portal".to_string();
    }
    if tech_stack.iter().any(|tech| {
        CMS_KEYWORDS
            .iter()
            .any(|keyword| tech.to_lowercase().contains(keyword))
    }) || CMS_KEYWORDS
        .iter()
        .any(|keyword| title_lower.contains(keyword) || body_lower.contains(keyword))
    {
        return "cms".to_string();
    }
    if content_type_lower.contains("application/json")
        || body_lower.trim_start().starts_with('{')
        || body_lower.trim_start().starts_with('[')
        || API_KEYWORDS
            .iter()
            .any(|keyword| title_lower.contains(keyword) || body_lower.contains(keyword))
    {
        return "api".to_string();
    }
    if ECOMMERCE_KEYWORDS
        .iter()
        .any(|keyword| title_lower.contains(keyword) || body_lower.contains(keyword))
    {
        return "ecommerce".to_string();
    }
    if PORTAL_KEYWORDS
        .iter()
        .any(|keyword| title_lower.contains(keyword) || body_lower.contains(keyword))
    {
        return "portal".to_string();
    }
    if CONTENT_KEYWORDS
        .iter()
        .any(|keyword| title_lower.contains(keyword) || body_lower.contains(keyword))
    {
        return "content".to_string();
    }
    if body.len() < 6_000 && forms.is_empty() {
        return "static".to_string();
    }
    "web-app".to_string()
}

fn push_unique(items: &mut Vec<String>, value: &str) {
    let trimmed = value.trim();
    if !trimmed.is_empty()
        && !items
            .iter()
            .any(|existing| existing.eq_ignore_ascii_case(trimmed))
    {
        items.push(trimmed.to_string());
    }
}

fn collect_keyword_hits(text: &str, keywords: &[&str]) -> Vec<String> {
    let lower = text.to_lowercase();
    let mut hits = Vec::new();
    for keyword in keywords {
        if lower.contains(&keyword.to_lowercase()) {
            push_unique(&mut hits, keyword);
        }
    }
    hits
}

fn build_business_profile(
    title: Option<&str>,
    meta_description: Option<&str>,
    body: &str,
    forms: &[WebReconFormFinding],
    path_hints: &[String],
    admin_candidates: &[WebReconPathFinding],
    external_hosts: &[WebReconExternalHost],
) -> WebReconBusinessProfile {
    let context = format!(
        "{}\n{}\n{}\n{}\n{}",
        title.unwrap_or_default(),
        meta_description.unwrap_or_default(),
        body,
        path_hints.join("\n"),
        external_hosts
            .iter()
            .map(|item| format!("{}:{}", item.category, item.host))
            .collect::<Vec<_>>()
            .join("\n")
    );

    let categories: [(&str, &[&str]); 10] = [
        (
            "crypto-wallet",
            &[
                "usdt",
                "trc20",
                "erc20",
                "bitcoin",
                "btc",
                "eth",
                "wallet",
                "钱包",
                "数字资产",
                "虚拟币",
                "合约",
                "币安",
                "充值地址",
                "链上",
            ],
        ),
        (
            "investment",
            &[
                "投资",
                "理财",
                "收益",
                "返利",
                "日化",
                "量化",
                "套利",
                "认购",
                "申购",
                "profit",
                "investment",
                "trading",
                "exchange",
            ],
        ),
        (
            "gambling",
            &[
                "博彩",
                "彩票",
                "开奖",
                "棋牌",
                "真人",
                "百家乐",
                "时时彩",
                "casino",
                "bet",
                "lottery",
                "sportsbook",
                "jackpot",
            ],
        ),
        (
            "payment-merchant",
            &[
                "支付", "收款", "代付", "代收", "商户", "通道", "结算", "merchant", "payment",
                "cashier", "checkout", "pay",
            ],
        ),
        (
            "loan",
            &[
                "贷款", "借款", "额度", "放款", "征信", "loan", "credit", "borrow",
            ],
        ),
        (
            "task-rebate",
            &[
                "刷单", "任务", "悬赏", "派单", "接单", "返佣", "task", "rebate", "mission",
            ],
        ),
        (
            "ecommerce",
            &[
                "商品",
                "购物车",
                "订单",
                "商城",
                "store",
                "cart",
                "order",
                "product",
                "shop",
            ],
        ),
        (
            "dating-social",
            &[
                "交友",
                "约会",
                "聊天",
                "附近的人",
                "dating",
                "chat",
                "match",
            ],
        ),
        (
            "content",
            &["新闻", "文章", "博客", "资讯", "news", "article", "blog"],
        ),
        (
            "corporate",
            &[
                "公司",
                "关于我们",
                "解决方案",
                "产品中心",
                "contact us",
                "about us",
                "solution",
            ],
        ),
    ];

    let mut best_category = "unknown".to_string();
    let mut best_hits: Vec<String> = Vec::new();
    for (category, keywords) in categories {
        let hits = collect_keyword_hits(&context, keywords);
        if hits.len() > best_hits.len() {
            best_category = category.to_string();
            best_hits = hits;
        }
    }

    let mut features = Vec::new();
    if forms
        .iter()
        .any(|form| form.login_likely || form.has_password)
    {
        push_unique(&mut features, "登录/认证");
    }
    if collect_keyword_hits(&context, &["注册", "sign up", "register", "create account"]).len() > 0
    {
        push_unique(&mut features, "注册");
    }
    if collect_keyword_hits(&context, &["充值", "入金", "deposit", "recharge"]).len() > 0 {
        push_unique(&mut features, "充值/入金");
    }
    if collect_keyword_hits(&context, &["提现", "提款", "withdraw"]).len() > 0 {
        push_unique(&mut features, "提现/出金");
    }
    if collect_keyword_hits(
        &context,
        &["客服", "在线客服", "telegram", "whatsapp", "service"],
    )
    .len()
        > 0
    {
        push_unique(&mut features, "客服/引流");
    }
    if collect_keyword_hits(&context, &["下载", "app", "android", "ios", "apk"]).len() > 0 {
        push_unique(&mut features, "App 下载");
    }
    if collect_keyword_hits(
        &context,
        &["代理", "推广", "邀请", "affiliate", "agent", "invite"],
    )
    .len()
        > 0
    {
        push_unique(&mut features, "代理/推广");
    }
    if admin_candidates.len() > 0 {
        push_unique(&mut features, "管理后台");
    }
    if path_hints.iter().any(|path| is_api_path(path)) {
        push_unique(&mut features, "API 接口");
    }
    if external_hosts.iter().any(|item| item.category == "contact") {
        push_unique(&mut features, "客服/引流");
    }
    if external_hosts.iter().any(|item| item.category == "payment") {
        push_unique(&mut features, "支付/跳转");
    }
    if external_hosts.iter().any(|item| item.category == "captcha") {
        push_unique(&mut features, "人机验证");
    }

    let mut evidence = Vec::new();
    if let Some(title) = title {
        if !title.trim().is_empty() {
            evidence.push(format!("Title: {}", truncate_text(title.to_string(), 80)));
        }
    }
    if let Some(description) = meta_description {
        if !description.trim().is_empty() {
            evidence.push(format!(
                "Description: {}",
                truncate_text(description.to_string(), 120)
            ));
        }
    }
    for keyword in best_hits.iter().take(8) {
        evidence.push(format!("Keyword: {keyword}"));
    }
    for path in path_hints
        .iter()
        .filter(|path| is_api_path(path) || is_interesting_path(path))
        .take(8)
    {
        evidence.push(format!("Path: {path}"));
    }

    for external in external_hosts.iter().take(6) {
        evidence.push(format!(
            "External: {} [{}]",
            external.host, external.category
        ));
    }

    let signal_count = best_hits.len() + features.len();
    let confidence = if best_category == "unknown" {
        0.0
    } else {
        (0.28 + signal_count as f32 * 0.08).min(0.92)
    };

    WebReconBusinessProfile {
        category: best_category,
        confidence,
        keywords: best_hits.into_iter().take(12).collect(),
        features,
        evidence: evidence.into_iter().take(16).collect(),
    }
}

fn build_architecture_profile(
    snapshot: &HttpSnapshot,
    tech_stack: &[String],
    dns_records: &[WebReconDnsRecord],
    path_hints: &[String],
    body: &str,
    external_hosts: &[WebReconExternalHost],
) -> WebReconArchitectureProfile {
    let mut profile = default_architecture_profile();
    let body_lower = body.to_lowercase();
    let dns_text = dns_records
        .iter()
        .map(|record| record.value.to_lowercase())
        .collect::<Vec<_>>()
        .join(" ");
    let server = snapshot.server.as_deref().unwrap_or("").to_lowercase();

    for (needle, label) in [
        ("cloudflare", "Cloudflare"),
        ("cloudfront", "AWS CloudFront"),
        ("fastly", "Fastly"),
        ("akamai", "Akamai"),
        ("alicdn", "Alibaba CDN"),
        ("aliyun", "Alibaba Cloud"),
        ("tencent", "Tencent Cloud"),
        ("myqcloud", "Tencent Cloud"),
        ("vercel", "Vercel"),
        ("netlify", "Netlify"),
        ("cdn", "CDN"),
    ] {
        if server.contains(needle) || dns_text.contains(needle) || body_lower.contains(needle) {
            push_unique(&mut profile.edge, label);
        }
    }

    for tech in tech_stack {
        let lower = tech.to_lowercase();
        if ["nginx", "apache", "iis", "tomcat"]
            .iter()
            .any(|needle| lower.contains(needle))
        {
            push_unique(&mut profile.server, tech);
        }
        if [
            "php",
            "java",
            "spring boot",
            "node.js",
            "express",
            "asp.net",
        ]
        .iter()
        .any(|needle| lower.contains(needle))
        {
            push_unique(&mut profile.runtime, tech);
        }
        if [
            "react",
            "vue",
            "angular",
            "next.js",
            "nuxt",
            "jquery",
            "bootstrap",
            "layui",
            "element ui",
        ]
        .iter()
        .any(|needle| lower.contains(needle))
        {
            push_unique(&mut profile.frontend, tech);
        }
        if CMS_KEYWORDS.iter().any(|needle| lower.contains(needle)) {
            push_unique(&mut profile.cms, tech);
        }
        if lower.contains("json api") {
            push_unique(&mut profile.api, tech);
        }
    }

    for path in path_hints.iter().filter(|path| is_api_path(path)).take(12) {
        push_unique(&mut profile.api, path);
    }

    for external in external_hosts {
        let label = match external.category.as_str() {
            "contact" => Some(format!("Contact: {}", external.host)),
            "payment" => Some(format!("Payment: {}", external.host)),
            "captcha" => Some(format!("Captcha: {}", external.host)),
            "analytics" => Some(format!("Analytics: {}", external.host)),
            "auth" => Some(format!("Auth: {}", external.host)),
            "cdn" => Some(format!("CDN: {}", external.host)),
            "storage" => Some(format!("Storage: {}", external.host)),
            _ => None,
        };
        if let Some(label) = label {
            push_unique(&mut profile.integrations, &label);
        }
        if external.category == "cdn" {
            push_unique(&mut profile.edge, &external.host);
        }
    }

    for (needle, label) in [
        ("__next_data__", "Next.js data bootstrap"),
        ("_next/", "Next.js static assets"),
        ("nuxt", "Nuxt assets"),
        ("webpack", "Webpack bundle"),
        ("vite", "Vite bundle"),
        ("static/js", "SPA static bundle"),
        ("assets/index-", "Vite hashed assets"),
    ] {
        if body_lower.contains(needle) {
            push_unique(&mut profile.build_hints, label);
        }
    }

    profile
}

fn build_credential_signals(
    forms: &[WebReconFormFinding],
    admin_candidates: &[WebReconPathFinding],
    tech_stack: &[String],
) -> Vec<WebReconCredentialSignal> {
    let mut signals = Vec::new();
    let mut seen = HashSet::new();

    for form in forms {
        if form.login_likely || form.has_password {
            let key = format!("form|{}", form.action.to_lowercase());
            if seen.insert(key) {
                signals.push(WebReconCredentialSignal {
                    surface: form.action.clone(),
                    risk: "login-surface".to_string(),
                    evidence: format!(
                        "{} form with fields: {}",
                        form.method,
                        if form.fields.is_empty() {
                            "-".to_string()
                        } else {
                            form.fields.join(", ")
                        }
                    ),
                    attempted: false,
                });
            }
        }
    }

    for candidate in admin_candidates {
        if candidate.login_likely || matches!(candidate.status, 200 | 401 | 403) {
            let key = format!("admin|{}", candidate.path.to_lowercase());
            if seen.insert(key) {
                signals.push(WebReconCredentialSignal {
                    surface: candidate.path.clone(),
                    risk: "admin-login-candidate".to_string(),
                    evidence: format!(
                        "status {}{}",
                        candidate.status,
                        candidate
                            .title
                            .as_ref()
                            .map(|title| format!(", title: {title}"))
                            .unwrap_or_default()
                    ),
                    attempted: false,
                });
            }
        }
    }

    let tech_text = tech_stack.join(" ").to_lowercase();
    for (needle, label) in [
        (
            "wordpress",
            "WordPress default/admin credential exposure risk",
        ),
        ("tomcat", "Tomcat manager credential exposure risk"),
        ("jenkins", "Jenkins credential exposure risk"),
        ("phpmyadmin", "phpMyAdmin credential exposure risk"),
    ] {
        if tech_text.contains(needle) {
            let key = format!("tech|{needle}");
            if seen.insert(key) {
                signals.push(WebReconCredentialSignal {
                    surface: label.to_string(),
                    risk: "default-password-risk".to_string(),
                    evidence: format!("Technology marker: {needle}"),
                    attempted: false,
                });
            }
        }
    }

    signals.truncate(20);
    signals
}

fn endpoint_auth_text(candidate: &WebReconEndpointFinding) -> String {
    format!(
        "{} {} {} {}",
        candidate.path,
        candidate.source,
        candidate.endpoint_type,
        candidate.evidence.clone().unwrap_or_default()
    )
    .to_lowercase()
}

fn text_contains_any(text: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| text.contains(needle))
}

fn endpoint_looks_like_auth(candidate: &WebReconEndpointFinding) -> bool {
    let lower = endpoint_auth_text(candidate);
    text_contains_any(
        &lower,
        &[
            "auth",
            "login",
            "signin",
            "session",
            "token",
            "oauth",
            "passport",
            "sso",
            "user/login",
            "merchant",
            "agent",
            "member",
            "account",
            "captcha",
            "verify",
            "password",
            "pwd",
        ],
    )
}

fn build_auth_surface(
    forms: &[WebReconFormFinding],
    admin_candidates: &[WebReconPathFinding],
    api_candidates: &[WebReconEndpointFinding],
) -> WebReconAuthSurface {
    let has_login_form = forms.iter().any(|form| form.login_likely || form.has_password);
    let has_admin_entry = admin_candidates
        .iter()
        .any(|candidate| candidate.login_likely || matches!(candidate.status, 200 | 401 | 403));
    let has_api_auth_hint = api_candidates.iter().any(endpoint_looks_like_auth);

    let mut signals = Vec::new();
    let mut evidence = Vec::new();
    let mut risk_score = 0u32;
    let form_text = forms
        .iter()
        .map(|form| format!("{} {} {}", form.action, form.method, form.fields.join(" ")))
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase();
    let admin_text = admin_candidates
        .iter()
        .map(|candidate| {
            format!(
                "{} {} {} {}",
                candidate.path,
                candidate.source,
                candidate.title.clone().unwrap_or_default(),
                candidate.snippet.clone().unwrap_or_default()
            )
        })
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase();
    let api_text = api_candidates
        .iter()
        .map(endpoint_auth_text)
        .collect::<Vec<_>>()
        .join(" ");
    let auth_text = format!("{form_text} {admin_text} {api_text}");

    if has_login_form {
        risk_score += 35;
        signals.push("login-form".to_string());
        if let Some(form) = forms.iter().find(|form| form.login_likely || form.has_password) {
            evidence.push(format!(
                "Login form {} {} with fields: {}",
                form.method.to_uppercase(),
                form.action,
                if form.fields.is_empty() {
                    "-".to_string()
                } else {
                    form.fields.join(", ")
                }
            ));
        }
    }

    if has_admin_entry {
        risk_score += 35;
        signals.push("admin-entry".to_string());
        if let Some(candidate) = admin_candidates
            .iter()
            .find(|candidate| candidate.login_likely || matches!(candidate.status, 200 | 401 | 403))
        {
            evidence.push(format!(
                "Admin candidate {} returned {}{}",
                candidate.path,
                candidate.status,
                candidate
                    .title
                    .as_ref()
                    .map(|title| format!(" ({title})"))
                    .unwrap_or_default()
            ));
        }
    }

    if has_api_auth_hint {
        risk_score += 20;
        signals.push("auth-api".to_string());
        if let Some(candidate) = api_candidates.iter().find(|candidate| endpoint_looks_like_auth(candidate))
        {
            evidence.push(format!(
                "Authentication API hint {} from {}",
                candidate.path, candidate.source
            ));
        }
    }

    if text_contains_any(&auth_text, &["captcha", "verify code", "verification code", "验证码"]) {
        risk_score += 8;
        signals.push("captcha-present".to_string());
        evidence.push("Captcha or verification-code marker found around authentication surface".to_string());
    }

    if text_contains_any(&auth_text, &["merchant", "agent", "member", "代理", "商户", "会员"]) {
        risk_score += 8;
        signals.push("business-auth".to_string());
        evidence.push("Business login marker found: merchant/agent/member style authentication".to_string());
    }

    if text_contains_any(&auth_text, &["token", "session", "jwt", "oauth", "passport", "sso"]) {
        risk_score += 6;
        if !signals.iter().any(|signal| signal == "session-token") {
            signals.push("session-token".to_string());
        }
    }

    if [has_login_form, has_admin_entry, has_api_auth_hint]
        .into_iter()
        .filter(|hit| *hit)
        .count()
        >= 2
    {
        risk_score += 10;
        signals.push("multi-surface".to_string());
    }

    let risk_level = if risk_score >= 80 {
        "high"
    } else if risk_score >= 45 {
        "medium"
    } else if risk_score > 0 {
        "low"
    } else {
        "none"
    }
    .to_string();

    let has_auth_surface = has_login_form || has_admin_entry || has_api_auth_hint;
    let suggested_next_step = if has_auth_surface {
        "Capture the exposed authentication evidence and only move to credential verification with explicit authorization.".to_string()
    } else {
        "No obvious authentication surface detected from this public pass.".to_string()
    };

    WebReconAuthSurface {
        has_auth_surface,
        has_login_form,
        has_admin_entry,
        has_api_auth_hint,
        risk_level,
        risk_score: risk_score.min(100),
        signals,
        evidence,
        suggested_next_step,
    }
}

fn murmurhash3_32(data: &[u8], seed: u32) -> i32 {
    let c1: u32 = 0xcc9e2d51;
    let c2: u32 = 0x1b873593;
    let mut h1 = seed;

    let mut chunks = data.chunks_exact(4);
    for chunk in &mut chunks {
        let mut k1 = u32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
        k1 = k1.wrapping_mul(c1);
        k1 = k1.rotate_left(15);
        k1 = k1.wrapping_mul(c2);

        h1 ^= k1;
        h1 = h1.rotate_left(13);
        h1 = h1.wrapping_mul(5).wrapping_add(0xe654_6b64);
    }

    let tail = chunks.remainder();
    let mut k1 = 0u32;

    match tail.len() {
        3 => {
            k1 ^= (tail[2] as u32) << 16;
            k1 ^= (tail[1] as u32) << 8;
            k1 ^= tail[0] as u32;
        }
        2 => {
            k1 ^= (tail[1] as u32) << 8;
            k1 ^= tail[0] as u32;
        }
        1 => {
            k1 ^= tail[0] as u32;
        }
        _ => {}
    }

    if !tail.is_empty() {
        k1 = k1.wrapping_mul(c1);
        k1 = k1.rotate_left(15);
        k1 = k1.wrapping_mul(c2);
        h1 ^= k1;
    }

    h1 ^= data.len() as u32;
    h1 ^= h1 >> 16;
    h1 = h1.wrapping_mul(0x85eb_ca6b);
    h1 ^= h1 >> 13;
    h1 = h1.wrapping_mul(0xc2b2_ae35);
    h1 ^= h1 >> 16;

    h1 as i32
}

fn fetch_favicon_fingerprint(
    client: &Client,
    favicon_url: &Url,
    allow_private_targets: bool,
    timeout: Duration,
) -> Result<(Option<String>, Option<String>, Option<i32>), String> {
    let observation = fetch_with_redirects(
        client,
        favicon_url.clone(),
        allow_private_targets,
        timeout,
        DEFAULT_ICON_BODY_LIMIT,
    )?;

    let bytes = observation.body;
    if bytes.is_empty() || observation.status >= 400 {
        return Ok((Some(observation.final_url.to_string()), None, None));
    }

    let md5_hash = format!("{:x}", md5::compute(&bytes));
    let encoded = BASE64_STANDARD.encode(&bytes);
    let mmh3 = murmurhash3_32(encoded.as_bytes(), 0);
    Ok((
        Some(observation.final_url.to_string()),
        Some(md5_hash),
        Some(mmh3),
    ))
}

fn get_ip_location_hint(ip: &str) -> Option<(&'static str, &'static str, &'static str, &'static str)> {
    match ip {
        "114.67.219.167" => Some(("中国", "广东省", "广州市", "京东云")),
        _ => None,
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct IpApiResponse {
    status: String,
    country: Option<String>,
    region_name: Option<String>,
    city: Option<String>,
    isp: Option<String>,
    org: Option<String>,
    #[serde(rename = "as")]
    asn: Option<String>,
    asname: Option<String>,
    query: Option<String>,
    message: Option<String>,
}

fn lookup_ip_intelligence(client: &Client, ip: &str, timeout: Duration) -> WebReconIpIntelligence {
    if let Some((country, region, city, provider)) = get_ip_location_hint(ip) {
        return WebReconIpIntelligence {
            ip: ip.to_string(),
            country: Some(country.to_string()),
            region: Some(region.to_string()),
            city: Some(city.to_string()),
            isp: Some(provider.to_string()),
            organization: Some(provider.to_string()),
            asn: None,
            as_name: None,
            source: "builtin".to_string(),
            error: None,
        };
    }

    let url = format!("http://ip-api.com/json/{ip}?fields=status,country,regionName,city,isp,org,as,asname,query,message");
    let response = client.get(url).timeout(timeout).send();
    match response {
        Ok(resp) => match resp.json::<IpApiResponse>() {
            Ok(data) if data.status.eq_ignore_ascii_case("success") => WebReconIpIntelligence {
                ip: data.query.unwrap_or_else(|| ip.to_string()),
                country: data.country,
                region: data.region_name,
                city: data.city,
                isp: data.isp,
                organization: data.org,
                asn: data.asn,
                as_name: data.asname,
                source: "ip-api".to_string(),
                error: None,
            },
            Ok(data) => WebReconIpIntelligence {
                ip: ip.to_string(),
                country: None,
                region: None,
                city: None,
                isp: None,
                organization: None,
                asn: None,
                as_name: None,
                source: "ip-api".to_string(),
                error: data.message.or_else(|| Some("ip-api lookup failed".to_string())),
            },
            Err(err) => WebReconIpIntelligence {
                ip: ip.to_string(),
                country: None,
                region: None,
                city: None,
                isp: None,
                organization: None,
                asn: None,
                as_name: None,
                source: "ip-api".to_string(),
                error: Some(err.to_string()),
            },
        },
        Err(err) => WebReconIpIntelligence {
            ip: ip.to_string(),
            country: None,
            region: None,
            city: None,
            isp: None,
            organization: None,
            asn: None,
            as_name: None,
            source: "ip-api".to_string(),
            error: Some(err.to_string()),
        },
    }
}

fn collect_dns_records(client: &Client, host: &str, timeout: Duration) -> Vec<WebReconDnsRecord> {
    let host = normalize_host(host);
    if host.is_empty() || host.parse::<IpAddr>().is_ok() {
        return Vec::new();
    }

    let mut records = Vec::new();
    let mut seen = HashSet::new();

    for record_type in DNS_RECORD_TYPES {
        let response = client
            .get("https://dns.google/resolve")
            .query(&[("name", host.as_str()), ("type", *record_type)])
            .timeout(timeout)
            .send();

        let Ok(response) = response else {
            continue;
        };
        if !response.status().is_success() {
            continue;
        }
        let Ok(json) = response.json::<Value>() else {
            continue;
        };
        let Some(answers) = json.get("Answer").and_then(|value| value.as_array()) else {
            continue;
        };

        for answer in answers {
            let name = answer
                .get("name")
                .and_then(|value| value.as_str())
                .map(trim_value)
                .unwrap_or_else(|| host.clone());
            let value = answer
                .get("data")
                .and_then(|value| value.as_str())
                .map(trim_value)
                .unwrap_or_default();
            if value.is_empty() {
                continue;
            }
            let ttl = answer
                .get("TTL")
                .and_then(|value| value.as_u64())
                .and_then(|value| u32::try_from(value).ok());
            let key = format!(
                "{}|{}|{}",
                record_type,
                name.to_lowercase(),
                value.to_lowercase()
            );
            if seen.insert(key) {
                records.push(WebReconDnsRecord {
                    record_type: (*record_type).to_string(),
                    name,
                    value,
                    ttl,
                });
            }
        }
    }

    records
}

fn rdap_lookup(
    client: &Client,
    host: &str,
    allow_private_targets: bool,
    timeout: Duration,
) -> Result<Option<WebReconRdapRecord>, String> {
    let lookup_target = normalize_host(host);
    if lookup_target.is_empty() {
        return Ok(None);
    }

    let lookup_url = if lookup_target.parse::<IpAddr>().is_ok() {
        format!("https://rdap.org/ip/{lookup_target}")
    } else {
        format!("https://rdap.org/domain/{lookup_target}")
    };

    let response = client
        .get(&lookup_url)
        .timeout(timeout)
        .send()
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Ok(None);
    }

    let json: Value = response.json().map_err(|e| e.to_string())?;
    let mut record = WebReconRdapRecord {
        lookup_url,
        handle: json
            .get("handle")
            .and_then(|value| value.as_str())
            .map(trim_value),
        name: json
            .get("name")
            .and_then(|value| value.as_str())
            .map(trim_value),
        registrar: None,
        organization: None,
        country: json
            .get("country")
            .and_then(|value| value.as_str())
            .map(trim_value),
        start_address: json
            .get("startAddress")
            .and_then(|value| value.as_str())
            .map(trim_value),
        end_address: json
            .get("endAddress")
            .and_then(|value| value.as_str())
            .map(trim_value),
        nameservers: Vec::new(),
        created: None,
        updated: None,
        expires: None,
    };

    if let Some(nameservers) = json.get("nameservers").and_then(|value| value.as_array()) {
        let mut seen = HashSet::new();
        for nameserver in nameservers {
            let candidate = nameserver
                .get("ldhName")
                .or_else(|| nameserver.get("unicodeName"))
                .and_then(|value| value.as_str())
                .map(trim_value)
                .unwrap_or_default();
            if !candidate.is_empty() && seen.insert(candidate.clone()) {
                record.nameservers.push(candidate);
            }
        }
    }

    if let Some(events) = json.get("events").and_then(|value| value.as_array()) {
        for event in events {
            let action = event
                .get("eventAction")
                .and_then(|value| value.as_str())
                .unwrap_or("")
                .to_lowercase();
            let date = event
                .get("eventDate")
                .and_then(|value| value.as_str())
                .map(trim_value);
            match action.as_str() {
                "registration" | "registered" if record.created.is_none() => record.created = date,
                "last changed" | "last update of rdap database" | "changed"
                    if record.updated.is_none() =>
                {
                    record.updated = date
                }
                "expiration" | "expires" if record.expires.is_none() => record.expires = date,
                _ => {}
            }
        }
    }

    if let Some(entities) = json.get("entities").and_then(|value| value.as_array()) {
        for entity in entities {
            let roles = entity
                .get("roles")
                .and_then(|value| value.as_array())
                .map(|items| {
                    items
                        .iter()
                        .filter_map(|value| value.as_str())
                        .map(|value| value.to_lowercase())
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            let label = rdap_entity_label(entity);
            if roles.iter().any(|role| role.contains("registrar")) {
                if record.registrar.is_none() {
                    record.registrar = label.clone();
                }
            }
            if roles.iter().any(|role| role.contains("sponsoring")) && record.registrar.is_none() {
                record.registrar = label.clone();
            }
            if record.organization.is_none() {
                record.organization = label;
            }
        }
    }

    if record.registrar.is_none()
        && !allow_private_targets
        && lookup_target.parse::<IpAddr>().is_ok()
    {
        record.registrar = record.name.clone();
    }

    Ok(Some(record))
}

fn rdap_entity_label(entity: &Value) -> Option<String> {
    if let Some(handle) = entity.get("handle").and_then(|value| value.as_str()) {
        let handle = trim_value(handle);
        if !handle.is_empty() {
            return Some(handle);
        }
    }

    let vcard = entity
        .get("vcardArray")
        .and_then(|value| value.as_array())
        .and_then(|array| array.get(1))
        .and_then(|value| value.as_array())?;

    for field in vcard {
        let items = field.as_array()?;
        let key = items.get(0)?.as_str()?;
        if key == "fn" || key == "org" {
            if let Some(value) = items.get(3).and_then(|value| value.as_str()) {
                let value = trim_value(value);
                if !value.is_empty() {
                    return Some(value);
                }
            }
        }
    }

    None
}

fn tech_counts(items: &[WebReconTargetReport]) -> Vec<WebReconTechCount> {
    let mut counts: HashMap<String, usize> = HashMap::new();
    for item in items {
        for tech in &item.tech_stack {
            *counts.entry(tech.clone()).or_insert(0) += 1;
        }
    }

    let mut items: Vec<WebReconTechCount> = counts
        .into_iter()
        .map(|(tech, count)| WebReconTechCount { tech, count })
        .collect();

    items.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.tech.cmp(&b.tech)));
    items
}

fn build_correlation_clusters(items: &[WebReconTargetReport]) -> Vec<WebReconCorrelationCluster> {
    let mut buckets: HashMap<String, ClusterAccumulator> = HashMap::new();

    let mut add_member = |cluster_type: &str,
                          value: String,
                          label: String,
                          confidence: f32,
                          target: &str,
                          evidence: String| {
        let key = format!("{}|{}", cluster_type, value.to_lowercase());
        let bucket = buckets.entry(key).or_insert_with(|| ClusterAccumulator {
            cluster_type: cluster_type.to_string(),
            value: value.clone(),
            label,
            confidence,
            targets: HashSet::new(),
            evidence: Vec::new(),
        });
        bucket.targets.insert(target.to_string());
        if !bucket.evidence.iter().any(|item| item == &evidence) {
            bucket.evidence.push(evidence);
        }
    };

    for item in items {
        for ip in &item.resolved_ips {
            add_member(
                "shared-ip",
                ip.clone(),
                format!("Shared IP {ip}"),
                0.66,
                &item.target,
                format!("Resolved IP {ip}"),
            );
        }

        if let Some(hash) = item.favicon_mmh3 {
            add_member(
                "shared-favicon",
                hash.to_string(),
                format!("Shared favicon mmh3 {hash}"),
                0.84,
                &item.target,
                format!("favicon mmh3 {hash}"),
            );
        }

        if let Some(cert) = item
            .tls_certificate
            .as_ref()
            .and_then(|cert| cert.sha256.clone())
        {
            add_member(
                "shared-tls-cert",
                cert.clone(),
                format!("Shared TLS certificate {}", truncate_text(cert.clone(), 18)),
                0.92,
                &item.target,
                "Same leaf certificate fingerprint".to_string(),
            );
        }

        if let Some(registrar) = item
            .rdap
            .as_ref()
            .and_then(|rdap| rdap.registrar.clone().or(rdap.organization.clone()))
            .map(|value| trim_value(&value))
            .filter(|value| !value.is_empty())
        {
            add_member(
                "shared-registrar",
                registrar.clone(),
                format!("Shared registrar {registrar}"),
                0.45,
                &item.target,
                format!("RDAP registrar {registrar}"),
            );
        }

        for external in item
            .external_hosts
            .iter()
            .filter(|host| matches!(host.category.as_str(), "contact" | "payment" | "auth"))
        {
            add_member(
                "shared-external-service",
                external.host.clone(),
                format!("Shared {} host {}", external.category, external.host),
                0.58,
                &item.target,
                format!("External {} host {}", external.category, external.host),
            );
        }
    }

    let mut clusters = buckets
        .into_values()
        .filter_map(|bucket| {
            if bucket.targets.len() < 2 {
                return None;
            }

            let mut targets = bucket.targets.into_iter().collect::<Vec<_>>();
            targets.sort();
            let mut evidence = bucket.evidence;
            evidence.sort();
            evidence.truncate(6);

            Some(WebReconCorrelationCluster {
                cluster_type: bucket.cluster_type,
                value: bucket.value,
                label: bucket.label,
                confidence: bucket.confidence,
                targets,
                evidence,
            })
        })
        .collect::<Vec<_>>();

    clusters.sort_by(|a, b| {
        b.targets
            .len()
            .cmp(&a.targets.len())
            .then_with(|| {
                b.confidence
                    .partial_cmp(&a.confidence)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| a.label.cmp(&b.label))
    });
    clusters
}

fn summarize_report(report: &mut WebReconTargetReport) {
    if let Some(final_url) = &report.final_url {
        if !report.redirect_chain.is_empty() && report.redirect_chain.len() > 1 {
            report.notes.push(format!(
                "Redirect chain: {}",
                report.redirect_chain.join(" -> ")
            ));
        }
        if final_url != &report.normalized_url {
            report.notes.push(format!("Final URL: {}", final_url));
        }
    }

    if let Some(server) = &report.server_header {
        report.notes.push(format!("Server: {server}"));
    }
    if let Some(powered_by) = &report.powered_by {
        report.notes.push(format!("Powered-By: {powered_by}"));
    }
    if let Some(registrar) = report
        .rdap
        .as_ref()
        .and_then(|rdap| rdap.registrar.clone().or(rdap.organization.clone()))
    {
        report.notes.push(format!("RDAP: {registrar}"));
    }
    if let Some(cert) = &report.tls_certificate {
        if let Some(common_name) = &cert.common_name {
            report.notes.push(format!("TLS CN: {common_name}"));
        }
        if let Some(issuer) = &cert.issuer_organization {
            report.notes.push(format!("TLS issuer: {issuer}"));
        }
    }
    if !report.forms.is_empty() {
        report
            .notes
            .push(format!("Forms detected: {}", report.forms.len()));
    }
    if !report.admin_candidates.is_empty() {
        report.notes.push(format!(
            "Admin candidates: {}",
            report.admin_candidates.len()
        ));
    }
    if !report.api_candidates.is_empty() {
        report
            .notes
            .push(format!("API candidates: {}", report.api_candidates.len()));
    }
    if !report.dns_records.is_empty() {
        let dns_summary = report
            .dns_records
            .iter()
            .take(8)
            .map(|record| format!("{}={}", record.record_type, record.value))
            .collect::<Vec<_>>()
            .join(", ");
        report.notes.push(format!("DNS: {dns_summary}"));
    }
    if report.business_profile.category != "unknown" {
        report.notes.push(format!(
            "Business profile: {} ({:.0}%)",
            report.business_profile.category,
            report.business_profile.confidence * 100.0
        ));
    }
    if !report.credential_signals.is_empty() {
        report.notes.push(format!(
            "Credential surfaces flagged: {} (no password attempts performed)",
            report.credential_signals.len()
        ));
    }
    if !report.path_hints.is_empty() {
        report
            .notes
            .push(format!("Path hints: {}", report.path_hints.join(", ")));
    }
    if !report.artifact_findings.is_empty() {
        report.notes.push(format!(
            "Artifacts: {}",
            report
                .artifact_findings
                .iter()
                .map(|item| item.artifact_type.clone())
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }
    if !report.external_hosts.is_empty() {
        report.notes.push(format!(
            "External hosts: {}",
            report
                .external_hosts
                .iter()
                .map(|item| format!("{}[{}]", item.host, item.category))
                .collect::<Vec<_>>()
                .join(", ")
        ));
    }
    if let Some(hash) = report.favicon_mmh3 {
        report.notes.push(format!("Favicon mmh3: {hash}"));
    }
}

fn combine_ips(mut first: Vec<IpAddr>, second: Vec<IpAddr>) -> Vec<IpAddr> {
    let mut seen: HashSet<IpAddr> = first.iter().cloned().collect();
    for ip in second {
        if seen.insert(ip) {
            first.push(ip);
        }
    }
    first
}

fn process_target(
    client: &Client,
    input: &str,
    probe_admin_paths: bool,
    allow_private_targets: bool,
    timeout: Duration,
    max_probe_paths: usize,
) -> WebReconTargetReport {
    let trimmed = input.trim().to_string();
    let candidate_urls = build_candidate_urls(&trimmed);
    let mut report = WebReconTargetReport {
        target: trimmed.clone(),
        lookup_host: String::new(),
        normalized_url: candidate_urls
            .first()
            .map(|url| url.to_string())
            .unwrap_or_else(|| trimmed.clone()),
        final_url: None,
        redirect_chain: Vec::new(),
        status: None,
        blocked: false,
        error: None,
        resolved_ips: Vec::new(),
        ip_intelligence: Vec::new(),
        rdap: None,
        dns_records: Vec::new(),
        server_header: None,
        powered_by: None,
        content_type: None,
        security_headers: Vec::new(),
        title: None,
        meta_description: None,
        generator: None,
        favicon_url: None,
        favicon_md5: None,
        favicon_mmh3: None,
        tech_stack: Vec::new(),
        tls_certificate: None,
        artifact_findings: Vec::new(),
        external_hosts: Vec::new(),
        path_hints: Vec::new(),
        admin_candidates: Vec::new(),
        api_candidates: Vec::new(),
        forms: Vec::new(),
        business_profile: default_business_profile(),
        architecture: default_architecture_profile(),
        auth_surface: default_auth_surface(),
        credential_signals: Vec::new(),
        site_kind: "unknown".to_string(),
        notes: Vec::new(),
    };

    let Some(first_candidate) = candidate_urls.first().cloned() else {
        report.error = Some("Target is empty or invalid".to_string());
        return report;
    };

    let lookup_host = first_candidate
        .host_str()
        .map(normalize_host)
        .unwrap_or_default();
    report.lookup_host = lookup_host.clone();

    if lookup_host.is_empty() {
        report.error = Some("Target has no host".to_string());
        return report;
    }

    let resolved_ips = match resolve_host_ips(
        &lookup_host,
        host_port_for_url(&first_candidate),
        allow_private_targets,
    ) {
        Ok(ips) => ips,
        Err(err) => {
            report.blocked = !allow_private_targets;
            report.error = Some(err);
            return report;
        }
    };
    report.resolved_ips = resolved_ips.iter().map(|ip| ip.to_string()).collect();

    let ip_lookup_timeout = Duration::from_millis((timeout.as_millis() as u64).clamp(1_500, 4_000));
    report.ip_intelligence = report
        .resolved_ips
        .iter()
        .take(4)
        .map(|ip| lookup_ip_intelligence(client, ip, ip_lookup_timeout))
        .collect();

    let rdap_timeout = Duration::from_millis((timeout.as_millis() as u64).clamp(3_000, 8_000));
    report.rdap =
        rdap_lookup(client, &lookup_host, allow_private_targets, rdap_timeout).unwrap_or(None);
    report.dns_records = collect_dns_records(client, &lookup_host, rdap_timeout);

    let mut observation = None;
    let mut last_error = None;
    for candidate in candidate_urls {
        match fetch_with_redirects(
            client,
            candidate.clone(),
            allow_private_targets,
            timeout,
            DEFAULT_HOME_BODY_LIMIT,
        ) {
            Ok(result) => {
                observation = Some((candidate, result));
                break;
            }
            Err(err) => {
                last_error = Some(err);
            }
        }
    }

    let Some((candidate_url, home)) = observation else {
        report.error = last_error.or_else(|| Some("Failed to fetch target".to_string()));
        return report;
    };

    report.normalized_url = candidate_url.to_string();
    report.final_url = Some(home.final_url.to_string());
    report.redirect_chain = home.redirect_chain.clone();
    report.status = Some(home.status);
    report.server_header = home.snapshot.server.clone();
    report.powered_by = home.snapshot.powered_by.clone();
    report.content_type = home.snapshot.content_type.clone();
    report.security_headers = security_headers(&home.snapshot);

    let body_text = String::from_utf8_lossy(&home.body).into_owned();
    report.title = title_from_body(&body_text);
    report.meta_description = extract_meta_content(&body_text, "description");
    report.generator = extract_meta_content(&body_text, "generator");
    report.external_hosts = collect_external_hosts(&body_text, &home.final_url);
    report.tls_certificate = fetch_tls_certificate(
        &home.final_url,
        Duration::from_millis(DEFAULT_PROBE_TIMEOUT_MS),
    )
    .unwrap_or(None);

    let final_url = home.final_url.clone();
    let final_host = final_url.host_str().map(normalize_host).unwrap_or_default();
    if !final_host.is_empty() && final_host != lookup_host {
        if let Ok(mut more_ips) = resolve_host_ips(
            &final_host,
            host_port_for_url(&final_url),
            allow_private_targets,
        ) {
            let existing: Vec<IpAddr> = report
                .resolved_ips
                .iter()
                .filter_map(|value| value.parse::<IpAddr>().ok())
                .collect();
            let combined = combine_ips(existing, more_ips.split_off(0));
            report.resolved_ips = combined.into_iter().map(|ip| ip.to_string()).collect();
            let known_ips: HashSet<String> = report
                .ip_intelligence
                .iter()
                .map(|item| item.ip.clone())
                .collect();
            let mut additional = report
                .resolved_ips
                .iter()
                .filter(|ip| !known_ips.contains(*ip))
                .take(4)
                .map(|ip| lookup_ip_intelligence(client, ip, ip_lookup_timeout))
                .collect::<Vec<_>>();
            report.ip_intelligence.append(&mut additional);
        }
    }

    let mut tech_stack = detect_tech_stack(&body_text, &home.snapshot, &final_url);
    let forms = extract_forms(&body_text, &final_url);
    let manifest_url = extract_manifest_url(&body_text, &final_url);
    let robots_url = final_url.join("/robots.txt").ok();
    let sitemap_url = final_url.join("/sitemap.xml").ok();
    let robots_body = robots_url.as_ref().and_then(|url| {
        fetch_with_redirects(
            client,
            url.clone(),
            allow_private_targets,
            Duration::from_millis(DEFAULT_PROBE_TIMEOUT_MS),
            DEFAULT_SMALL_BODY_LIMIT,
        )
        .ok()
        .and_then(|obs| {
            if obs.status < 400 {
                Some(String::from_utf8_lossy(&obs.body).into_owned())
            } else {
                None
            }
        })
    });
    let sitemap_body = sitemap_url.as_ref().and_then(|url| {
        fetch_with_redirects(
            client,
            url.clone(),
            allow_private_targets,
            Duration::from_millis(DEFAULT_PROBE_TIMEOUT_MS),
            DEFAULT_SMALL_BODY_LIMIT,
        )
        .ok()
        .and_then(|obs| {
            if obs.status < 400 {
                Some(String::from_utf8_lossy(&obs.body).into_owned())
            } else {
                None
            }
        })
    });

    let mut path_hints = build_path_hints(
        &final_url,
        &body_text,
        &forms,
        robots_body.as_deref(),
        sitemap_body.as_deref(),
    );
    let js_hints = collect_js_path_hints(
        client,
        &final_url,
        &body_text,
        allow_private_targets,
        Duration::from_millis(DEFAULT_PROBE_TIMEOUT_MS),
    );
    merge_path_hints(&mut path_hints, js_hints, 80);
    let (artifact_findings, artifact_hints) = probe_standard_artifacts(
        client,
        &final_url,
        manifest_url.as_deref(),
        allow_private_targets,
        Duration::from_millis(DEFAULT_PROBE_TIMEOUT_MS),
    );
    merge_path_hints(&mut path_hints, artifact_hints, 80);
    report.artifact_findings = artifact_findings;
    report.path_hints = path_hints.clone();
    report.api_candidates = build_api_candidates(&path_hints);

    let probe_timeout = Duration::from_millis(DEFAULT_PROBE_TIMEOUT_MS);

    if probe_admin_paths {
        let path_candidates = probe_path_candidates(&path_hints);
        let mut candidates = Vec::new();
        let mut seen = HashSet::new();

        for (path, source) in path_candidates {
            if seen.insert(path.clone()) {
                candidates.push((path, source));
            }
            if candidates.len() >= max_probe_paths {
                break;
            }
        }

        let mut findings = Vec::new();
        for (path, source) in candidates {
            let probe_url = match final_url.join(&path) {
                Ok(url) => url,
                Err(_) => continue,
            };
            match fetch_with_redirects(
                client,
                probe_url.clone(),
                allow_private_targets,
                probe_timeout,
                DEFAULT_SMALL_BODY_LIMIT,
            ) {
                Ok(obs) => {
                    if obs.status == 404 || obs.status == 410 {
                        continue;
                    }
                    let probe_body = String::from_utf8_lossy(&obs.body).into_owned();
                    let probe_title = title_from_body(&probe_body);
                    let snippet = {
                        let text = truncate_text(strip_html_tags(&probe_body), 180);
                        if text.is_empty() {
                            None
                        } else {
                            Some(text)
                        }
                    };
                    let lower = format!(
                        "{} {} {} {}",
                        path,
                        probe_title.clone().unwrap_or_default(),
                        snippet.clone().unwrap_or_default(),
                        probe_body.to_lowercase()
                    );
                    let login_likely = ADMIN_KEYWORDS.iter().any(|keyword| lower.contains(keyword));
                    findings.push(WebReconPathFinding {
                        path,
                        source,
                        status: obs.status,
                        title: probe_title,
                        login_likely,
                        redirect_url: (obs.final_url != probe_url)
                            .then(|| obs.final_url.to_string()),
                        snippet,
                    });
                }
                Err(_) => {}
            }
        }
        report.admin_candidates = findings;
    }

    let body_lower = body_text.to_lowercase();
    let has_login_form = forms.iter().any(|form| form.login_likely);
    if has_login_form {
        tech_stack.push("Login Form".to_string());
    }
    report.forms = forms;
    report.tech_stack = {
        let mut seen = HashSet::new();
        let mut ordered = Vec::new();
        for tech in tech_stack {
            if seen.insert(tech.to_lowercase()) {
                ordered.push(tech);
            }
        }
        ordered
    };

    report.site_kind = classify_site_kind(
        report.status,
        report.title.as_deref(),
        &body_text,
        &report.forms,
        &report.admin_candidates,
        &report.tech_stack,
        report.content_type.as_deref(),
    );

    report.business_profile = build_business_profile(
        report.title.as_deref(),
        report.meta_description.as_deref(),
        &body_text,
        &report.forms,
        &report.path_hints,
        &report.admin_candidates,
        &report.external_hosts,
    );
    report.architecture = build_architecture_profile(
        &home.snapshot,
        &report.tech_stack,
        &report.dns_records,
        &report.path_hints,
        &body_text,
        &report.external_hosts,
    );
    report.auth_surface = build_auth_surface(
        &report.forms,
        &report.admin_candidates,
        &report.api_candidates,
    );
    report.credential_signals =
        build_credential_signals(&report.forms, &report.admin_candidates, &report.tech_stack);

    if report.favicon_url.is_none() {
        if let Some(icon_href) = extract_icon_url(&body_text, &final_url) {
            if let Ok(icon_url) = Url::parse(&icon_href) {
                if let Ok((url, md5_hash, mmh3)) = fetch_favicon_fingerprint(
                    client,
                    &icon_url,
                    allow_private_targets,
                    probe_timeout,
                ) {
                    report.favicon_url = url;
                    report.favicon_md5 = md5_hash;
                    report.favicon_mmh3 = mmh3;
                }
            }
        }
    }

    if report.favicon_url.is_none() {
        if let Ok(default_favicon) = final_url.join("/favicon.ico") {
            if let Ok((url, md5_hash, mmh3)) = fetch_favicon_fingerprint(
                client,
                &default_favicon,
                allow_private_targets,
                probe_timeout,
            ) {
                report.favicon_url = url;
                report.favicon_md5 = md5_hash;
                report.favicon_mmh3 = mmh3;
            }
        }
    }

    summarize_report(&mut report);
    if report.error.is_none() && report.status.is_none() {
        report.error = Some("Target responded without a usable HTTP status".to_string());
    }

    if report
        .rdap
        .as_ref()
        .and_then(|rdap| rdap.registrar.clone())
        .is_none()
        && report
            .rdap
            .as_ref()
            .and_then(|rdap| rdap.organization.clone())
            .is_none()
    {
        if !lookup_host.is_empty() {
            report
                .notes
                .push(format!("RDAP lookup host: {lookup_host}"));
        }
    }

    if body_lower.contains("security")
        && !report
            .tech_stack
            .iter()
            .any(|tech| tech.eq_ignore_ascii_case("Login Form"))
    {
        report
            .notes
            .push("Security-related page markers found".to_string());
    }

    report
}

#[tauri::command]
pub async fn web_recon_batch(
    app: AppHandle,
    targets: Vec<String>,
    probe_admin_paths: Option<bool>,
    allow_private_targets: Option<bool>,
    timeout_ms: Option<u64>,
    max_probe_paths: Option<u32>,
    task_id: Option<String>,
) -> Result<WebReconBatchResult, String> {
    ensure_license_valid_async().await?;

    let probe_admin_paths = probe_admin_paths.unwrap_or(false);
    let allow_private_targets = allow_private_targets.unwrap_or(false);
    let timeout = Duration::from_millis(
        timeout_ms
            .unwrap_or(DEFAULT_HOME_TIMEOUT_MS)
            .clamp(3_000, 30_000),
    );
    let max_probe_paths = max_probe_paths.unwrap_or(12).clamp(1, 40) as usize;
    let total_targets = targets.len();
    let task_id = task_id.unwrap_or_else(|| "default".to_string());

    let results = tauri::async_runtime::spawn_blocking(move || {
        let mut items = Vec::new();
        let emit_progress = |stage: &str,
                             current: usize,
                             target: Option<String>,
                             message: String,
                             items: &Vec<WebReconTargetReport>| {
            let _ = app.emit(
                "web_recon_progress",
                WebReconProgressEvent {
                    task_id: task_id.clone(),
                    current,
                    total: total_targets,
                    target,
                    stage: stage.to_string(),
                    message,
                    reachable: items.iter().filter(|item| item.status.is_some()).count(),
                    admin_candidates: items.iter().map(|item| item.admin_candidates.len()).sum(),
                    api_candidates: items.iter().map(|item| item.api_candidates.len()).sum(),
                    credential_surfaces: items.iter().map(|item| item.credential_signals.len()).sum(),
                },
            );
        };

        emit_progress(
            "queued",
            0,
            None,
            format!("Queued {total_targets} targets for remote reconnaissance"),
            &items,
        );

        let client = Client::builder()
            .timeout(timeout)
            .redirect(reqwest::redirect::Policy::none())
            .danger_accept_invalid_certs(false)
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) FUXI-Recon/1.0")
            .build()
            .map_err(|e| e.to_string())?;

        for (index, target) in targets.into_iter().enumerate() {
            emit_progress(
                "probing",
                index,
                Some(target.clone()),
                format!(
                    "Collecting {target}: DNS/RDAP/IP, homepage headers, TLS certificate, robots/sitemap, admin/API candidates and external services"
                ),
                &items,
            );
            let report = process_target(
                &client,
                &target,
                probe_admin_paths,
                allow_private_targets,
                timeout,
                max_probe_paths,
            );
            let stage = if report.blocked || report.error.is_some() {
                "target_error"
            } else {
                "target_done"
            };
            let message = if let Some(error) = &report.error {
                format!("Target {} of {total_targets} failed: {error}", index + 1)
            } else if report.blocked {
                format!("Target {} of {total_targets} was blocked by scope or safety checks", index + 1)
            } else {
                format!(
                    "Finished target {} of {total_targets}: HTTP {}, admin {}, API {}, external hosts {}",
                    index + 1,
                    report
                        .status
                        .map(|status| status.to_string())
                        .unwrap_or_else(|| "-".to_string()),
                    report.admin_candidates.len(),
                    report.api_candidates.len(),
                    report.external_hosts.len()
                )
            };
            items.push(report);
            emit_progress(
                stage,
                index + 1,
                Some(target),
                message,
                &items,
            );
        }

        emit_progress(
            "correlating",
            total_targets,
            None,
            "Correlating favicon, certificate, registrar, IP and technology clues".to_string(),
            &items,
        );

        let clusters = build_correlation_clusters(&items);
        let stats = WebReconBatchStats {
            total: items.len(),
            reachable: items.iter().filter(|item| item.status.is_some()).count(),
            blocked: items.iter().filter(|item| item.blocked).count(),
            login_pages: items
                .iter()
                .filter(|item| {
                    item.site_kind == "login-portal"
                        || item.forms.iter().any(|form| form.login_likely)
                })
                .count(),
            admin_candidates: items.iter().map(|item| item.admin_candidates.len()).sum(),
            api_candidates: items.iter().map(|item| item.api_candidates.len()).sum(),
            credential_surfaces: items.iter().map(|item| item.credential_signals.len()).sum(),
            high_risk_targets: items
                .iter()
                .filter(|item| item.auth_surface.risk_level == "high")
                .count(),
            related_clusters: clusters.len(),
            unique_techs: items
                .iter()
                .flat_map(|item| item.tech_stack.iter().cloned())
                .map(|tech| tech.to_lowercase())
                .collect::<HashSet<_>>()
                .len(),
            tech_counts: tech_counts(&items),
        };

        emit_progress(
            "done",
            total_targets,
            None,
            "Remote reconnaissance completed".to_string(),
            &items,
        );

        Ok::<WebReconBatchResult, String>(WebReconBatchResult {
            stats,
            clusters,
            items,
        })
    })
    .await
    .map_err(|e| e.to_string())?;

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_report(target: &str) -> WebReconTargetReport {
        WebReconTargetReport {
            target: target.to_string(),
            lookup_host: target.to_string(),
            normalized_url: format!("https://{target}"),
            final_url: Some(format!("https://{target}")),
            redirect_chain: Vec::new(),
            status: Some(200),
            blocked: false,
            error: None,
            resolved_ips: Vec::new(),
            rdap: None,
            dns_records: Vec::new(),
            server_header: None,
            powered_by: None,
            content_type: Some("text/html".to_string()),
            security_headers: Vec::new(),
            title: None,
            meta_description: None,
            generator: None,
            favicon_url: None,
            favicon_md5: None,
            favicon_mmh3: None,
            tech_stack: Vec::new(),
            tls_certificate: None,
            artifact_findings: Vec::new(),
            external_hosts: Vec::new(),
            path_hints: Vec::new(),
            admin_candidates: Vec::new(),
            api_candidates: Vec::new(),
            forms: Vec::new(),
            business_profile: default_business_profile(),
            architecture: default_architecture_profile(),
            auth_surface: default_auth_surface(),
            credential_signals: Vec::new(),
            site_kind: "unknown".to_string(),
            notes: Vec::new(),
        }
    }

    #[test]
    fn classify_external_host_detects_common_categories() {
        assert_eq!(
            classify_external_host("t.me", "https://t.me/foo"),
            "contact"
        );
        assert_eq!(
            classify_external_host("checkout.stripe.com", "https://checkout.stripe.com/pay"),
            "payment"
        );
        assert_eq!(
            classify_external_host(
                "www.google-analytics.com",
                "https://www.google-analytics.com/g/collect"
            ),
            "analytics"
        );
    }

    #[test]
    fn build_correlation_clusters_groups_shared_ip_and_favicon() {
        let mut first = make_report("alpha.example");
        first.resolved_ips = vec!["1.1.1.1".to_string()];
        first.favicon_mmh3 = Some(123456);

        let mut second = make_report("beta.example");
        second.resolved_ips = vec!["1.1.1.1".to_string()];
        second.favicon_mmh3 = Some(123456);

        let clusters = build_correlation_clusters(&[first, second]);
        assert!(clusters
            .iter()
            .any(|cluster| { cluster.cluster_type == "shared-ip" && cluster.targets.len() == 2 }));
        assert!(clusters.iter().any(|cluster| {
            cluster.cluster_type == "shared-favicon" && cluster.targets.len() == 2
        }));
    }

    #[test]
    fn build_auth_surface_marks_high_risk_login_and_admin_surfaces() {
        let forms = vec![WebReconFormFinding {
            action: "/auth/login".to_string(),
            method: "post".to_string(),
            fields: vec!["username".to_string(), "password".to_string()],
            has_password: true,
            login_likely: true,
        }];
        let admin_candidates = vec![WebReconPathFinding {
            path: "/admin/login".to_string(),
            source: "probe".to_string(),
            status: 200,
            title: Some("Admin Console".to_string()),
            login_likely: true,
            redirect_url: None,
            snippet: Some("please sign in".to_string()),
        }];
        let api_candidates = vec![WebReconEndpointFinding {
            path: "/api/auth/login".to_string(),
            source: "js".to_string(),
            endpoint_type: "auth".to_string(),
            status: Some(200),
            evidence: Some("auth token endpoint".to_string()),
        }];

        let auth_surface = build_auth_surface(&forms, &admin_candidates, &api_candidates);

        assert!(auth_surface.has_auth_surface);
        assert!(auth_surface.has_login_form);
        assert!(auth_surface.has_admin_entry);
        assert!(auth_surface.has_api_auth_hint);
        assert_eq!(auth_surface.risk_level, "high");
        assert!(auth_surface.risk_score >= 80);
        assert!(!auth_surface.signals.is_empty());
        assert!(!auth_surface.evidence.is_empty());
        assert!(auth_surface
            .suggested_next_step
            .contains("authorization"));
    }

    #[test]
    fn build_auth_surface_marks_sensitive_auth_api_and_captcha_signals() {
        let forms = vec![WebReconFormFinding {
            action: "/merchant/signin".to_string(),
            method: "post".to_string(),
            fields: vec!["mobile".to_string(), "pwd".to_string(), "captcha".to_string()],
            has_password: true,
            login_likely: true,
        }];
        let admin_candidates = vec![WebReconPathFinding {
            path: "/agent/console".to_string(),
            source: "path-hint".to_string(),
            status: 403,
            title: Some("Agent Console".to_string()),
            login_likely: true,
            redirect_url: None,
            snippet: Some("session expired".to_string()),
        }];
        let api_candidates = vec![WebReconEndpointFinding {
            path: "/api/merchant/session/token".to_string(),
            source: "javascript".to_string(),
            endpoint_type: "rest".to_string(),
            status: None,
            evidence: Some("captcha required before token exchange".to_string()),
        }];

        let auth_surface = build_auth_surface(&forms, &admin_candidates, &api_candidates);

        assert!(auth_surface.has_api_auth_hint);
        assert_eq!(auth_surface.risk_level, "high");
        assert!(auth_surface.signals.contains(&"captcha-present".to_string()));
        assert!(auth_surface.signals.contains(&"business-auth".to_string()));
        assert!(auth_surface
            .evidence
            .iter()
            .any(|item| item.to_lowercase().contains("captcha")));
    }
}
