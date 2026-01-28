I will implement the "Starry Sky Mode" by porting the reference style and logic into the current React application.

### 1. Create Starry Sky Background Component
Create `src/components/StarrySkyBackground.tsx` to implement the interactive particle star field from the reference project.
- **Logic**: Port the canvas animation loop, star generation, and mouse parallax effect from `star-background.js`.
- **Rendering**: Use a full-screen `<canvas>` element.

### 2. Create Starry Mode Theme Styles
Create `src/styles/starry-mode.css` to define the "Deep Sci-Fi Blue" theme.
- **Mechanism**: Use a `.starry-mode` class on the `<body>` tag to override global CSS variables.
- **Colors**: Map the reference colors (Deep Void `#000205`, Neon Cyan `#00f3ff`) to the project's Tailwind theme variables (`--color-surface-base`, `--color-accent`, etc.).
- **Glassmorphism**: Adjust glass panel transparency and borders to match the reference look.

### 3. Update Application Logic (`App.tsx`)
- **State Management**: Add `isStarryMode` state, persisted in `localStorage`.
- **Theme Toggle**: Add a side-effect to add/remove the `.starry-mode` class on the document body.
- **Background Switching**: Conditionally render either the new `<StarrySkyBackground />` or the existing "Cold White" gradient background based on the mode.

### 4. Add Toggle Switch in Settings (`SettingsModal.tsx`)
- **UI**: Add a new "Starry Sky Mode" (星空模式) toggle switch in the General Settings tab.
- **Icon**: Use the `Sparkles` icon to represent the mode.

### 5. Integration
- Import the new CSS file in `src/main.tsx`.
- Pass the mode state and toggle handler from `App.tsx` to `SettingsModal.tsx`.
