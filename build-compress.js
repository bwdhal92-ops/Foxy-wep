const Terser = require('terser');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');

const JS_SRC = 'assets/js';
const CSS_SRC = 'assets/css';
const DIST = 'dist/web';

const PASSTHROUGH_JS = ['assets/js/workers', 'assets/js/libs'];

function getAllJSFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...getAllJSFiles(full));
    else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

async function minifyJS() {
  const files = getAllJSFiles(JS_SRC).filter(
    (f) => !PASSTHROUGH_JS.some((p) => f.replace(/\\/g, '/').startsWith(p.replace(/\\/g, '/') + '/'))
  );
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    const isModule = /\b(import|export)\b/.test(code);
    try {
      const result = await Terser.minify(code, {
        compress: { drop_console: true, drop_debugger: true, passes: 2, pure_funcs: ['console.log', 'console.warn', 'console.debug'] },
        output: { comments: false },
        mangle: { reserved: ['$', 'jQuery'] },
        module: isModule
      });
      if (result.error) { console.error(`[ERROR] ${file}: ${result.error}`); continue; }
      const outPath = path.join(DIST, file);
      fs.ensureDirSync(path.dirname(outPath));
      fs.writeFileSync(outPath, result.code);
      console.log(`[MINIFY] ${file} ${(Buffer.byteLength(code)/1024).toFixed(1)}K -> ${(Buffer.byteLength(result.code)/1024).toFixed(1)}K`);
    } catch (err) { console.error(`[ERROR] ${file}: ${err.message}`); }
  }
}

function buildTailwind() {
  console.log('[TAILWIND] Building CSS...');
  execSync('npx tailwindcss -i assets/css/tailwind.src.css -o dist/web/assets/css/tailwind.css --minify', { stdio: 'inherit', cwd: process.cwd() });
  console.log('[TAILWIND] Done');
}

function minifyCSS() {
  const cssFile = path.join(CSS_SRC, 'style.css');
  if (!fs.existsSync(cssFile)) return;
  const css = fs.readFileSync(cssFile, 'utf8');
  const result = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,])\s*/g, '$1').replace(/;}/g, '}').trim();
  const outPath = path.join(DIST, cssFile);
  fs.ensureDirSync(path.dirname(outPath));
  fs.writeFileSync(outPath, result);
  console.log(`[MINIFY] ${cssFile} ${(Buffer.byteLength(css)/1024).toFixed(1)}K -> ${(Buffer.byteLength(result)/1024).toFixed(1)}K`);
}

function minifyHTML() {
  for (const file of ['index.html', 'web.html', 'login.html']) {
    const srcPath = path.resolve(file);
    const destPath = path.join(DIST, file);
    if (!fs.existsSync(srcPath)) continue;
    let html = fs.readFileSync(srcPath, 'utf8');
    const origSize = Buffer.byteLength(html);
    const scripts = [], styles = [];
    html = html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/g, (m, a, c) => { scripts.push(c); return `<script${a}>__SCRIPT_${scripts.length-1}__</script>`; });
    html = html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/g, (m, a, c) => { styles.push(c.replace(/\/\*[\s\S]*?\*\//g, '')); return `<style${a}>__STYLE_${styles.length-1}__</style>`; });
    html = html.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim();
    html = html.replace(/__SCRIPT_(\d+)__/g, (_, i) => scripts[parseInt(i)]).replace(/__STYLE_(\d+)__/g, (_, i) => styles[parseInt(i)]);
    fs.ensureDirSync(path.dirname(destPath));
    fs.writeFileSync(destPath, html);
    console.log(`[MINIFY HTML] ${file} ${(origSize/1024).toFixed(1)}K -> ${(Buffer.byteLength(html)/1024).toFixed(1)}K`);
  }
}

function copyAssets() {
  for (const item of ['manifest.json', 'sw.js', '.htaccess', 'sitemap.xml', 'robots.txt', 'riot.txt', 'epic.txt', 'privacy.html', 'terms.html', 'googlec7c8f355d1d65550.html', 'assets/img', 'assets/js/libs', 'assets/js/workers', 'Music', 'assets/css/login.css', 'assets/error']) {
    const src = path.resolve(item), dest = path.join(DIST, item);
    if (fs.existsSync(src)) { fs.copySync(src, dest, { overwrite: true }); console.log(`[COPY] ${item}`); }
  }
}

async function optimizeImages() {
  const imgDir = path.join(DIST, 'assets/img');
  if (!fs.existsSync(imgDir)) return;
  for (const file of fs.readdirSync(imgDir)) {
    const ext = path.extname(file).toLowerCase();
    if (!['.png','.jpg','.jpeg','.webp'].includes(ext)) continue;
    const filePath = path.join(imgDir, file), origSize = fs.statSync(filePath).size;
    const img = sharp(filePath);
    if (ext === '.png') await img.png({ palette: true, compressionLevel: 9, quality: 80 }).toFile(filePath + '.opt');
    else await img.jpeg({ quality: 80, mozjpeg: true }).toFile(filePath + '.opt');
    const optSize = fs.statSync(filePath + '.opt').size;
    if (optSize < origSize) { fs.copySync(filePath + '.opt', filePath); console.log(`[OPTIMIZE] ${file} ${(origSize/1024).toFixed(1)}K -> ${(optSize/1024).toFixed(1)}K`); }
    else console.log(`[OPTIMIZE] ${file} skipped`);
    fs.removeSync(filePath + '.opt');
  }
}

function getDirSize(dir) {
  let size = 0;
  try { for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) { try { if (entry.isFile()) size += fs.statSync(path.join(dir, entry.name)).size; } catch {} } } catch {}
  return size;
}

async function build() {
  console.log('=== Foxy Build - ط¶ط؛ط· ظپظ‚ط· ===\n');
  fs.emptyDirSync(DIST);
  copyAssets();
  minifyHTML();
  buildTailwind();
  await optimizeImages();
  await minifyJS();
  minifyCSS();
  console.log(`\n[BUILD] Complete. Output: ${DIST} (${(getDirSize(DIST)/1024/1024).toFixed(2)} MB)`);
}

build().catch(err => { console.error(err); process.exit(1); });
