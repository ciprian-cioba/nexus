# Nexus Arena - Modular Project Structure

This repository contains the modularized version of Nexus Arena, a browser-based RPG combat game.

## 📁 Project Structure

```
nexus-arena-modular/
├── src/
│   ├── index.html          # HTML skeleton with placeholders
│   ├── styles/
│   │   └── main.css        # All game styles
│   └── js/
│       ├── data.js         # Constants (SKILLS, LOADOUTS, etc.)
│       ├── game.js         # Arena class (core game logic)
│       └── ui.js           # Global initialization
├── dist/
│   └── index.html          # Built single-file game (generated)
├── build.js                # Build script
├── .gitlab-ci.yml          # CI/CD configuration
└── package.json            # NPM scripts
```

## 🚀 Quick Start

### Build the Game Locally

```bash
# Run the build script
node build.js

# The compiled game will be in dist/index.html
# Open it in your browser
```

### Using NPM Scripts

```bash
# Install dependencies (none required, but npm available)
npm install

# Build
npm run build

# Build and serve locally (requires http-server)
npm start
```

## 🔧 Development Workflow

1. **Edit source files** in `src/`:
   - `src/index.html` - HTML structure
   - `src/styles/main.css` - Styles
   - `src/js/data.js` - Game data constants
   - `src/js/game.js` - Core game logic
   - `src/js/ui.js` - Initialization

2. **Build** to combine files:
   ```bash
   node build.js
   ```

3. **Test** by opening `dist/index.html` in your browser

## 🔄 How the Build Works

The build script (`build.js`):
1. Reads `src/index.html` template
2. Reads `src/styles/main.css`
3. Combines JS files in order: `data.js` → `game.js` → `ui.js`
4. Replaces `<!--CSS_PLACEHOLDER-->` with CSS content
5. Replaces `<!--JS_PLACEHOLDER-->` with combined JS
6. Outputs to `dist/index.html`

## 🌐 GitLab Pages Deployment

The project includes `.gitlab-ci.yml` for automatic deployment:

1. **Push to GitLab** - Any push to `main` or `master` branch
2. **Auto-build** - Pipeline runs `node build.js`
3. **Auto-deploy** - Compiled `dist/` folder deploys to GitLab Pages

Your game will be available at: `https://[username].gitlab.io/[project-name]/`

## ⚠️ Important Notes

### Global Scope
The game uses inline `onclick="G.method()"` handlers, so the `G` object must be globally accessible:
- `ui.js` contains: `const G = new Arena(); window.G = G;`
- This ensures handlers work after concatenation

### File Order
JS files must load in this order:
1. `data.js` - Defines constants used by game logic
2. `game.js` - Defines Arena class
3. `ui.js` - Instantiates G globally

The build script enforces this order.

### Assets
All SVG/Base64 images remain embedded in CSS/JS as in the original file.

## 📝 Modifying the Game

### Adding New Skills
Edit `src/js/data.js`:
```javascript
const SKILLS = {
  // Add your skill here
  newskill: {icon:'✨', label:'NEW', cd:'ns', eCfg:'eNew', key:'7', offgcd:false},
  // ...
}
```

### Adjusting Styles
Edit `src/styles/main.css` - changes apply to all UI elements.

### Changing Game Logic
Edit `src/js/game.js` - the Arena class contains all game mechanics.

## 🛠️ Troubleshooting

**Build fails:**
- Ensure Node.js is installed (`node --version`)
- Check that all source files exist
- Verify file paths in `build.js`

**Game doesn't work after build:**
- Check browser console for errors
- Verify `dist/index.html` contains both CSS and JS
- Ensure placeholders were replaced

**GitLab Pages not deploying:**
- Check CI/CD pipeline status in GitLab
- Verify `.gitlab-ci.yml` is in repository root
- Ensure branch name matches (main/master)

## 📦 Distribution

To distribute the game:
1. Build: `node build.js`
2. Share: `dist/index.html` (single self-contained file)

Players only need a modern browser - no server required!
