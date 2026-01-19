I will refactor the `ServerSidebar` component to implement the "Clean Tech" design style and fix the server switching functionality.

### **Refactor Plan**

1.  **Design Overhaul ("Clean Tech" Style)**
    *   **Visual Style:** Switch from dark "Cyberpunk" to a light, airy "Clean Tech" aesthetic.
        *   **Backgrounds:** Use `bg-slate-50/80` and `bg-white/60` with `backdrop-blur` for the frosted glass effect.
        *   **Colors:** Primary text in `slate-700`, secondary in `slate-500`. Accents in `blue-500` and `cyan-500` but with softer, cleaner gradients.
        *   **Borders:** Subtle `border-white/40` or `border-blue-100` instead of neon glows.
    *   **Animations:**
        *   **Shimmer:** Add a light-sweeping effect on hover using CSS gradients.
        *   **Pulse:** Add breathing animations for online status indicators.
        *   **BorderGlow:** Implement a subtle gradient border transition for the active state.
        *   **SlideIn:** Ensure list items enter smoothly with `framer-motion`.
        *   **Hover Feedback:** Add `scale(1.02)` and increased shadow on hover to create a "floating" feel.

2.  **Functionality Fixes**
    *   **Event Handling:** Simplify and verify the `handleSessionClick` logic to ensure `switchSession` is called reliably.
    *   **State Feedback:** Ensure the UI immediately reflects the clicked state while the backend switch is processing (optimistic UI update).
    *   **Visual Feedback:** Add a clear loading state or transition indicator on the card itself when switching.

3.  **Implementation Steps**
    *   **Step 1:** Modify `src/components/ServerSidebar.tsx` to replace the entire CSS/Tailwind class set with the new "Clean Tech" system.
    *   **Step 2:** Refactor `ServerCard` sub-component to implement the specific animations (Shimmer, Pulse, etc.).
    *   **Step 3:** Verify `handleSessionClick` logic and ensure it correctly invokes `switchSession` from the store.
    *   **Step 4:** Clean up any unused "Cyberpunk" assets or classes.

### **Verification**
*   **Visual Check:** Confirm the sidebar looks "Clean Tech" (light, frosted, animated).
*   **Functional Check:** Verify that clicking a server card *immediately* highlights it and triggers the server switch.
*   **Animation Check:** Verify shimmer, pulse, and hover effects work as described.
