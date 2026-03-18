export interface ForensicsSkillPack {
  id: string;
  label: {
    zh: string;
    en: string;
  };
  prompt: string;
}

export interface AutoSkillRouting {
  selectedSkillIds: string[];
  selectedSkillNames: string[];
  frameworks: string[];
  statusText: string;
  phase: "probe" | "execute";
  probeHint: string;
}

export const FORENSICS_SKILL_PACKS: ForensicsSkillPack[] = [
  {
    id: "snapshot_gate",
    label: { zh: "快照闸门", en: "Snapshot Gate" },
    prompt: `【强制规则】任何写操作前必须先提醒用户做服务器快照并等待确认。未确认快照仅可执行只读命令。`,
  },
  {
    id: "baota",
    label: { zh: "宝塔场景", en: "BaoTa Panel" },
    prompt: `【宝塔技能】优先检查 /www/server/panel、/www/wwwroot、nginx/apache 配置、计划任务、网站目录近7天变更文件；识别被篡改首页、恶意上传、异常插件。`,
  },
  {
    id: "cluster",
    label: { zh: "集群场景", en: "Cluster Nodes" },
    prompt: `【集群技能】先识别主控与工作节点，再分角色执行命令。主控节点关注调度与控制面日志，工作节点关注容器/业务日志，避免无差别全量扫描。`,
  },
  {
    id: "k8s",
    label: { zh: "K8s场景", en: "K8s Forensics" },
    prompt: `【K8s技能】优先检查 kube-system 事件、异常 Pod 重启、可疑镜像来源、特权容器与 hostPath 挂载、ServiceAccount 权限扩大、Node 与 Pod 网络异常连接。`,
  },
  {
    id: "java",
    label: { zh: "Java站点", en: "Java Web" },
    prompt: `【Java技能】识别运行时参数与 JAR/WAR 路径，定位 application*.yml/properties、logback/log4j 配置、数据库连接、上传目录与临时目录，排查内存马与 webshell 落点。`,
  },
  {
    id: "springboot",
    label: { zh: "SpringBoot", en: "Spring Boot" },
    prompt: `【SpringBoot技能】优先采集 Actuator 暴露面、profiles 配置、外部化配置来源、MyBatis/JPA 数据源、异常 Bean 与定时任务；重点检查未鉴权管理端点。`,
  },
  {
    id: "web",
    label: { zh: "网站服务", en: "Web Middleware" },
    prompt: `【Web服务技能】按 Nginx/Apache/Tomcat 路径定位配置和日志，先还原访问时间线，再锁定攻击入口、上传点、执行链和持久化点。`,
  },
];

export function buildSkillPackPrompt(selectedIds: string[], language: "zh" | "en"): string {
  const selected = FORENSICS_SKILL_PACKS.filter((pack) => selectedIds.includes(pack.id));
  if (selected.length === 0) return "";
  const lines = selected.map((pack) => `- ${language === "zh" ? pack.label.zh : pack.label.en}: ${pack.prompt}`);
  return `\n\n## Active Skill Packs\n${lines.join("\n")}`;
}

const add = (set: Set<string>, value: string) => set.add(value);

export function detectAutoSkillRouting(messages: { role: string; content: string }[], generalInfo?: string): AutoSkillRouting {
  const recentText = messages
    .slice(-8)
    .map((m) => m.content || "")
    .join("\n");
  const corpus = `${recentText}\n${generalInfo || ""}`.toLowerCase();
  const skills = new Set<string>();
  const frameworks = new Set<string>();

  if (
    /重构|改造|上线|部署|迁移|修复|网站能力|website|refactor|remediation|deployment/.test(corpus)
  ) {
    add(skills, "snapshot_gate");
    add(frameworks, "Website Refactor");
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
    add(skills, "springboot");
    add(skills, "java");
    add(skills, "web");
    add(frameworks, "SpringBoot");
  }

  if (/tomcat|jar|war|java|jvm/.test(corpus)) {
    add(skills, "java");
    add(frameworks, "Java");
  }

  if (/nginx|apache|tomcat|web|网站|http|https|vhost/.test(corpus)) {
    add(skills, "web");
    add(frameworks, "Web Middleware");
  }

  const selectedSkillIds = [...skills];
  const isWebsiteRefactorIntent = /重构|改造|上线|部署|迁移|修复|网站能力|website|refactor|remediation|deployment/.test(corpus);
  if (isWebsiteRefactorIntent && !selectedSkillIds.includes("snapshot_gate")) {
    selectedSkillIds.push("snapshot_gate");
  }
  const selectedSkillNames = FORENSICS_SKILL_PACKS
    .filter((pack) => selectedSkillIds.includes(pack.id))
    .map((pack) => pack.label.zh);
  const frameworkList = [...frameworks];
  const phase: "probe" | "execute" = frameworkList.length > 0 ? "execute" : "probe";
  const probeHint = "阶段1只读探测：先识别Nginx/Apache/Tomcat、Java/SpringBoot、K8s/集群特征，再进入重构执行。";
  const statusText = frameworkList.length
    ? `阶段2执行：识别到 ${frameworkList.join(" / ")} 框架，调用 ${selectedSkillNames.join("、")} skills`
    : isWebsiteRefactorIntent
      ? `阶段1探测：${probeHint} 当前已路由 skills：${selectedSkillNames.join("、") || "snapshot_gate"}`
      : "未识别到特定框架，使用默认取证策略";

  return { selectedSkillIds, selectedSkillNames, frameworks: frameworkList, statusText, phase, probeHint };
}
