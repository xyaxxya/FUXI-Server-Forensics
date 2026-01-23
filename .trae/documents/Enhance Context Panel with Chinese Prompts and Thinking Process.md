I will update the Context Panel to use Chinese prompts and display the AI's thinking process directly within the panel.

### 1. Update Prompts to Chinese (`src/components/agents/GeneralInfoPanel.tsx`)
- Translate the `prompt` strings in the `presets` array to Chinese.
  - DB: "请扫描服务器上的数据库配置..."
  - System: "请收集系统信息..."
  - Web: "请识别运行中的Web服务..."

### 2. Add Thinking Process Display (`src/components/agents/GeneralInfoPanel.tsx`)
- **State**: Add `messages` (AIMessage[]) and `status` (string) state to `GeneralInfoPanel` to track the conversation.
- **Logic**:
  - Instead of calling `onExecutePrompt` (which currently just alerts), implement a local `processConversation` logic similar to `GeneralAgent`.
  - Use `useCommandStore` to get session info.
  - Call `sendToAI` directly from `GeneralInfoPanel`.
  - Handle `tool_calls` locally (execute shell commands, update `generalInfo` via `update_context_info`).
- **UI**:
  - Add a "Thinking Process" section below the textarea.
  - Use the existing `<ThinkingProcess />` component to render the AI's steps.
  - Only show the thinking process for the *current* or *last* execution.

### 3. Refactor `GeneralInfoPanel` Props
- It needs `aiSettings` to call `sendToAI`.
- It needs `sessions`, `currentSession`, `selectedSessionIds` (via `useCommandStore`).

### Execution Plan
1.  **Modify `GeneralInfoPanel.tsx`**:
    - Update prompts to Chinese.
    - Import `ThinkingProcess`, `sendToAI`, `AIMessage`, `ThinkingStep`.
    - Implement the AI interaction loop (`handleExecutePreset` -> `processConversation`).
    - Render `<ThinkingProcess />` at the bottom.
2.  **Update `Dashboard.tsx`**:
    - Pass `aiSettings` to `<GeneralInfoPanel />`.
