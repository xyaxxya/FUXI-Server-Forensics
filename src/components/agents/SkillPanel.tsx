import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, Check, ChevronDown, Search, Sparkles, X } from "lucide-react";
import { Language } from "../../translations";
import { SKILL_CATEGORIES, SKILL_CATEGORY_LABELS, SKILL_REGISTRY, getSkillsByIds } from "../../skills/registry";
import { SkillCategory, SkillDefinition } from "../../skills/types";

interface SkillPanelProps {
  language: Language;
  activeSkillIds: string[];
  autoSkillIds: string[];
  manualSkillIds: string[];
  onToggleSkill: (id: string) => void;
  onClearManualSkills: () => void;
  onUseSkill?: (id: string) => void;
}

function text(language: Language, value: { zh: string; en: string }) {
  return language === "zh" ? value.zh : value.en;
}

function sourceLabel(language: Language, source?: SkillDefinition["source"]) {
  if (source === "github-inspired") return language === "zh" ? "GitHub 启发" : "GitHub Inspired";
  if (source === "custom") return language === "zh" ? "自定义" : "Custom";
  return language === "zh" ? "内置" : "Built-in";
}

export default function SkillPanel({
  language,
  activeSkillIds,
  autoSkillIds,
  manualSkillIds,
  onToggleSkill,
  onClearManualSkills,
  onUseSkill,
}: SkillPanelProps) {
  const [expandedCategory, setExpandedCategory] = useState<SkillCategory | "all">("all");
  const [query, setQuery] = useState("");
  const activeSkills = useMemo(() => getSkillsByIds(activeSkillIds), [activeSkillIds]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSkills = useMemo(() => {
    return SKILL_REGISTRY.filter((skill) => {
      const inCategory = expandedCategory === "all" || skill.category === expandedCategory;
      if (!inCategory) return false;
      if (!normalizedQuery) return true;
      return [skill.id, skill.name.zh, skill.name.en, skill.description.zh, skill.description.en, ...skill.triggers]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [expandedCategory, normalizedQuery]);
  const recommendedSkillIds = ["linux_baseline", "web_middleware", "webshell_hunting", "evidence_summary", "incident_report"];
  const recommendedSkills = useMemo(() => getSkillsByIds(recommendedSkillIds), []);

  return (
    <section className="ui-shell flex min-h-0 flex-col overflow-hidden rounded-[1.7rem]">
      <div className="border-b border-slate-200/70 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <BrainCircuit size={17} />
              {language === "zh" ? "技能运行时" : "Skill Runtime"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {language === "zh" ? "自动路由 + 手动调用的取证技能包" : "Auto-routed and manually callable forensics skills"}
            </div>
          </div>
          {manualSkillIds.length > 0 && (
            <button onClick={onClearManualSkills} className="ui-button ui-pressable rounded-xl px-3 py-2 text-xs text-slate-600">
              {language === "zh" ? "清空手动" : "Clear"}
            </button>
          )}
        </div>
      </div>

      <div className="custom-scrollbar max-h-[34rem] space-y-4 overflow-auto p-4">
        <div className="rounded-[1.3rem] bg-slate-50/80 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <Sparkles size={13} />
            {language === "zh" ? "当前启用" : "Active Skills"}
          </div>
          {activeSkills.length === 0 ? (
            <div className="text-sm text-slate-500">{language === "zh" ? "暂无启用技能" : "No active skills"}</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeSkills.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => onUseSkill?.(skill.id)}
                  className={`rounded-2xl px-3 py-1.5 text-xs font-medium ${
                    manualSkillIds.includes(skill.id)
                      ? "bg-slate-900 text-white"
                      : "bg-blue-50 text-blue-700 border border-blue-100"
                  }`}
                >
                  {text(language, skill.name)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[1.3rem] border border-slate-200/70 bg-white/70 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            {language === "zh" ? "推荐快捷调用" : "Recommended"}
          </div>
          <div className="flex flex-wrap gap-2">
            {recommendedSkills.map((skill) => (
              <button
                key={skill.id}
                onClick={() => onToggleSkill(skill.id)}
                className={`rounded-2xl px-3 py-1.5 text-xs font-semibold ${manualSkillIds.includes(skill.id) ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {text(language, skill.name)}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={language === "zh" ? "搜索技能、触发词或场景" : "Search skills, triggers or scenarios"}
            className="ui-input-base w-full rounded-2xl bg-slate-50/80 py-2.5 pl-9 pr-4 text-sm text-slate-700"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setExpandedCategory("all")}
            className={`rounded-2xl px-3 py-1.5 text-xs font-medium ${expandedCategory === "all" ? "bg-slate-900 text-white" : "ui-chip text-slate-600"}`}
          >
            {language === "zh" ? "全部" : "All"}
          </button>
          {SKILL_CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setExpandedCategory(category)}
              className={`rounded-2xl px-3 py-1.5 text-xs font-medium ${expandedCategory === category ? "bg-slate-900 text-white" : "ui-chip text-slate-600"}`}
            >
              {text(language, SKILL_CATEGORY_LABELS[category])}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {visibleSkills.length === 0 && (
            <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-white/80 p-5 text-sm text-slate-500">
              {language === "zh" ? "没有匹配的技能。可以尝试搜索 webshell、springboot、mysql、docker、报告。" : "No skills matched. Try webshell, springboot, mysql, docker or report."}
            </div>
          )}
          {visibleSkills.map((skill) => {
            const isAuto = autoSkillIds.includes(skill.id);
            const isManual = manualSkillIds.includes(skill.id);
            const isActive = activeSkillIds.includes(skill.id);
            return (
              <motion.div key={skill.id} whileHover={{ y: -1 }} className="ui-subtle-surface rounded-[1.35rem] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-900">{text(language, skill.name)}</div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        {text(language, SKILL_CATEGORY_LABELS[skill.category])}
                      </span>
                      {isAuto && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">AUTO</span>}
                      {isManual && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">MANUAL</span>}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{text(language, skill.description)}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {skill.triggers.slice(0, 6).map((trigger) => (
                        <span key={trigger} className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-slate-500">
                          {trigger}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 text-[11px] text-slate-400">{sourceLabel(language, skill.source)}</div>
                  </div>
                  <button
                    onClick={() => onToggleSkill(skill.id)}
                    className={`ui-pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isActive ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200"}`}
                    title={isManual ? (language === "zh" ? "停用手动技能" : "Disable manual skill") : (language === "zh" ? "手动启用技能" : "Enable manually")}
                  >
                    {isManual ? <X size={14} /> : isActive ? <Check size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
