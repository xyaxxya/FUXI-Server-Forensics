I will fix the issue where clicking the newly added server in the sidebar does not update the active highlight.

### **The Problem**
The previous fix changed `ServerSidebar` to rely solely on `currentSession?.id === session.id` for highlighting. However, in `CommandContext.tsx`, the `switchSession` function updates `currentSession` based on a lookup in the `sessions` state. Due to React closure behavior, the `sessions` variable inside `switchSession` might be stale (from the previous render), especially right after adding a new server. This can cause the lookup to fail or return an old object, preventing `currentSession` from updating immediately.

On the other hand, `switchSession` *does* successfully update the `sessions` list using a functional update: `setSessions(prev => prev.map(...))`. This means the `is_current` property on the session objects inside the `sessions` array is updated correctly and immediately.

### **The Fix**
1.  **Revert `ServerSidebar` Logic:** Change the `isActive` prop in `ServerSidebar.tsx` to prioritize `session.is_current`. This property is updated via the optimistic `setSessions` call in `switchSession`, making it the most reliable and immediate indicator of the active state.
    *   **New Logic:** `isActive={session.is_current || currentSession?.id === session.id}`. This ensures that if *either* the list update happens first OR the global `currentSession` update happens first, the UI will reflect the change instantly.

2.  **Robustify `CommandContext`:** Improve `switchSession` in `CommandContext.tsx` to ensure `currentSession` is updated even if the `sessions` lookup fails. We can optimistically construct the new `currentSession` object if we know the ID, or fetch the latest object from the functional update of `setSessions`.

### **Implementation Steps**
1.  **Modify `src/components/ServerSidebar.tsx`**:
    *   Update the `isActive` prop logic for `ServerCard`.
2.  **Modify `src/store/CommandContext.tsx`**:
    *   In `switchSession`, ensure `currentSession` is updated more reliably.

### **Verification**
*   **Visual Check:** Clicking any server in the sidebar should *instantly* change its style to the "Active" state (highlighted border, glowing indicator).
*   **Functional Check:** The dashboard data should refresh immediately upon switching (already fixed in previous step, but will double-check).
