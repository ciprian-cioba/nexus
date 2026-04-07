# File Organization Map

This document shows what content from the original `nexus_arena.html` went into each modular file.

## Original File Line Ranges

**Original file:** `nexus_arena.html` (2075 lines total)

### Extracted to `src/styles/main.css`
- **Lines 8-234:** All CSS (between `<style>` tags)
- Includes:
  - Font imports
  - CSS variables
  - All component styles (header, cards, buttons, modals, etc.)
  - Animations
  - Responsive styles

### Extracted to `src/js/data.js`
- **Lines 388-469:** Constants and data structures
  - `KEY`, `CFG_KEY`, `SESS`, `NSLOTS`, `DEF_K`
  - `sleep` function
  - `DEF_CFG` - Default configuration object
  - `BD` - Buff/debuff definitions
  - `INTENTS` - Enemy intent types
  - `LOADOUTS` - Hero class definitions (Paladin, Slayer, Warden)
  - `SKILLS` - Skill definitions
  - `STAT_COL`, `STAT_ICON` - UI color/icon mappings
  - `statTag` helper function
- **Lines 2053-2070:** `DEMO_SAVE` - Demo session data

### Extracted to `src/js/game.js`
- **Lines 471-2051:** The complete `Arena` class
  - Constructor and initialization
  - State management (save/load)
  - Combat system
  - Enemy AI
  - Skill execution
  - Buff/debuff system
  - Shop and inventory
  - Training and forging
  - UI rendering methods
  - All game logic

### Created `src/js/ui.js`
- **New file:** Global initialization
  - Instantiates `const G = new Arena()`
  - Exposes `window.G = G` for global access
  - Required for inline onclick handlers like `onclick="G.battle()"`

### Extracted to `src/index.html`
- **Lines 1-6:** HTML doctype, head opening, meta tags
- **Placeholder:** `<!--CSS_PLACEHOLDER-->` (replaces lines 7-235)
- **Lines 236-386:** Full HTML body structure
  - Header with resources
  - Main view area
  - Player/enemy cards
  - DPS meters
  - Tabs (Gear, Shop, Train, Stats, Log)
  - Controls (fight button, skill bars)
  - Modal overlay
- **Placeholder:** `<!--JS_PLACEHOLDER-->` (replaces lines 387-2073)
- **Closing tags:** `</body></html>`

## Build Process

The `build.js` script:
1. Reads `src/index.html` template
2. Reads `src/styles/main.css`
3. Reads and concatenates JS files in order:
   - `src/js/data.js` (constants first)
   - `src/js/game.js` (Arena class)
   - `src/js/ui.js` (initialization last)
4. Replaces `<!--CSS_PLACEHOLDER-->` with CSS content
5. Replaces `<!--JS_PLACEHOLDER-->` with combined JS
6. Writes `dist/index.html`

## Key Preservation Rules

### ✅ Logic Preserved
- No game logic was changed
- All formulas, calculations, and mechanics are identical
- Combat system untouched
- AI behavior unchanged

### ✅ Global Scope Maintained
- `G` object remains globally accessible via `window.G`
- Inline handlers (`onclick="G.method()"`) work as before
- All constants available to game.js

### ✅ Asset Management
- All SVG/Base64 images remain embedded
- No external asset dependencies
- Single-file output maintained

## Verification

To verify the modular version matches the original:

1. **Build the project:**
   ```bash
   node build.js
   ```

2. **Compare file sizes:**
   - Original should be ~103-105 KB
   - Built version should be similar (within 1-2 KB)

3. **Test functionality:**
   - Open `dist/index.html` in browser
   - Create a character
   - Fight enemies
   - Test shop, training, saving/loading
   - Verify all buttons and features work

4. **Check console:**
   - No JavaScript errors should appear
   - All onclick handlers should work
   - Game state should save/load correctly

## File Dependencies

```
data.js
  ↓ (provides constants to)
game.js
  ↓ (Arena class used by)
ui.js
  ↓ (creates global G)
(HTML handlers reference G)
```

This order is enforced in `build.js` to ensure proper loading.
