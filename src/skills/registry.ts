import { SkillDefinition, SkillRouteResult } from "./types";

export const SKILL_CATEGORIES = ["guard", "recon", "forensics", "web", "runtime", "database", "container", "incident", "report"] as const;

export const SKILL_CATEGORY_LABELS: Record<(typeof SKILL_CATEGORIES)[number], { zh: string; en: string }> = {
  guard: { zh: "安全闸门", en: "Guardrails" },
  recon: { zh: "远勘研判", en: "Recon" },
  forensics: { zh: "系统取证", en: "System Forensics" },
  web: { zh: "Web取证", en: "Web Forensics" },
  runtime: { zh: "运行时", en: "Runtime" },
  database: { zh: "数据库", en: "Database" },
  container: { zh: "容器集群", en: "Containers" },
  incident: { zh: "应急响应", en: "Incident Response" },
  report: { zh: "报告交付", en: "Reporting" },
};

export const SKILL_REGISTRY: SkillDefinition[] = [
  {
    id: "snapshot_gate",
    name: { zh: "快照闸门", en: "Snapshot Gate" },
    description: { zh: "在写操作前提醒快照，保持取证可回滚。", en: "Reminds the operator to snapshot before write operations." },
    category: "guard",
    triggers: ["快照", "snapshot", "重构", "修复", "上线", "迁移", "部署"],
    prompt: "【快照闸门】任何写操作前必须先提醒用户做服务器快照并等待确认。未确认快照仅可执行只读命令。",
    source: "built-in",
    enabledByDefault: true,
  },
  {
    id: "public_web_recon",
    name: { zh: "公网远勘", en: "Public Web Recon" },
    description: { zh: "面向涉诈网站批量采集 IP、DNS、注册商、证书、技术栈、favicon、外部服务、登录面与后台/API 线索。", en: "Profiles public websites by IP, DNS, registrar, TLS certificate, tech stack, favicon, external services, login surfaces, admin and API hints." },
    category: "recon",
    triggers: ["远勘", "涉诈网站", "灯塔", "信息收集", "公网", "批量网站", "favicon", "注册商", "rdap", "whois", "web recon", "reconnaissance"],
    prompt: "【公网远勘技能】优先调用 web_recon_batch 对目标做公开信息采集，输出 IP/DNS/RDAP、标题与业务用途、技术栈、架构线索、TLS 证书、favicon hash、标准站点产物、外部服务主机、页面/JS 中的 API 与后台路径、登录表单和风险标签；禁止默认口令尝试、爆破、漏洞利用或绕过行为。",
    tools: ["web_recon_batch", "search_web", "fetch_webpage"],
    source: "built-in",
  },
  {
    id: "infra_correlation",
    name: { zh: "基础设施关联", en: "Infrastructure Correlation" },
    description: { zh: "按 IP、DNS、注册商、证书、favicon、外部服务和技术栈聚类同源或同模板资产。", en: "Clusters related assets by IP, DNS, registrar, certificate, favicon, external services and technology fingerprints." },
    category: "recon",
    triggers: ["同源", "同模板", "同基础设施", "关联", "聚类", "ip", "dns", "cdn", "favicon hash", "mmh3", "注册商"],
    prompt: "【基础设施关联技能】把批量远勘结果按 resolvedIps、dnsRecords、rdap.registrar/organization、tlsCertificate.sha256、faviconMmh3、externalHosts、title/meta、techStack 和 architecture 分组；每个分组标明证据字段、置信度、疑似同运营方原因和后续授权验证点。",
    source: "built-in",
  },
  {
    id: "admin_surface_mapping",
    name: { zh: "后台/API 面梳理", en: "Admin/API Surface Mapping" },
    description: { zh: "整理登录表单、后台候选、API 路径、认证面和弱口令风险信号，但不执行口令尝试。", en: "Maps login forms, admin candidates, API paths, auth surfaces and credential-risk signals without attempting credentials." },
    category: "recon",
    triggers: ["后台", "管理入口", "登录入口", "弱口令", "api", "接口", "swagger", "openapi", "admin", "login", "credential"],
    prompt: "【后台/API 面梳理技能】从 adminCandidates、apiCandidates、forms、credentialSignals 和 pathHints 中提取高价值入口，按路径、状态码、标题、来源、登录可能性和业务意义排序；只提示弱口令风险，不执行爆破或凭据尝试。",
    source: "built-in",
  },
  {
    id: "scam_business_profile",
    name: { zh: "涉诈业务画像", en: "Scam Business Profile" },
    description: { zh: "研判站点用途、页面功能、交易/充值/客服/代理等涉诈业务线索。", en: "Assesses site purpose and scam-business clues such as deposits, support, agents and wallets." },
    category: "recon",
    triggers: ["涉诈", "诈骗", "用途", "业务形态", "干什么", "功能", "充值", "提现", "钱包", "博彩", "投资", "客服", "代理"],
    prompt: "【涉诈业务画像技能】依据 businessProfile、title、metaDescription、forms、apiCandidates、pathHints 和页面关键词，判断站点业务形态、核心功能、资金链/引流/代理线索、可疑程度与证据来源；结论要区分事实、推断和待验证项。",
    source: "built-in",
  },
  {
    id: "linux_baseline",
    name: { zh: "Linux基线", en: "Linux Baseline" },
    description: { zh: "采集系统、进程、网络、账户、服务和定时任务基线。", en: "Collects system, process, network, account, service and cron baselines." },
    category: "forensics",
    triggers: ["linux", "基线", "系统", "进程", "账户", "服务", "cron", "baseline"],
    prompt: "【Linux基线技能】优先采集系统版本、启动时间、登录用户、进程树、监听端口、网络连接、账户 sudo 权限、systemd 服务、计划任务与最近登录记录；结论必须引用命令输出证据。",
    tools: ["run_shell_command", "update_context_info", "update_plan"],
    source: "github-inspired",
  },
  {
    id: "baota",
    name: { zh: "宝塔场景", en: "BaoTa Panel" },
    description: { zh: "识别宝塔面板、站点目录、计划任务和被篡改入口。", en: "Inspects BaoTa panel paths, site roots, scheduled tasks and tampering points." },
    category: "web",
    triggers: ["宝塔", "baota", "bt panel", "/www", "panel"],
    prompt: "【宝塔技能】优先检查 /www/server/panel、/www/wwwroot、nginx/apache 配置、计划任务、网站目录近7天变更文件；识别被篡改首页、恶意上传、异常插件。",
    source: "built-in",
  },
  {
    id: "web_middleware",
    name: { zh: "Web服务", en: "Web Middleware" },
    description: { zh: "按 Nginx/Apache/Tomcat 路径定位配置与日志。", en: "Locates Nginx, Apache, Tomcat configs and logs." },
    category: "web",
    triggers: ["nginx", "apache", "tomcat", "web", "网站", "http", "https", "vhost"],
    prompt: "【Web服务技能】按 Nginx/Apache/Tomcat 路径定位配置和日志，先还原访问时间线，再锁定攻击入口、上传点、执行链和持久化点。",
    tools: ["list_server_directory", "find_server_files", "grep_server_files", "read_server_file"],
    source: "built-in",
  },
  {
    id: "webshell_hunting",
    name: { zh: "Webshell排查", en: "Webshell Hunting" },
    description: { zh: "围绕上传目录、可疑后缀、混淆函数和近期变更定位 Webshell。", en: "Hunts webshells through upload paths, suspicious extensions, obfuscation and recent changes." },
    category: "web",
    triggers: ["webshell", "后门", "木马", "上传", "篡改", "一句话", "恶意文件", "可疑文件"],
    prompt: "【Webshell排查技能】优先定位网站根目录和上传目录，按最近变更、异常后缀、可执行权限、危险函数、长 base64/hex 字符串、可疑 include/eval/assert/system 调用筛选样本；读取文件时先小范围预览并保留路径、mtime、owner 和命中规则。",
    tools: ["find_server_files", "grep_server_files", "read_server_file", "update_context_info"],
    source: "github-inspired",
  },
  {
    id: "nginx_timeline",
    name: { zh: "Nginx时间线", en: "Nginx Timeline" },
    description: { zh: "从 access/error 日志还原攻击时间线。", en: "Reconstructs attack timeline from access and error logs." },
    category: "web",
    triggers: ["nginx", "access.log", "error.log", "时间线", "timeline", "访问日志"],
    prompt: "【Nginx时间线技能】优先定位 access.log/error.log 与 vhost 配置，按高危状态码、上传接口、管理后台、异常 UA、异常 IP、命令执行特征和同源连续请求还原时间线；输出请求时间、源 IP、URL、状态码、命中原因和后续验证点。",
    tools: ["grep_server_files", "read_server_file", "update_context_info"],
    source: "github-inspired",
  },
  {
    id: "java_runtime",
    name: { zh: "Java站点", en: "Java Runtime" },
    description: { zh: "识别 JAR/WAR、JVM 参数、配置与日志落点。", en: "Finds JAR/WAR paths, JVM args, configs and log locations." },
    category: "runtime",
    triggers: ["java", "jar", "war", "jvm", "tomcat", "log4j"],
    prompt: "【Java技能】识别运行时参数与 JAR/WAR 路径，定位 application*.yml/properties、logback/log4j 配置、数据库连接、上传目录与临时目录，排查内存马与 webshell 落点。",
    source: "built-in",
  },
  {
    id: "springboot_forensics",
    name: { zh: "SpringBoot", en: "Spring Boot" },
    description: { zh: "排查 Actuator、profiles、数据源、Bean、定时任务与上传路径。", en: "Checks Actuator, profiles, datasources, beans, schedules and upload paths." },
    category: "runtime",
    triggers: ["spring", "springboot", "spring boot", "actuator", "application.yml", "application.properties"],
    prompt: "【SpringBoot技能】优先采集 Actuator 暴露面、profiles 配置、外部化配置来源、MyBatis/JPA 数据源、异常 Bean 与定时任务；重点检查未鉴权管理端点。",
    source: "built-in",
  },
  {
    id: "cluster",
    name: { zh: "集群场景", en: "Cluster Nodes" },
    description: { zh: "区分主控与工作节点，避免无差别扫描。", en: "Separates control and worker nodes to avoid blind scanning." },
    category: "container",
    triggers: ["集群", "cluster", "master", "worker", "node"],
    prompt: "【集群技能】先识别主控与工作节点，再分角色执行命令。主控节点关注调度与控制面日志，工作节点关注容器/业务日志，避免无差别全量扫描。",
    source: "built-in",
  },
  {
    id: "k8s",
    name: { zh: "K8s场景", en: "K8s Forensics" },
    description: { zh: "检查 K8s 事件、Pod、镜像、权限和特权容器。", en: "Checks Kubernetes events, pods, images, privileges and privileged containers." },
    category: "container",
    triggers: ["k8s", "kubernetes", "kubectl", "pod", "deployment", "daemonset", "statefulset", "kube-system"],
    prompt: "【K8s技能】优先检查 kube-system 事件、异常 Pod 重启、可疑镜像来源、特权容器与 hostPath 挂载、ServiceAccount 权限扩大、Node 与 Pod 网络异常连接。",
    source: "built-in",
  },
  {
    id: "docker_forensics",
    name: { zh: "Docker取证", en: "Docker Forensics" },
    description: { zh: "检查容器、镜像、挂载、网络、特权与逃逸风险。", en: "Checks containers, images, mounts, networks, privilege and escape risk." },
    category: "container",
    triggers: ["docker", "container", "容器", "镜像", "compose", "privileged"],
    prompt: "【Docker取证技能】优先采集 docker info、容器列表、镜像来源、挂载路径、网络模式、特权容器、宿主机目录映射和最近创建/重启容器；重点识别宿主机敏感目录挂载、可疑镜像与异常 entrypoint。",
    tools: ["run_shell_command", "update_context_info"],
    source: "github-inspired",
  },
  {
    id: "mysql_forensics",
    name: { zh: "MySQL取证", en: "MySQL Forensics" },
    description: { zh: "排查账号权限、弱口令风险、慢日志、插件和数据篡改线索。", en: "Investigates accounts, permissions, slow logs, plugins and tampering clues." },
    category: "database",
    triggers: ["mysql", "mariadb", "数据库", "慢日志", "权限", "sql"],
    prompt: "【MySQL取证技能】优先识别配置文件、监听地址、用户权限矩阵、匿名/空密码账号、远程 root、general/slow/error log 路径、可疑 UDF/插件、近期 DDL/DML 痕迹；输出证据路径与最小化验证 SQL。",
    tools: ["run_shell_command", "update_context_info"],
    source: "github-inspired",
  },
  {
    id: "incident_report",
    name: { zh: "事件报告", en: "Incident Report" },
    description: { zh: "按摘要、时间线、证据、影响、处置建议输出报告。", en: "Produces reports with summary, timeline, evidence, impact and recommendations." },
    category: "report",
    triggers: ["报告", "总结", "复盘", "report", "summary", "交付"],
    prompt: "【事件报告技能】输出必须包含：执行摘要、关键事实、时间线表格、证据清单、影响评估、未确认假设、后续验证项、处置建议；所有结论标注证据来源和置信度。",
    source: "github-inspired",
  },
  {
    id: "evidence_summary",
    name: { zh: "证据整理", en: "Evidence Summary" },
    description: { zh: "把共享线索整理为事实、假设、风险与下一步。", en: "Turns shared clues into facts, hypotheses, risks and next actions." },
    category: "incident",
    triggers: ["证据", "线索", "ioc", "mitre", "attack", "置信度", "假设", "evidence"],
    prompt: "【证据整理技能】将现有线索分为已证实事实、合理假设、待验证问题、IOC、MITRE ATT&CK 映射和下一步采集动作；禁止把未经验证的假设写成结论。",
    source: "github-inspired",
  },
];

