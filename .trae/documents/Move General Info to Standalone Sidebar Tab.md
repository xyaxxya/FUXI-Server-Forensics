I will move the "General Info" module to a standalone tab in the sidebar, making it a first-class feature alongside General Agent and Batch Agent.

### 1. Update Translations (`src/translations.ts`)
- Add a new translation key for the sidebar menu item: `agent_context`.

### 2. Update Sidebar (`src/components/Sidebar.tsx`)
- Add a new menu item to the "Agent" group:
  - **ID**: `agent-context`
  - **Icon**: `FileText` (or similar)
  - **Label**: `agent_context`

### 3. Update Dashboard (`src/components/Dashboard.tsx`)
- **State Management**: Lift the `generalInfo` state from `GeneralAgent` to `Dashboard` (or `useCommandStore`) so it can be shared between the new Context tab and the General Agent.
  - *Decision*: Since `GeneralAgent` currently holds the state, I'll move it to `Dashboard` and pass it down as props to both `GeneralAgent` and the new `ContextPanel`.
- **New View**: Add a new view container for the Context Panel, visible when `activeTab === 'agent-context'`.
  - Render `GeneralInfoPanel` in this container.
- **Pass Props**: Update `<GeneralAgent />` usage to accept `generalInfo` and `setGeneralInfo` props (instead of managing it internally).

### 4. Refactor General Agent (`src/components/agents/GeneralAgent.tsx`)
- Remove internal `generalInfo` state.
- Accept `generalInfo` via props.
- Remove the "Info" toggle button and the inline panel (since it's now a standalone tab).
- *Keep* the logic that injects `generalInfo` into the AI prompt.

### 5. Refactor General Info Panel (`src/components/agents/GeneralInfoPanel.tsx`)
- Adjust styling if necessary to fit the full-page layout (it's already a panel, so it should adapt well).
- Ensure it takes up the full height/width of the new tab view.

### Execution Steps
1.  **Refactor GeneralAgent**: Modify it to accept `generalInfo` as a prop and remove internal UI.
2.  **Update Dashboard**: Manage `generalInfo` state here. Render `GeneralInfoPanel` in a new tab view.
3.  **Update Sidebar**: Add the navigation item.
4.  **Update Translations**: Add the menu label.
