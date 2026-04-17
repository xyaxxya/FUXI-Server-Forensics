# Command Center And Slash Command Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix slash command submission, add second-level tabs to the Command Center, and preserve visible command cards when returning from other sidebars.

**Architecture:** Keep the current dashboard and sidebar structure intact. Add metadata-driven sub-category filtering on top of the existing command registry, centralize slash-command resolution in the shared workbench helper, and remove lossy `stderr` filtering so card rendering decides visible states instead of the list layer.

**Tech Stack:** React 19, TypeScript, Framer Motion, Tauri frontend state, existing command registry in `src/plugins`

---

### Task 1: Centralize slash command parsing and resolution

**Files:**
- Modify: `src/components/agents/WorkbenchWidgets.tsx`

- [ ] **Step 1: Add shared slash-command parsing types**

```ts
export interface ResolvedSlashCommand {
  matchedCommand: SlashCommandItem | null;
  commandToken: string | null;
  bodyText: string;
  sendText: string | null;
  shouldExecuteImmediately: boolean;
}
```

- [ ] **Step 2: Replace exact-match-only parsing with token parsing**

```ts
function splitSlashCommandInput(input: string) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return { commandToken: null, bodyText: "" };
  }

  const firstWhitespace = trimmed.search(/\s/);
  if (firstWhitespace === -1) {
    return { commandToken: trimmed, bodyText: "" };
  }

  return {
    commandToken: trimmed.slice(0, firstWhitespace),
    bodyText: trimmed.slice(firstWhitespace).trim(),
  };
}
```

- [ ] **Step 3: Export token-aware resolver**

```ts
export function resolveSlashCommandInput(input: string, commands: SlashCommandItem[]): ResolvedSlashCommand {
  const { commandToken, bodyText } = splitSlashCommandInput(input);
  const matchedCommand = commandToken
    ? commands.find((item) => item.command.toLowerCase() === commandToken.toLowerCase()) || null
    : null;

  if (!matchedCommand) {
    return {
      matchedCommand: null,
      commandToken,
      bodyText,
      sendText: null,
      shouldExecuteImmediately: false,
    };
  }

  if (matchedCommand.onSelect) {
    return {
      matchedCommand,
      commandToken,
      bodyText,
      sendText: null,
      shouldExecuteImmediately: true,
    };
  }

  const preset = matchedCommand.insertText || matchedCommand.command;
  const sendText = bodyText ? `${preset}\n\n${bodyText}` : preset;

  return {
    matchedCommand,
    commandToken,
    bodyText,
    sendText,
    shouldExecuteImmediately: false,
  };
}
```

- [ ] **Step 4: Preserve menu completion behavior**

```ts
export function getExactSlashCommand(input: string, commands: SlashCommandItem[]) {
  const { commandToken } = splitSlashCommandInput(input);
  if (!commandToken) {
    return null;
  }
  return commands.find((item) => item.command.toLowerCase() === commandToken.toLowerCase()) || null;
}
```

- [ ] **Step 5: Run TypeScript build**

Run: `npm run build`
Expected: Build may still fail on unrelated workspace issues, but no new syntax errors should point to `src/components/agents/WorkbenchWidgets.tsx`.

### Task 2: Enable slash command submission in AI panels

**Files:**
- Modify: `src/components/agents/GeneralAgent.tsx`
- Modify: `src/components/agents/DatabaseAgent.tsx`
- Modify: `src/components/agents/GeneralInfoPanel.tsx`

- [ ] **Step 1: Update imports to use the shared resolver**

```ts
import {
  getExactSlashCommand,
  getSlashCommandCompletion,
  resolveSlashCommandInput,
} from "./WorkbenchWidgets";
```

- [ ] **Step 2: Replace early slash-input rejection in each send handler**

