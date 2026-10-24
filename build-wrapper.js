/**
 * Foxy — Wrapper Build Script (النسخة الجديدة)
 * =====================================================
 * يبني نسخة سطح المكتب الجديدة (Site Wrapper + اختيار سيرفر Stable/Beta)
 * التي تبدأ من electron/main.js.
 *
 * الطريقة: يبدّل حقل "main" في package.json مؤقتاً إلى electron/main.js،
 * ويضيّق قائمة الملفات إلى ما يحتاجه الـ Wrapper فعلاً (بدل تضمين
 * المشروع كله بما فيه albion-tool وnode_modules ومجلد dist)،
 * يشغّل electron-builder، ثم يعيد كل شيء كما كان — حتى لو فشل البناء.
 *
 * الاستخدام: node build-wrapper.js  أو  npm run build:wrapper
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WRAPPER_ENTRY = 'electron/main.js';
const WRAPPER_FILES = [
  'electron/**/*',
  'assets/img/**/*',
  'package.json',
];
const pkgPath = path.join(__dirname, 'package.json');

function readPkg() {
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
}
function writePkg(pkg) {
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

async function buildWrapper() {
  const before = readPkg();
  const originalMain = before.main;
  const originalFiles = before.build && before.build.files;
  console.log('=== Foxy Wrapper Build (النسخة الجديدة) ===\n');

  console.log('[1/4] Checking wrapper files...');
  execSync('node --check electron/main.js && node --check electron/preload.js', {
    stdio: 'inherit',
    cwd: __dirname,
  });
  console.log('  OK: main.js + preload.js syntax valid\n');

  const pkg = readPkg();
  pkg.main = WRAPPER_ENTRY;
  pkg.build = pkg.build || {};
  pkg.build.files = WRAPPER_FILES;
  writePkg(pkg);
  console.log(`[2/4] Entry point: ${originalMain} -> ${WRAPPER_ENTRY}`);
  console.log(`[2/4] Files narrowed to: ${WRAPPER_FILES.join(', ')}`);

  try {
    console.log('[3/4] Running electron-builder...\n');
    execSync('npx electron-builder --win', { stdio: 'inherit', cwd: __dirname });
    console.log('\n[SUCCESS] Wrapper installer built in dist/');
    console.log('  - Stable: https://foxy.xo.je | Beta: https://abdo3.xo.je/');
    try {
      const asarStat = fs.statSync(path.join(__dirname, 'dist', 'win-unpacked', 'resources', 'app.asar'));
      console.log(`[4/4] app.asar size: ${(asarStat.size / 1048576).toFixed(1)} MB`);
    } catch (e) {}
  } finally {
    const restored = readPkg();
    restored.main = originalMain;
    if (originalFiles === undefined) delete restored.build.files;
    else restored.build.files = originalFiles;
    writePkg(restored);
    console.log(`[Cleanup] Entry point + files restored`);
  }
}

buildWrapper().catch((err) => {
  console.error('\n[FAILED] Wrapper build failed.');
  process.exitCode = 1;
});
