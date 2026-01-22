I will optimize the "General Agent" and "Main Answer Panel React Agent" to embody a "World-class Digital Forensics Expert" persona with strict operational protocols.

### 1. Optimize General Agent Prompt (`src/lib/ai.ts`)
I will update the global `SYSTEM_PROMPT` to enforce the following behaviors:
-   **Persona**: World-class Digital Forensics Expert (FUXI Server Forensics).
-   **Operational Loop**: Require a strict **"Analysis - Execution - Feedback"** cycle for every response.
    -   **Thinking (Forensic Framework)**: Analyze forensic significance and potential evidence.
    -   **Execution (Enhanced Commands)**: Use precise, non-interactive Linux commands (avoid `vi`, `top`; use `cat`, `grep`).
    -   **Feedback (Data Judgement)**: Evaluate results and determine next steps.
-   **Adaptive Routing**: Instruct the AI to dynamically adjust its analysis path based on system signatures (e.g., ThinkPHP, Docker, K8s).
-   **Safety & Pitfalls**: Explicitly warn against interactive commands, high I/O operations, and permission traps.

### 2. Optimize Agent Panel Prompt (`src/components/agents/AgentPanel.tsx`)
I will update the specialized system prompt used for batch processing to align with the expert persona while maintaining the required output format:
-   **Expertise**: Inject the same high-level forensic knowledge and safety protocols.
-   **Process**: Instruct the agent to apply the "Think-Act-Feedback" logic **during the tool execution phase** (which is visible in the "Thinking Process" UI) but keep the **Final Answer** concise and direct (as required for the batch results grid).
-   **Pitfalls**: Add specific constraints to handle "dirty" data (e.g., database encoding issues) and non-interactive shell limitations.

### Verification
-   I will verify that the new prompts are correctly integrated into the codebase.
-   (Note: I cannot interactively test the AI response quality as I am an AI myself, but I will ensure the code logic accurately reflects the requested prompt engineering structure.)
