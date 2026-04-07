# Development Guide

This guide helps you develop Nexus Arena efficiently in its modular structure.

## Quick Reference

### Common Tasks

**Build the game:**
```bash
node build.js
```

**Watch mode (auto-rebuild on changes):**
```bash
npm run watch
# Requires: npm install --save-dev nodemon
```

**Build and serve locally:**
```bash
npm start
# Requires: npm install --save-dev http-server
# Opens at http://localhost:8080
```

## File Responsibilities

### `src/js/data.js` - Game Data
**Contains:** All constant data that doesn't change during gameplay

**Edit this file to:**
- Add new skills (`SKILLS` object)
- Add new hero classes (`LOADOUTS` object)
- Modify enemy intents (`INTENTS` object)
- Change buff/debuff definitions (`BD` object)
- Adjust default configuration (`DEF_CFG` object)
- Update demo save data (`DEMO_SAVE` object)

**Example - Adding a new skill:**
```javascript
const SKILLS = {
  // ... existing skills ...
  
  newskill: {
    icon: '⚡',
    label: 'NEWSKILL',
    cd: 'nw',       // Cooldown key in state.cds
    eCfg: 'eNew',   // Energy cost key in cfg
    key: '8',       // Keyboard shortcut
    offgcd: false   // Whether it's off global cooldown
  },
};
```

### `src/js/game.js` - Game Logic
**Contains:** The `Arena` class with all game mechanics

**Edit this file to:**
- Modify combat calculations
- Change enemy AI behavior
- Adjust damage formulas
- Update shop/inventory logic
- Modify save/load system
- Change rendering methods
- Adjust skill execution logic

**Key methods:**
- `battle()` - Start a fight
- `pressSkill(id)` - Execute a skill
- `_aiTick()` - Enemy AI decision making
- `dmg(amt, src, side)` - Apply damage
- `win()` / `lose()` - Combat end
- `render()` - Update UI

**Example - Modifying damage calculation:**
```javascript
// Find the dmg method in Arena class
dmg(amt, src, side) {
  // Your custom damage formula here
  const finalDamage = Math.floor(amt * 1.5); // Example: 50% more damage
  // ... rest of method
}
```

### `src/js/ui.js` - Initialization
**Contains:** Global game instance creation

**Edit this file to:**
- Add global helper functions
- Initialize additional systems
- Set up global event listeners

**Note:** Keep this file minimal. Most logic belongs in `game.js`.

### `src/styles/main.css` - Styling
**Contains:** All visual styling

**Edit this file to:**
- Change colors/themes
- Adjust layouts
- Modify animations
- Update responsive styles
- Add new component styles

**Example - Changing theme colors:**
```css
:root {
  --bg: #05070a;      /* Background */
  --prim: #3b82f6;    /* Primary (blue) */
  --sec: #a855f7;     /* Secondary (purple) */
  --good: #10b981;    /* Good/health (green) */
  --bad: #ef4444;     /* Bad/damage (red) */
  --warn: #f59e0b;    /* Warning (orange) */
  /* Change these to retheme the game */
}
```

### `src/index.html` - Structure
**Contains:** HTML structure and layout

**Edit this file to:**
- Add new UI sections
- Modify layout structure
- Add new tabs or panels
- Change header/footer

**⚠️ Important:** Keep `onclick` handlers inline - they reference the global `G` object.

## Development Workflow

### 1. Setup
```bash
cd nexus-arena-modular
# Optional: npm install (for watch mode & local server)
```

### 2. Make Changes
Edit files in `src/`:
- `src/js/data.js` - Game data
- `src/js/game.js` - Game logic
- `src/js/ui.js` - Initialization
- `src/styles/main.css` - Styles
- `src/index.html` - Structure

### 3. Build
```bash
node build.js
```

### 4. Test
Open `dist/index.html` in your browser

### 5. Debug
- Use browser DevTools console
- Check for JavaScript errors
- Verify game state in localStorage
- Use `G.state` in console to inspect game state

## Common Modifications

### Adding a New Hero Class

**In `src/js/data.js`:**
```javascript
const LOADOUTS = {
  // ... existing classes ...
  
  Ranger: {
    row1: ['hvy', 'stn', 'blk', 'fo'],
    row2: ['ra', 'po', 'mend'],
    passive: 'Swift Shot: +15% ACC · +10% EVA · Attacks 20% faster',
    passiveKey: 'ranger',
    color: '#84cc16',
    baseStats: { hp: 320, atk: 42, def: 14 }
  }
};
```

