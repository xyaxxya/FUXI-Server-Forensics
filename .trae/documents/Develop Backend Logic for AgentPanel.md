I will implement the backend logic for the AgentPanel by integrating real AI capabilities and batch processing.

### 1. Refactor `src/lib/ai.ts`

* **Goal**: Make `sendToAI` flexible to support custom tools and context.

* **Changes**:

  * Update `sendToAI` signature to accept an optional `tools` parameter.

  * Export the `Tool` interface for use in other components.

### 2. Update `src/components/agents/AgentPanel.tsx`

* **Goal**: Replace mock logic with real AI interaction and concurrent processing.

* **Key Features**:

  * **Auto-Classification**: Implement `classifyQuestion` using `sendToAI` with a specific prompt to categorize tasks (Basic, Database, Java, DataAnalysis).

  * **Agent Loop Implementation**: Create a `processQuestion` function that replicates the "Thinking -> Tool Execution -> Observation" loop found in `GeneralAgent`.

    * It will handle `run_shell_command` tool calls by invoking the Rust backend.

    * It will maintain a conversation history for each question.

  * **Batch Processing**: Implement `startBatchProcessing` using `Promise.all` to run multiple `processQuestion` tasks concurrently (simulating multi-threading).

    * It will respect the currently selected SSH sessions (from `CommandContext`) for command execution.

  * **Detail View Integration**: Connect the interactive detail view to the real conversation history, allowing users to continue the dialogue for any specific question.

  * **State Management**: Update `BatchQuestion` state to store real accuracy (mocked or derived from AI self-eval) and full message history.

### 3. Execution Flow

1. **Input**: User enters multiple questions.
2. **Classification**: Each question is sent to AI to determine its type.
3. **Batch Start**: User clicks "Start Batch".
4. **Processing**:

   * The app spawns a "thread" (async task) for each question.

   * The AI analyzes the question and may call `run_shell_command` to inspect the server (e.g., check Java processes, query DB via CLI).

   * Tool outputs are fed back to the AI.

   * The final answer is stored.
5. **Review**: User sees the list with status/results and can click to view the full "Thinking Process" and continue asking questions.

