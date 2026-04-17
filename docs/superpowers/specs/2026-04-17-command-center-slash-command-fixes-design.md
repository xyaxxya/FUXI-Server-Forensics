# 2026-04-17 Command Center And Slash Command Fixes Design

## Summary

This spec fixes three related UX and state issues in the current workbench:

1. Slash commands such as `/plan` cannot be sent when the user appends normal text after the command.
2. The Command Center only exposes a flat first-level category view even though the command registry already contains enough breadth to support a second level.
3. Returning to the Command Center after switching sidebars can show an empty state even though cached command results still exist.

The implementation keeps the existing navigation model intact. It extends metadata on command definitions, improves slash-command parsing in AI panels, and removes a lossy filtering rule in the metrics dashboard.

## Goals

- Allow users to send slash-prefixed prompts in a Claude Code-like way, including `/command` plus free-form text.
- Expose second-level grouping in the Command Center without rebuilding the left sidebar or routing model.
- Preserve and display cached command cards when the user leaves and re-enters the Command Center.
- Improve the perceived quality of the UI with lightweight stateful animations and clearer empty or error messaging.

## Non-Goals

- Redesign the entire global sidebar or introduce nested route trees.
- Change backend SSH execution, command batching, or IPC protocols.
- Replace the current command-card architecture with a tree explorer or virtualized list.
- Rewrite all command parsers or standardize every stderr format in this change.

## Problem Analysis

### 1. Slash Commands

Current AI panels only treat slash commands as actionable when the full trimmed input exactly matches a known command such as `/plan`. This causes two failures:

- `/plan ` stops being recognized after the trailing space.
- `/plan investigate suspicious SSH activity` is treated as an unsupported slash command instead of a valid prompt modifier.

The send button also becomes disabled whenever the input starts with `/`, which blocks legitimate command-plus-text input.

### 2. Missing Second-Level Navigation

The registry in `src/plugins/forensics.ts` already contains natural sub-groups such as BT panel, Nginx, Apache, MySQL, PostgreSQL, and Redis. The current UI only filters by first-level `category`, so users cannot quickly scope within large sections.

### 3. False Empty State After Sidebar Switching

The dashboard builds `visibleCommands` by hiding any command card whose cached result contains `stderr`. Many commands produce partial stderr for normal environmental reasons, for example missing files, absent services, or empty crontabs. After returning to a tab, this filter can remove every card and trigger the empty-state copy even though command definitions and cached results are still present.

## Proposed Design

### A. Slash Command Parsing

Add a shared parsing layer for slash commands in the AI workbench helpers.

Behavior:

- Parse the first token of the trimmed input as the slash command candidate.
- Treat the remainder after the first whitespace as user body text.
- Match commands by the first token only, not the entire input string.

Command classes:

- Action commands:
  - Example: `/clear`
  - Behavior: execute immediately and ignore any trailing body text.
- Prompt modifier commands:
  - Examples: `/plan`, `/web`, `/context`, `/schema`
  - Behavior:
    - If no body text exists, send the existing preset prompt.
    - If body text exists, compose `preset intent + user body`.

Composed prompt examples:

- `/plan`
  - Sends the original plan preset.
- `/plan 帮我分析 SSH 异常登录`
  - Sends the plan preset followed by the user request.
- `/web 搜一下宝塔近期漏洞`
  - Sends the web-search preset followed by the user request.

Send affordance changes:

- The send button should remain enabled when the input can resolve to a valid outgoing message.
- Pressing `Enter` should:
  - run the action command directly, or
  - convert the slash command to a final prompt and send it.

Shared helper target:

- `src/components/agents/WorkbenchWidgets.tsx`

Consumers expected to update:

- `src/components/agents/GeneralAgent.tsx`
- `src/components/agents/DatabaseAgent.tsx`
- `src/components/agents/GeneralInfoPanel.tsx` if it uses the same slash interaction model
- Any other panel using `getExactSlashCommand()` semantics

### B. Command Metadata And Second-Level Tabs

Extend `PluginCommand` with optional second-level metadata.

Suggested shape:

```ts
subCategory?: string;
subCategoryLabel?: string;
subCategoryLabelEn?: string;
```

This keeps existing commands valid while enabling richer grouping.

Initial grouping plan:

- `system`
  - `base`: base system info
  - `process`: process and resource overview
- `network`
  - `ports`: listening and established connections
  - `routing`: routes and DNS
- `security`
  - `persistence`: cron and service persistence
  - `auth`: auth and login logs
  - `history`: shell history and operator traces
- `web`
  - `bt`: BT panel
  - `nginx`: Nginx
  - `apache`: Apache
- `database`
  - `mysql`: MySQL or MariaDB
  - `postgres`: PostgreSQL
  - `redis`: Redis

UI design in `Dashboard`:

- Keep the left sidebar as first-level workspace navigation.
- In metrics mode, render a second-level tab strip under the page title when the active category has more than one sub-category.
- Include an `All` tab plus one tab per discovered sub-category.
- Persist the selected sub-category per first-level category in component state so switching away and back restores the last view.

