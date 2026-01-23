I will upgrade the "General Info" module to a full-featured Context Management Panel.

### 1. New Tool: `update_context_info` (`src/lib/ai.ts`)
- Add a new tool definition in `defaultTools`.
- **Name**: `update_context_info`
- **Description**: "Save important server information (e.g., credentials, environment details) to the General Info context for future reference."
- **Parameters**: `info` (string) - The information to save.

### 2. New Component: `GeneralInfoPanel` (`src/components/agents/GeneralInfoPanel.tsx`)
- Create a new component to replace the simple textarea.
- **Features**:
  - **Context Editor**: Large textarea for viewing/editing the current context.
  - **Quick Actions (The "Buttons")**: A grid of buttons that trigger AI tasks.
    - "Auto-detect Database Info"
    - "Auto-detect System Info"
    - "Auto-detect Web Services"
  - **User Presets**: Allow users to add their own custom prompt buttons.
- **Styling**: Use a nice card/panel design (similar to the user's selected `div`).

### 3. Integration (`src/components/agents/GeneralAgent.tsx`)
- **State Handling**:
  - Handle the `update_context_info` tool call. When the AI calls this tool, append the `info` to the `generalInfo` state automatically.
- **UI Update**:
  - Replace the current expandable "Info" section with a more prominent entry point or render the `GeneralInfoPanel` as a drawer/modal.
  - For now, I'll keep the toggle button but make the expanded area much richer using the new component.

### 4. Translations (`src/translations.ts`)
- Add labels for the new buttons and features.

### Execution Flow for "Auto-detect"
1. User clicks "Auto-detect Database Info".
2. `GeneralAgent` sends a hidden prompt to AI: *"Please scan the server for database configurations... If found, call the `update_context_info` tool to save them."*
3. AI executes shell commands (`find`, `grep`, etc.).
4. AI analyzes output.
5. AI calls `update_context_info` with the credentials.
6. `GeneralAgent` intercepts the tool call and updates the `generalInfo` text box.
7. User sees the info appear in the box!
