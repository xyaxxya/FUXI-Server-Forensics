import { SKILL_REGISTRY } from "./registry";

export type { SkillCategory, SkillDefinition, SkillRouteResult as AutoSkillRouting } from "./types";
export {
  SKILL_CATEGORIES,
  SKILL_CATEGORY_LABELS,
  SKILL_REGISTRY,
  buildSkillPackPrompt,
  detectAutoSkillRouting,
  getSkillById,
  getSkillsByIds,
  normalizeSkillIds,
} from "./registry";

export const FORENSICS_SKILL_PACKS = SKILL_REGISTRY.map((skill) => ({
  id: skill.id,
  label: skill.name,
  prompt: skill.prompt,
}));