Filtering model:

- Base scope: active first-level category.
- Secondary scope: selected sub-category if not `All`.
- Search term applies after category and sub-category filtering.

Animation and UI behavior:

- Use a shared animated active pill for sub-category selection.
- Add subtle hover lift and color transition on tab buttons.
- Animate card-grid changes with short fade and slight vertical motion.
- Avoid heavy layout shifts or long transitions.

### C. Empty-State And Error-State Handling

Remove the current rule that hides a card whenever its cached data contains `stderr`.

New visibility rule:

- If a command belongs to the current filtered scope, its card should remain visible.
- Card internals determine whether the content is success, loading, no output yet, or degraded/error.

Card state model:

- Not executed yet:
  - Show waiting copy such as "等待采集" / "Waiting for collection".
- Loading:
  - Show existing loading state.
- Success with stdout:
  - Render parsed or raw output normally.
- Partial or full stderr:
  - Render the card with a clear status badge and the existing helpful fallback copy.

Friendly handling remains for common environment messages:

- `No such file or directory`
- `command not found`
- `no crontab for`
- similar service-not-installed cases

The difference is that these states no longer remove the entire card from the layout.

Empty-state rules:

- No commands in current category or sub-category definition:
  - Show structural empty state.
- Commands exist but none executed yet:
  - Prefer a "等待采集" style guidance over "暂无数据".
- Commands executed but all errored:
  - Show cards with per-card errors instead of a page-level empty state.

## Data Flow

### Slash Command Flow

1. User types a slash command with optional body text.
2. Shared parser extracts `commandToken` and `bodyText`.
3. UI resolves the token against the current panel's slash command list.
4. The command either:
   - executes immediately, or
   - produces a composed prompt string.
5. The panel sends the resolved prompt through the existing conversation loop.

### Command Center Flow

1. `commands` registry provides first-level category and optional second-level metadata.
2. `Dashboard` derives available sub-categories from the active category.
3. The selected sub-category filters the visible command definitions.
4. Cached results continue to come from `CommandContext`.
5. `CommandCard` renders the appropriate result state without being filtered out due to stderr.

## File-Level Changes

### `src/plugins/types.ts`

- Add optional second-level metadata fields to `PluginCommand`.

### `src/plugins/forensics.ts`

- Annotate commands with second-level metadata.
- Keep command IDs and shell commands unchanged.

### `src/components/agents/WorkbenchWidgets.tsx`

- Replace exact-match-only helpers with token-aware parsing helpers.
- Provide a reusable resolver that returns:
  - matched command
  - body text
  - final sendable text when applicable

### `src/components/agents/GeneralAgent.tsx`

- Use the shared resolver in keyboard submit logic.
- Update button-disabled logic to allow sendable slash input.

### `src/components/agents/DatabaseAgent.tsx`

- Apply the same resolver and sendability logic for database AI commands.

### `src/components/agents/GeneralInfoPanel.tsx`

- If it uses slash-based AI submission, align it to the same shared resolver to avoid inconsistent behavior between panels.

### `src/components/Dashboard.tsx`

- Add second-level tab derivation and UI.
- Persist selection per first-level category.
- Filter by sub-category.
- Remove stderr-based card suppression.
- Refine empty-state messaging logic.

### `src/components/TaskSelectionModal.tsx`

- Optional alignment step:
  - allow grouping labels to reflect sub-categories later if desired.
- Not required for the core fix, so only touch if type changes require minimal adaptation.

## Error Handling

- Unknown slash token:
  - Keep current behavior of surfacing command suggestions via menu rather than sending raw unresolved slash input.
- Action commands with trailing text:
  - Ignore trailing text for now to keep semantics unambiguous.
- Commands lacking sub-category metadata:
  - Default them into `All` only, or a generated fallback bucket if needed.
- Mixed stdout and stderr:
  - Prefer showing stdout content while retaining stderr badge or hint.

## Testing Strategy

Manual verification is sufficient for most of this change, with targeted automated tests only if the helper extraction is isolated enough.

Recommended coverage:

- Unit-style checks for shared slash parsing helper:
  - `/plan`
  - `/plan `
  - `/plan investigate ssh`
  - `/clear`
  - unknown `/foo`
- Manual UI verification:
  - switch between first-level categories and confirm second-level tabs update
  - select a sub-category, switch to another sidebar panel, return, and confirm the same sub-category remains selected
  - confirm cards with stderr still render
  - confirm true empty scopes still show empty-state copy
  - confirm send button and `Enter` behavior in general and database AI panels

## Risks

- Slash command composition must not double-insert preset text.
- Panels that share helper functions may diverge if one still uses old exact-match logic.
- Some commands intentionally rely on stderr for useful content, so card rendering must avoid over-classifying these as failures.
- Additional sub-category labels must remain bilingual and not break existing translations.

## Recommendation

Implement the fix as a focused frontend change with shared parsing utilities and metadata-driven sub-category tabs. This resolves the user-visible issues without altering the backend or expanding the routing surface.