```ts
const resolvedSlash = resolveSlashCommandInput(input, slashCommands);
if (input.trim().startsWith("/") && !resolvedSlash.matchedCommand) {
  return;
}
if (resolvedSlash.shouldExecuteImmediately && resolvedSlash.matchedCommand?.onSelect) {
  resolvedSlash.matchedCommand.onSelect();
  return;
}
const prompt = resolvedSlash.sendText ?? input.trim();
```

- [ ] **Step 3: Update `Enter` handlers to send resolved text**

```ts
if (event.key === "Enter" && !event.shiftKey) {
  event.preventDefault();
  void handleSend();
}
```

- [ ] **Step 4: Re-enable the send button when slash input is sendable**

```ts
const resolvedSlash = resolveSlashCommandInput(input, slashCommands);
const canSend =
  !loading &&
  !!input.trim() &&
  (!input.trim().startsWith("/") || !!resolvedSlash.matchedCommand);
```

- [ ] **Step 5: Verify manual cases**

Run these UI checks:
- `/plan`
- `/plan 先分析 SSH 异常登录`
- `/web 搜一下宝塔漏洞`
- `/clear`

Expected:
- prompt modifiers send successfully
- action commands execute immediately
- unknown slash commands do not send raw text

### Task 3: Add second-level metadata to command definitions

**Files:**
- Modify: `src/plugins/types.ts`
- Modify: `src/plugins/forensics.ts`

- [ ] **Step 1: Extend `PluginCommand` with optional sub-category fields**

```ts
  subCategory?: string;
  subCategoryLabel?: string;
  subCategoryLabelEn?: string;
```

- [ ] **Step 2: Annotate system and network command groups**

```ts
subCategory: "base",
subCategoryLabel: "基础信息",
subCategoryLabelEn: "Base Info",
```

```ts
subCategory: "routing",
subCategoryLabel: "路由与 DNS",
subCategoryLabelEn: "Routing & DNS",
```

- [ ] **Step 3: Annotate security, web, and database groups**

```ts
subCategory: "bt",
subCategoryLabel: "宝塔",
subCategoryLabelEn: "BT Panel",
```

```ts
subCategory: "mysql",
subCategoryLabel: "MySQL",
subCategoryLabelEn: "MySQL",
```

- [ ] **Step 4: Keep commands without structural rewrites**

```ts
// Do not change:
id
category
command
parserType
```

- [ ] **Step 5: Run TypeScript build**

Run: `npm run build`
Expected: New command metadata compiles cleanly.

### Task 4: Render second-level tabs in the dashboard

**Files:**
- Modify: `src/components/Dashboard.tsx`

- [ ] **Step 1: Track selected sub-category per first-level tab**

```ts
const [activeSubcategories, setActiveSubcategories] = useState<Record<string, string>>({});
```

- [ ] **Step 2: Derive sub-category options from the active category**

```ts
const subcategoryOptions = useMemo(() => {
  const scoped = commands.filter((command) => command.category === activeTab && command.subCategory);
  const unique = new Map<string, { key: string; label: string }>();
  scoped.forEach((command) => {
    if (!command.subCategory || unique.has(command.subCategory)) {
      return;
    }
    unique.set(command.subCategory, {
      key: command.subCategory,
      label: language === "zh" ? command.subCategoryLabel || command.subCategory : command.subCategoryLabelEn || command.subCategory,
    });
  });
  return [{ key: "all", label: language === "zh" ? "全部" : "All" }, ...unique.values()];
}, [activeTab, language]);
```

- [ ] **Step 3: Filter visible commands by selected sub-category**

```ts
const activeSubcategory = activeSubcategories[activeTab] || "all";
const tabCommands = commands.filter((command) => {
  if (command.category !== activeTab) {
    return false;
  }
  if (activeSubcategory === "all") {
    return true;
  }
  return command.subCategory === activeSubcategory;
});
```

- [ ] **Step 4: Render an animated tab row below the title block**

