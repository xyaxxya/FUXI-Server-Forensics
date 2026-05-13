export type SkillCategory = "guard" | "recon" | "forensics" | "web" | "runtime" | "database" | "container" | "incident" | "report";

export type SkillSource = "built-in" | "github-inspired" | "custom";

export interface LocalizedText {
  zh: string;
  en: string;
}

export interface SkillDefinition {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  category: SkillCategory;
  triggers: string[];
  prompt: string;
  tools?: string[];
  source?: SkillSource;
  enabledByDefault?: boolean;
  examples?: string[];
}

export interface SkillRouteResult {
  selectedSkillIds: string[];
  selectedSkillNames: string[];
  frameworks: string[];
  statusText: string;
  phase: "probe" | "execute";
  probeHint: string;
}
