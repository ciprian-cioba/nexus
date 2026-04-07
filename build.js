#!/usr/bin/env node
/**
 * Build script for Nexus Arena
 * Combines modular source files into a single index.html
 */

const fs = require('fs');
const path = require('path');

// Paths
const SRC_DIR = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');
const HTML_PATH = path.join(SRC_DIR, 'index.html');
const CSS_PATH = path.join(SRC_DIR, 'styles', 'main.css');
const JS_DIR = path.join(SRC_DIR, 'js');

// File order matters! data.js must come first, then game.js, then ui.js
const JS_FILES = ['data.js', 'game.js', 'ui.js'];

console.log('🏗️  Building Nexus Arena...\n');

try {
  // Ensure dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
    console.log('✅ Created dist/ directory');
  }

  // Read HTML template
  console.log('📄 Reading src/index.html...');
  let html = fs.readFileSync(HTML_PATH, 'utf8');

  // Read and combine CSS
  console.log('🎨 Reading src/styles/main.css...');
  const css = fs.readFileSync(CSS_PATH, 'utf8');

  // Read and combine JS files in order
  console.log('📦 Combining JavaScript files:');
  let combinedJS = '';
  
  for (const fileName of JS_FILES) {
    const filePath = path.join(JS_DIR, fileName);
    console.log(`   - ${fileName}`);
    const content = fs.readFileSync(filePath, 'utf8');
    combinedJS += content + '\n';
  }

  // Replace placeholders
  console.log('🔧 Replacing placeholders...');
  html = html.replace('<!--CSS_PLACEHOLDER-->', css);
  html = html.replace('<!--JS_PLACEHOLDER-->', combinedJS);

  // Write output
  const outputPath = path.join(DIST_DIR, 'index.html');
  fs.writeFileSync(outputPath, html, 'utf8');

  console.log('\n✨ Build complete!');
  console.log(`📦 Output: ${outputPath}`);
  
  // Show file size
  const stats = fs.statSync(outputPath);
  const sizeKB = (stats.size / 1024).toFixed(2);
  console.log(`📊 Size: ${sizeKB} KB`);

} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