**In `src/js/game.js`:**
Add passive logic in relevant methods (e.g., `getStats()`, skill execution).

### Adding Configuration Options

**In `src/js/data.js`:**
```javascript
const DEF_CFG = {
  // ... existing config ...
  myNewSetting: 100,  // Add new setting
};
```

**In `src/js/game.js`:**
Reference it as `this.cfg.myNewSetting`

**In editor UI:**
Add to `openEditor()` method to make it editable.

### Modifying Combat Formulas

**In `src/js/game.js`, find the relevant method:**
```javascript
// Example: Modify crit damage
const critMult = (this.state.p.n === 'Slayer') 
  ? this.cfg.multSlayerCrit 
  : this.cfg.multCrit;

// Change to:
const critMult = this.cfg.multCrit * 1.5; // 50% more crit damage
```

### Adding New Visual Effects

**In `src/styles/main.css`:**
```css
/* Add new animation */
@keyframes my-effect {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

/* Apply to class */
.my-class {
  animation: my-effect 0.5s ease-in-out;
}
```

**In `src/js/game.js`:**
```javascript
// Add/remove class to trigger animation
element.classList.add('my-class');
setTimeout(() => element.classList.remove('my-class'), 500);
```

## Debugging Tips

### Check Build Output
```bash
# See what's in the built file
head -50 dist/index.html  # CSS section
tail -50 dist/index.html  # JS section
```

### Inspect Game State
Open browser console:
```javascript
// View current state
console.log(G.state);

// View player stats
console.log(G.getStats());

// Check config
console.log(G.cfg);

// Manually trigger actions
G.battle();
G.pressSkill('hvy');
```

### Test Specific Features
```javascript
// In browser console:

// Give resources
G.state.gd = 10000;  // Gold
G.state.tp = 100;    // Trophies
G.render();

// Level up
G.state.lv = 10;
G.state.xp = 0;
G.render();

// Add items
G.state.inv.push({
  n: 'Test Weapon',
  s: 'Weapon',
  r: 2,
  lv: 5,
  atk: 50,
  hp: 100
});
G.render();
```

## Performance Tips

### Build Speed
- The build is fast (~0.1 seconds)
- Use watch mode for continuous development
- No minification needed for development

### File Sizes
- Keep images as Base64/SVG (already embedded)
- CSS is already minified (compressed syntax)
- JS is readable for development

### Browser Testing
- Test in Chrome/Edge (main target)
- Check Firefox compatibility
- Test mobile Safari (iOS)
- Verify touch controls work

## GitLab CI/CD

### Pipeline Triggers
Pushes to these branches trigger build+deploy:
- `main`
- `master`
- `develop`

### Pipeline Stages
1. **Build:** Runs `node build.js`
2. **Deploy:** Copies `dist/` to `public/` for Pages

### Local Testing Before Push
```bash
# Simulate CI build
node build.js
ls -lh dist/

# Test the built file locally
# (open in browser or use http-server)
```

## Troubleshooting

### Build Fails
**Error:** `Cannot find module`
- Check file paths in `build.js`
- Ensure all source files exist

**Error:** `ENOENT: no such file or directory`
- Verify directory structure matches expected layout

### Game Doesn't Work
**Blank page:**
- Check browser console for errors
- Verify `dist/index.html` has both CSS and JS

**`G is not defined`:**
- Check that `ui.js` is included last
- Verify `window.G = G` exists in built file

**Styles missing:**
- Check CSS was injected (view page source)
- Verify CSS placeholder was replaced

### Features Broken
**Saves not working:**
- Check localStorage in DevTools
- Verify save keys haven't changed
- Test in incognito (rules out bad saved data)

**Skills not executing:**
- Check console for errors in skill methods
- Verify skill IDs match between data.js and game.js
- Check energy costs and cooldowns

## Best Practices

1. **Always build before testing** - Source files don't run directly
2. **Test after each change** - Catch issues early
3. **Use browser DevTools** - Essential for debugging
4. **Backup saves** - Export session before major changes
5. **Commit often** - Small commits are easier to debug
6. **Document changes** - Update README if adding features

## Next Steps

- Add new hero classes
- Create new enemy types
- Design additional equipment
- Implement new skill mechanics
- Add visual effects
- Optimize balance

Happy developing! 🎮