export function getSkillById(id: string) {
  return SKILL_REGISTRY.find((skill) => skill.id === id) || null;
}

export function getSkillsByIds(ids: string[]) {
  const idSet = new Set(ids);
  return SKILL_REGISTRY.filter((skill) => idSet.has(skill.id));
}

export function normalizeSkillIds(ids: string[]) {
  const knownIds = new Set(SKILL_REGISTRY.map((skill) => skill.id));
  return Array.from(new Set(ids.filter((id) => knownIds.has(id))));
}

export function buildSkillPackPrompt(selectedIds: string[], language: "zh" | "en"): string {
  const selected = getSkillsByIds(normalizeSkillIds(selectedIds));
  if (selected.length === 0) return "";
  const lines = selected.map((skill) => `- ${language === "zh" ? skill.name.zh : skill.name.en}: ${skill.prompt}`);
  return `\n\n## Active Skill Packs\n${lines.join("\n")}`;
}

const add = (set: Set<string>, value: string) => set.add(value);

function matchAny(corpus: string, triggers: string[]) {
  return triggers.some((trigger) => corpus.includes(trigger.toLowerCase()));
}

export function detectAutoSkillRouting(messages: { role: string; content: string }[], generalInfo?: string): SkillRouteResult {
  const recentText = messages
    .slice(-8)
    .map((m) => m.content || "")
    .join("\n");
  const corpus = `${recentText}\n${generalInfo || ""}`.toLowerCase();
  const skills = new Set<string>();
  const frameworks = new Set<string>();

  for (const skill of SKILL_REGISTRY) {
    if (skill.enabledByDefault || matchAny(corpus, skill.triggers)) {
      add(skills, skill.id);
    }
  }

  if (/重构|改造|上线|部署|迁移|修复|网站能力|website|refactor|remediation|deployment/.test(corpus)) {
    add(skills, "snapshot_gate");
    add(frameworks, "Website Refactor");
  }

  if (/远勘|涉诈网站|诈骗网站|灯塔|信息收集|公网|批量网站|favicon|注册商|rdap|whois|web recon|reconnaissance/.test(corpus)) {
    add(skills, "public_web_recon");
    add(skills, "infra_correlation");
    add(skills, "scam_business_profile");
    add(frameworks, "Public Web Recon");
  }

  if (/后台|管理入口|登录入口|弱口令|api|接口|swagger|openapi|admin|login|credential/.test(corpus)) {
    add(skills, "admin_surface_mapping");
    add(frameworks, "Admin/API Surface");
  }

  if (/同源|同模板|同基础设施|关联|聚类|cdn|favicon hash|mmh3|dns|注册商/.test(corpus)) {
    add(skills, "infra_correlation");
    add(frameworks, "Infrastructure Correlation");
  }

  if (/涉诈|诈骗|用途|业务形态|干什么|功能|充值|提现|钱包|博彩|投资|客服|代理/.test(corpus)) {
    add(skills, "scam_business_profile");
    add(frameworks, "Scam Business Profile");
  }

  if (/宝塔|bt panel|baota|\/www\/|panel/.test(corpus)) {
    add(skills, "baota");
    add(frameworks, "BaoTa");
  }

  if (/k8s|kubernetes|kubectl|kube-system|pod|deployment|daemonset|statefulset/.test(corpus)) {
    add(skills, "k8s");
    add(skills, "cluster");
    add(frameworks, "Kubernetes");
  }

  if (/集群|cluster|master|worker|node/.test(corpus)) {
    add(skills, "cluster");
    add(frameworks, "Cluster");
  }

  if (/spring boot|springboot|actuator|application\.yml|application\.properties|spring/.test(corpus)) {
    add(skills, "springboot_forensics");
    add(skills, "java_runtime");
    add(skills, "web_middleware");
    add(frameworks, "SpringBoot");
  }

  if (/tomcat|jar|war|java|jvm/.test(corpus)) {
    add(skills, "java_runtime");
    add(frameworks, "Java");
  }

  if (/nginx|apache|tomcat|web|网站|http|https|vhost/.test(corpus)) {
    add(skills, "web_middleware");
    add(frameworks, "Web Middleware");
  }

  if (/webshell|后门|木马|上传|篡改|一句话|恶意文件|可疑文件/.test(corpus)) {
    add(skills, "webshell_hunting");
    add(frameworks, "Webshell Hunting");
  }

  const selectedSkillIds = normalizeSkillIds([...skills]);
  const selectedSkillNames = getSkillsByIds(selectedSkillIds).map((skill) => skill.name.zh);
  const frameworkList = [...frameworks];
  const phase: "probe" | "execute" = frameworkList.length > 0 ? "execute" : "probe";
  const probeHint = "阶段1只读探测：先识别公网远勘、Nginx/Apache/Tomcat、Java/SpringBoot、K8s/集群等特征，再进入技能执行。";
  const statusText = frameworkList.length
    ? `阶段2执行：识别到 ${frameworkList.join(" / ")} 框架，调用 ${selectedSkillNames.join("、")} skills`
    : `阶段1探测：${probeHint} 当前已路由 skills：${selectedSkillNames.join("、") || "默认取证策略"}`;

  return { selectedSkillIds, selectedSkillNames, frameworks: frameworkList, statusText, phase, probeHint };
}
