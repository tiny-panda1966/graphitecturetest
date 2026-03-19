#!/usr/bin/env node
/**
 * extract.js
 * Run: node extract.js <path-to-picker.html>
 *
 * Splits the monolithic picker.html into:
 *   dist/css/fonts.css, base.css, layout.css, sections.css, components.css, new-components.css
 *   dist/js/utils/helpers.js, messaging.js
 *   dist/js/state.js
 *   dist/js/sections/section1..6, section51
 *   dist/js/components/sizeGuidePopup.js, colourEffects.js, uploadButton.js
 *   dist/js/app.js
 *   dist/picker.html  (thin shell)
 */

const fs   = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────

const INPUT  = process.argv[2] || 'picker.html';
const OUTDIR = process.argv[3] || 'dist';

// CSS sections — in order they appear in the file
// key = marker text inside /* === ... === */,  value = output file
const CSS_SECTIONS = {
  'fonts (base64 embedded)' : 'css/fonts.css',
  'css/base.css'            : 'css/base.css',
  'css/layout.css'          : 'css/layout.css',
  'css/sections.css'        : 'css/sections.css',
  'css/components.css'      : 'css/components.css',
  'css/new-components.css'  : 'css/new-components.css',
};

// JS sections — in order they appear in the file
const JS_SECTIONS = {
  'js/utils/helpers.js'            : 'js/utils/helpers.js',
  'js/utils/messaging.js'          : 'js/utils/messaging.js',
  'js/state.js'                    : 'js/state.js',
  'js/sections/section1.js'        : 'js/sections/section1.js',
  'js/sections/section2.js'        : 'js/sections/section2.js',
  'js/sections/section3.js'        : 'js/sections/section3.js',
  'js/sections/section4.js'        : 'js/sections/section4.js',
  'js/sections/section5.js'        : 'js/sections/section5.js',
  'js/sections/section51.js'       : 'js/sections/section51.js',
  'js/sections/section6.js'        : 'js/sections/section6.js',
  'js/components/sizeGuidePopup.js': 'js/components/sizeGuidePopup.js',
  'js/components/colourEffects.js' : 'js/components/colourEffects.js',
  'js/components/uploadButton.js'  : 'js/components/uploadButton.js',
  'js/app.js'                      : 'js/app.js',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mkdir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function write(relPath, content) {
  const full = path.join(OUTDIR, relPath);
  mkdir(full);
  fs.writeFileSync(full, content.trim() + '\n', 'utf8');
  const lines = content.trim().split('\n').length;
  console.log(`  ✓  ${relPath.padEnd(45)} ${lines} lines`);
}

// ─── Parse ───────────────────────────────────────────────────────────────────

const src   = fs.readFileSync(INPUT, 'utf8');
const lines = src.split('\n');

// Find line indices for every CSS and JS marker
const cssMarkers = {}; // markerKey → line index
const jsMarkers  = {};

lines.forEach((line, i) => {
  for (const key of Object.keys(CSS_SECTIONS)) {
    if (line.includes(`/* === ${key} === */`)) cssMarkers[key] = i;
  }
  for (const key of Object.keys(JS_SECTIONS)) {
    // helpers sits inside the <script> tag block with extra indent
    if (line.includes(`// === ${key} ===`)) jsMarkers[key] = i;
  }
});

const cssKeys = Object.keys(CSS_SECTIONS);
const jsKeys  = Object.keys(JS_SECTIONS);

// Verify all markers found
const missingCss = cssKeys.filter(k => cssMarkers[k] === undefined);
const missingJs  = jsKeys.filter(k => jsMarkers[k]  === undefined);
if (missingCss.length) console.warn('⚠  Missing CSS markers:', missingCss);
if (missingJs.length)  console.warn('⚠  Missing JS markers:',  missingJs);

// Extract lines between consecutive markers (exclusive of marker line itself)
function extractBetween(markerLineIndex, nextMarkerLineIndex) {
  // skip the marker line itself, take up to (not including) next marker
  return lines.slice(markerLineIndex + 1, nextMarkerLineIndex).join('\n');
}

// ─── Extract CSS ─────────────────────────────────────────────────────────────

// The CSS block ends at </style>
const styleEndLine = lines.findIndex(l => l.trim() === '</style>');

console.log('\n── CSS ─────────────────────────────────────────────');
cssKeys.forEach((key, i) => {
  const start = cssMarkers[key];
  if (start === undefined) return;
  const nextKey  = cssKeys[i + 1];
  const end      = nextKey && cssMarkers[nextKey] !== undefined
    ? cssMarkers[nextKey]
    : styleEndLine;
  write(CSS_SECTIONS[key], extractBetween(start, end));
});

// ─── Extract JS ──────────────────────────────────────────────────────────────

// The JS block ends at </script>
const scriptEndLine = lines.slice(0).reverse().findIndex(l => l.trim() === '</script>');
const scriptEnd = lines.length - 1 - scriptEndLine;

console.log('\n── JS ──────────────────────────────────────────────');
jsKeys.forEach((key, i) => {
  const start = jsMarkers[key];
  if (start === undefined) return;
  const nextKey  = jsKeys[i + 1];
  const end      = nextKey && jsMarkers[nextKey] !== undefined
    ? jsMarkers[nextKey]
    : scriptEnd;
  write(JS_SECTIONS[key], extractBetween(start, end));
});

// ─── Extract HTML body ───────────────────────────────────────────────────────

const bodyStart = lines.findIndex(l => l.trim() === '</head>') + 1; // start of <body>
const scriptTagLine = lines.slice(0).findIndex((l, i) => i > styleEndLine && l.trim() === '<script>');
// find the <script> tag that precedes our JS
const scriptOpenLine = lines.findIndex((l, i) => i > styleEndLine && l.trim() === '<script>');

const bodyHtml = lines.slice(bodyStart, scriptOpenLine).join('\n');

// ─── Write thin picker.html ───────────────────────────────────────────────────

const cssLinks = Object.values(CSS_SECTIONS)
  .map(f => `    <link rel="stylesheet" href="${f}">`)
  .join('\n');

const jsScripts = Object.values(JS_SECTIONS)
  .map(f => `    <script src="${f}"></script>`)
  .join('\n');

// Extract <head> content before <style> (meta tags, google font links)
const headStart = lines.findIndex(l => l.trim() === '<head>') + 1;
const styleOpenLine = lines.findIndex(l => l.trim() === '<style>');
const headMeta = lines.slice(headStart, styleOpenLine).join('\n');

const shell = `<!DOCTYPE html>
<html lang="en">
<head>
${headMeta}
${cssLinks}
</head>
${bodyHtml}
${jsScripts}
</body>
</html>
`;

console.log('\n── Shell ────────────────────────────────────────────');
const shellPath = path.join(OUTDIR, 'picker.html');
mkdir(shellPath);
fs.writeFileSync(shellPath, shell, 'utf8');
console.log(`  ✓  picker.html`);

console.log('\n✅  Done. Files written to:', path.resolve(OUTDIR));
