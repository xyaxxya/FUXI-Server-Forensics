I will transform the placeholder `AgentPanel.tsx` into a full-featured "Batch Question Answering Panel" as requested.

### UI Structure & Features
1.  **Question Input Area**:
    - A large text area to input multiple questions (one per line).
    - An "Analyze & Add" button to parse inputs and add them to the queue.

2.  **Question Queue / Dashboard**:
    - A list/table view showing all added questions.
    - **Columns**:
        - **ID/Status**: Icons indicating Pending, Processing, Completed.
        - **Question Content**: Truncated preview.
        - **Type**: Badge showing the identified type (Basic, Database, Java JAR, Data Analysis). *Initially mocked as random/fixed.*
        - **Accuracy**: Progress bar or percentage (e.g., "95%").
        - **Actions**: "View Details" button.

3.  **Configuration Bar**:
    - Toggles for "Auto-Identify Question Type".
    - "Start Batch Processing" button to trigger the multi-threaded simulation.

4.  **Detail View (Modal or Side Panel)**:
    - When a user clicks a question, this view opens.
    - Shows full Question.
    - Shows identified **Type**.
    - **AI Answer**: The final result.
    - **Reasoning Process**: A collapsible section showing the "step-by-step thinking" (Chain of Thought).

5.  **Technical Implementation (UI Focus)**:
    - Use React State (`useState`) to manage the list of questions and their states.
    - Simulate the "multi-threading" visual effect where multiple questions switch to "Processing" state simultaneously.
    - Use Tailwind CSS for a clean, modern look consistent with the existing `GeneralAgent.tsx` style.
    - No changes to `ai.ts` logic yet (as requested), but the UI will be ready to hook into it.

### Step-by-Step Implementation
1.  **Scaffold Data Structures**: Define interfaces for `BatchQuestion` (id, content, type, status, answer, reasoning, accuracy).
2.  **Build Input Section**: Create the text area and parsing logic (split by newline).
3.  **Build Question List**: Render the questions with status badges and type indicators.
4.  **Build Controls**: Add the "Start" button and configuration toggles.
5.  **Build Detail View**: Create the overlay/modal to show the specific AI thought process for a selected question.
6.  **Simulate Workflow**: Add a temporary "mock" function to simulate the progress and completion of tasks so you can verify the UI behavior immediately.
