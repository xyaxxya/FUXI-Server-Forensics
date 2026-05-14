import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "framer-motion";
import { FileUp, CheckCircle2, Upload } from "lucide-react";
import tauriLogo from "../assets/tauri.png";
import { APP_VERSION } from "../config/app";

interface LicenseStatus {
  valid: boolean;
  message: string;
  machine_code: string;
  expires_at?: number | null;
  nickname?: string | null;
  qq?: string | null;
  avatar?: string | null;
  license_plan?: string | null;
  license_label?: string | null;
}

interface LicenseGateProps {
  initialLicenseStatus?: LicenseStatus | null;
  onAuthorized: (status: LicenseStatus) => void;
}

export default function LicenseGate({ initialLicenseStatus = null, onAuthorized }: LicenseGateProps) {
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(initialLicenseStatus);
  const [licenseContent, setLicenseContent] = useState("");
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [loadedFileName, setLoadedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const formatExpires = (ts?: number | null) => {
    if (!ts) return "-";
    return new Date(ts * 1000).toLocaleDateString("zh-CN");
  };

  const avatarSrc =
    licenseStatus?.avatar && licenseStatus.avatar.trim().length > 0
      ? licenseStatus.avatar.startsWith("data:")
        ? licenseStatus.avatar
        : `data:image/png;base64,${licenseStatus.avatar}`
      : "";
  const normalizePlan = (rawPlan?: string | null) => {
    const plan = String(rawPlan || "").trim().toLowerCase();
    if (
      plan === "one_year" ||
      plan === "one-year" ||
      plan === "oneyear" ||
      plan === "1year" ||
      plan === "一年" ||
      plan === "一年套餐"
    ) {
      return "one_year";
    }
    if (
      plan === "half_year" ||
      plan === "half-year" ||
      plan === "halfyear" ||
      plan === "半年" ||
      plan === "半年套餐" ||
      plan === "6m"
    ) {
      return "half_year";
    }
    if (
      plan === "permanent" ||
      plan === "forever" ||
      plan === "lifetime" ||
      plan === "永久" ||
      plan === "永久套餐"
    ) {
      return "permanent";
    }
    return "thirty_days";
  };
  const normalizedPlan = normalizePlan(licenseStatus?.license_plan);
  const licenseTierClass = `license-tier-${normalizedPlan}`;
  const fallbackLabel =
    normalizedPlan === "permanent"
      ? "永久会员"
      : normalizedPlan === "one_year"
      ? "一年会员"
      : normalizedPlan === "half_year"
      ? "半年会员"
      : "30天会员";
  const planBadgeClass =
    normalizedPlan === "permanent"
      ? "bg-amber-100 text-amber-700 border border-amber-200"
      : normalizedPlan === "one_year"
      ? "bg-violet-100 text-violet-700 border border-violet-200"
      : normalizedPlan === "half_year"
      ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
      : "bg-sky-100 text-sky-700 border border-sky-200";
  const planCardClass =
    normalizedPlan === "permanent"
      ? "border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50"
      : normalizedPlan === "one_year"
      ? "border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50"
      : normalizedPlan === "half_year"
      ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50"
      : "border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50";

  const refreshStatus = async () => {
    const status = await invoke<LicenseStatus>("get_license_status");
    setLicenseStatus(status);
    if (status.valid) {
      onAuthorized(status);
    }
  };

  useEffect(() => {
    if (initialLicenseStatus?.valid) {
      onAuthorized(initialLicenseStatus);
      return;
    }
    refreshStatus().catch((e) => setError(e.toString()));
  }, []);

  const handleActivate = async () => {
    if (!licenseContent.trim()) {
      setError("请粘贴许可证内容");
      return;
    }
    setActivating(true);
    setError("");
    try {
      await invoke("activate_license", { licenseContent });
      setLicenseContent("");
      await refreshStatus();
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setActivating(false);
    }
  };

  const loadLicenseText = async (text: string, fileName?: string) => {
    const normalized = text.trim();
    if (!normalized) {
      setError("授权文件内容为空");
      return;
    }
    setLicenseContent(normalized);
    setLoadedFileName(fileName || "");
    setError("");
  };

  const handleLicenseFile = async (file: File | null | undefined) => {
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      await loadLicenseText(text, file.name);
    } catch (e: any) {
      setError(e?.toString?.() || "读取授权文件失败");
    }
  };

  const normalizeDroppedPath = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    if (trimmed.startsWith("file:///")) {
      try {
        return decodeURIComponent(trimmed.replace("file:///", "").replace(/\//g, "\\"));
      } catch {
        return trimmed.replace("file:///", "").replace(/\//g, "\\");
      }
    }
    return trimmed.replace(/^"+|"+$/g, "");
  };

  const readDroppedLicense = async (event: React.DragEvent<HTMLDivElement>) => {
    const directFile = event.dataTransfer.files?.[0] || event.dataTransfer.items?.[0]?.getAsFile?.();
    if (directFile) {
      await handleLicenseFile(directFile);
      return;
    }

    const filePath =
      normalizeDroppedPath(event.dataTransfer.getData("text/uri-list")) ||
      normalizeDroppedPath(event.dataTransfer.getData("text/plain"));

    if (!filePath) {
      setError("未识别到可读取的授权文件");
      return;
    }

    try {
      const text = await invoke<string>("read_local_text_file", { filePath });
      await loadLicenseText(text, filePath.split(/[\\/]/).pop());
    } catch (e: any) {
      setError(e?.toString?.() || "读取授权文件失败");
    }
  };

  useEffect(() => {
    const preventDefault = (event: DragEvent) => {
      event.preventDefault();
    };
    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);
    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", preventDefault);
    };
  }, []);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden p-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[16%] top-[12%] h-80 w-80 rounded-full bg-sky-200/32 blur-3xl" />
        <div className="absolute bottom-[10%] right-[14%] h-80 w-80 rounded-full bg-emerald-200/22 blur-3xl" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-xl"
      >
        <div className="fluent-hero-card relative overflow-hidden p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-200/35 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-sky-200/30 blur-3xl" />
          <div className="relative mb-7 text-center">
            <div className="mb-5 flex justify-center">
              <motion.div
                animate={{ rotate: [0, 4, 0, -4, 0], scale: [1, 1.03, 1] }}
                transition={{
                  rotate: { duration: 6, repeat: Infinity, ease: "easeInOut" },
                  scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                }}
                className="flex h-24 w-24 items-center justify-center rounded-[32px] border border-white bg-gradient-to-br from-white to-sky-50 shadow-[0_24px_52px_rgba(0,120,212,0.18)]"
              >
                <img src={tauriLogo} alt="Logo" className="h-[72px] w-[72px] object-contain drop-shadow-lg" />
              </motion.div>
            </div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#0078D4]">
              Fluent License Gate
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">软件授权验证</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">请先完成授权，再进入 SSH 登录与取证工作区</p>
          </div>

          <div className="relative space-y-4">
            {licenseStatus?.valid && (
              <div className={`license-tier-card ${licenseTierClass} rounded-[24px] border p-4 ${planCardClass}`}>
                <div className="flex items-center gap-3">
                  <div className="license-tier-avatar h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-emerald-200 bg-white">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-emerald-600">
                        已授权
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-800">
                      {licenseStatus.nickname || "授权用户"}
                    </div>
                    <div className="text-xs text-slate-500">QQ: {licenseStatus.qq || "-"}</div>
                  </div>
                  <div
                    className={`license-tier-badge px-3 py-1 rounded-full text-xs font-semibold ${planBadgeClass}`}
                  >
                    {licenseStatus.license_label || fallbackLabel}
                  </div>
                </div>
                {normalizedPlan !== "permanent" && (
                  <div className="mt-3 text-xs text-slate-600">
                    到期时间：{formatExpires(licenseStatus.expires_at)}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-[20px] border border-white/70 bg-white/68 p-3 shadow-sm">
              <div className="mb-2 text-xs font-semibold text-slate-600">当前机器码</div>
              <div className="break-all rounded-2xl bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500">
                {licenseStatus?.machine_code || "读取中..."}
              </div>
            </div>

            <div
              className={`inline-flex rounded-full px-3 py-2 text-xs font-semibold ${
                licenseStatus?.valid
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              {licenseStatus?.valid
                ? "授权状态：已授权"
                : `授权状态：未授权（${licenseStatus?.message || "请激活许可证"}）`}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".license,.txt,.json"
              className="hidden"
              onChange={(event) => {
                void handleLicenseFile(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />

            <div
              onDragEnter={(event) => {
                event.preventDefault();
                dragCounterRef.current += 1;
                setDragActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                setDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
                if (dragCounterRef.current === 0) {
                  setDragActive(false);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                dragCounterRef.current = 0;
                setDragActive(false);
                void readDroppedLicense(event);
              }}
              className={`relative rounded-[26px] border transition-all ${
                dragActive
                  ? "border-[#0078D4] bg-sky-50/76 shadow-[0_20px_36px_-26px_rgba(0,120,212,0.35)]"
                  : "border-white/74 bg-white/64"
              }`}
            >
              {dragActive && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[26px] border-2 border-dashed border-[#0078D4] bg-sky-500/8 backdrop-blur-[1px]">
                  <div className="rounded-[24px] border border-sky-200 bg-white/92 px-5 py-4 text-center shadow-[0_24px_40px_-28px_rgba(0,120,212,0.35)]">
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-[#0078D4]">
                      <FileUp size={22} />
                    </div>
                    <div className="text-sm font-semibold text-slate-800">松开导入授权文件</div>
                    <div className="mt-1 text-xs text-slate-500">导入后会自动读取内容并填充到激活区域</div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-start gap-3 p-4 text-left"
              >
                <div
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                    dragActive ? "border-sky-200 bg-white text-[#0078D4]" : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  {loadedFileName ? <CheckCircle2 size={18} /> : dragActive ? <FileUp size={18} /> : <Upload size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800">
                    {loadedFileName ? "已加载授权文件" : "导入授权文件"}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    {loadedFileName
                      ? loadedFileName
                      : "支持直接粘贴授权内容，或将 .license / .txt / .json 文件拖入此处自动读取。"}
                  </div>
                </div>
              </button>

              <div className="border-t border-slate-200/80 px-4 pb-4 pt-3">
                <textarea
                  value={licenseContent}
                  onChange={(e) => {
                    setLicenseContent(e.target.value);
                    if (loadedFileName) {
                      setLoadedFileName("");
                    }
                  }}
                  placeholder="粘贴 license 内容，或拖入授权文件"
                  className="ui-input-base min-h-28 w-full px-3 py-2 text-xs text-slate-700"
                />
              </div>
            </div>

            <button
              onClick={handleActivate}
              disabled={activating}
              className="ui-button-primary w-full py-3 text-sm disabled:opacity-70"
            >
              {activating ? "激活中..." : "激活许可证"}
            </button>

            {error && (
              <div className="p-3 bg-red-50 text-red-500 text-sm rounded-lg border border-red-100">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-slate-400 text-xs">FUXI Server Forensics 客户端 v{APP_VERSION}</p>
        </div>
      </motion.div>
    </div>
  );
}
