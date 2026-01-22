I will implement the "General Information" module to allow users to inject custom context into the AI's prompt.

### 1. Translations (`src/translations.ts`)
- Add translation keys for the new module:
  - `general_info`: "General Info" / "通用信息"
  - `general_info_placeholder`: Placeholder text for the input area.
  - `general_info_desc`: Description explaining that this info is added to the system prompt.

### 2. AI Logic (`src/lib/ai.ts`)
- Update `sendToAI` function to accept an optional `generalInfo` parameter.
- Inject the provided `generalInfo` into the system prompt.
  - It will be appended with a clear header like `**User Provided General Info**` to ensure the AI understands it as context.

### 3. General Agent UI (`src/components/agents/GeneralAgent.tsx`)
- **State Management**: Add `generalInfo` state to store user input.
- **Header Action**: Add an "Info" (ℹ️) button in the agent header to toggle the input area.
- **Input Area**: Create a collapsible text area below the header where users can input server details (credentials, environment info, etc.).
- **Integration**: Pass the `generalInfo` content to the `processConversation` and `sendToAI` functions so it's included in every request.
