#!/usr/bin/env node
/**
 * Verver Sport Picker — Build Script
 * Composites all src/ files into a single dist/picker.html for Wix iFrame embedding.
 * Usage: node build.js [--watch]
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');

const CSS_FILES = [
    'css/base.css',
    'css/layout.css',
    'css/sections.css',
    'css/components.css',
    'css/new-components.css'
];

const JS_FILES = [
    'js/utils/helpers.js',
    'js/utils/messaging.js',
    'js/state.js',
    'js/sections/section1.js',
    'js/sections/section2.js',
    'js/sections/section3.js',
    'js/sections/section4.js',
    'js/sections/section5.js',
    'js/sections/section51.js',
    'js/sections/section6.js',
    'js/components/sizeGuidePopup.js',
    'js/components/colourEffects.js',
    'js/components/uploadButton.js',
    'js/app.js'
];

// Font name mapping: filename (no ext) → CSS font-family name used in JS
const FONTS = [
    { file: 'fonts/Dynamo_Regular.ttf',  family: 'Dynamo',        format: 'truetype' },
    { file: 'fonts/Sportzan.ttf',        family: 'Sportzan',      format: 'truetype' },
    { file: 'fonts/hyperwave-one.ttf',   family: 'Hyperwave One', format: 'truetype' },
    { file: 'fonts/Vampire_Wars.otf',    family: 'Vampire Wars',  format: 'opentype' },
    { file: 'fonts/CSRockyRegular.otf',  family: 'CS Rocky',      format: 'opentype' },
];

function buildFontCSS() {
    return FONTS.map(({ file, family, format }) => {
        const full = path.join(SRC, file);
        if (!fs.existsSync(full)) {
            console.warn(`⚠️  Font missing: ${file}`);
            return '';
        }
        const b64 = fs.readFileSync(full).toString('base64');
        const mime = format === 'opentype' ? 'font/otf' : 'font/ttf';
        const kb = (fs.statSync(full).size / 1024).toFixed(1);
        console.log(`   ↳ Embedding ${family} (${kb} KB)`);
        return `@font-face { font-family: '${family}'; src: url('data:${mime};base64,${b64}') format('${format}'); font-weight: normal; font-style: normal; font-display: block; }`;
    }).join('\n');
}

function readFile(rel) {
    const full = path.join(SRC, rel);
    if (!fs.existsSync(full)) {
        console.warn(`⚠️  Missing: ${rel}`);
        return `/* FILE NOT FOUND: ${rel} */`;
    }
    return fs.readFileSync(full, 'utf8');
}

function build() {
    console.log('🔨 Building picker.html...');
    const shell = readFile('html/index.html');
    const fontCss = buildFontCSS();
    const css = CSS_FILES.map(f => `/* === ${f} === */\n${readFile(f)}`).join('\n\n');
    const js = JS_FILES.map(f => `// === ${f} ===\n${readFile(f)}`).join('\n\n');

    let output = shell
        .replace('/* __CSS_INJECT__ */', `/* === fonts (base64 embedded) === */\n${fontCss}\n\n${css}`)
        .replace('/* __JS_INJECT__ */', js);

    if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
    fs.writeFileSync(path.join(DIST, 'picker.html'), output, 'utf8');
    const kb = (Buffer.byteLength(output, 'utf8') / 1024).toFixed(1);
    console.log(`✅ Built: dist/picker.html (${kb} KB)`);
}

build();

if (process.argv.includes('--watch')) {
    console.log('👁️  Watching for changes...');
    fs.watch(SRC, { recursive: true }, (ev, file) => {
        if (file && !file.startsWith('.')) { console.log(`\n📝 Changed: ${file}`); build(); }
    });
}