```tsx
{subcategoryOptions.length > 1 && (
  <div className="mt-5 flex flex-wrap gap-2">
    {subcategoryOptions.map((option) => {
      const active = option.key === activeSubcategory;
      return (
        <motion.button
          key={option.key}
          layout
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.985 }}
          onClick={() => setActiveSubcategories((prev) => ({ ...prev, [activeTab]: option.key }))}
          className={active ? "ui-chip-active ..." : "ui-chip ..."}
        >
          {option.label}
        </motion.button>
      );
    })}
  </div>
)}
```

- [ ] **Step 5: Verify persistence**

Manual check:
- select `Web -> Nginx`
- switch to another sidebar panel
- switch back to `web`

Expected: the selected sub-category remains `Nginx`.

### Task 5: Remove lossy stderr filtering and refine empty states

**Files:**
- Modify: `src/components/Dashboard.tsx`

- [ ] **Step 1: Remove `stderr`-based suppression from `visibleCommands`**

```ts
const visibleCommands = filteredCommands;
```

- [ ] **Step 2: Distinguish true empty scopes from waiting states**

```ts
const hasDefinitionsInScope = tabCommands.length > 0;
const hasAnyResultsInScope = tabCommands.some((command) => !!getCommandData(command.id));
```

- [ ] **Step 3: Update empty-state copy logic**

```tsx
<h3 className="text-2xl font-bold text-slate-800 mb-2">
  {!hasDefinitionsInScope
    ? (language === "zh" ? "暂无命令" : "No Commands")
    : !hasAnyResultsInScope
      ? (language === "zh" ? "等待采集" : "Waiting For Collection")
      : t.no_metrics_title}
</h3>
```

- [ ] **Step 4: Keep refresh affordance active**

```tsx
<button onClick={() => fetchAll(tabCommands.map((command) => command.id), true)}>
```

- [ ] **Step 5: Verify return-to-tab behavior**

Manual check:
- open a category where some commands yield stderr
- switch to another sidebar
- return to the same category

Expected: cards still render instead of collapsing into the global empty state.

### Task 6: Validate and hand off

**Files:**
- Modify: `src/components/agents/WorkbenchWidgets.tsx`
- Modify: `src/components/agents/GeneralAgent.tsx`
- Modify: `src/components/agents/DatabaseAgent.tsx`
- Modify: `src/components/agents/GeneralInfoPanel.tsx`
- Modify: `src/plugins/types.ts`
- Modify: `src/plugins/forensics.ts`
- Modify: `src/components/Dashboard.tsx`

- [ ] **Step 1: Run diagnostics on edited files**

Run: use IDE diagnostics for the modified files.
Expected: no newly introduced TypeScript or JSX errors.

- [ ] **Step 2: Run a full frontend build**

Run: `npm run build`
Expected: successful build, or only unrelated pre-existing failures outside the edited files.

- [ ] **Step 3: Review git diff before handoff**

Run: `git diff -- src/components/agents/WorkbenchWidgets.tsx src/components/agents/GeneralAgent.tsx src/components/agents/DatabaseAgent.tsx src/components/agents/GeneralInfoPanel.tsx src/plugins/types.ts src/plugins/forensics.ts src/components/Dashboard.tsx`
Expected: diff is limited to the planned feature work.

- [ ] **Step 4: Summarize manual verification**

```md
- Slash commands with body text send correctly
- Command Center shows second-level tabs
- Returning to a metrics tab preserves cards with stderr
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-04-17-command-center-slash-command-fixes-design.md docs/superpowers/plans/2026-04-17-command-center-slash-command-fixes.md src/components/agents/WorkbenchWidgets.tsx src/components/agents/GeneralAgent.tsx src/components/agents/DatabaseAgent.tsx src/components/agents/GeneralInfoPanel.tsx src/plugins/types.ts src/plugins/forensics.ts src/components/Dashboard.tsx
git commit -m "feat: improve slash commands and command center navigation"
```
