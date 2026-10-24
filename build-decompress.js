const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const DIST = 'dist/web';

function getAllFiles(dir, ext) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...getAllFiles(full, ext));
    else if (entry.name.endsWith(ext)) files.push(full);
  }
  return files;
}

function decompress() {
  console.log('=== فك ضغط المشروع ===\n');

  fs.ensureDirSync(DIST);

  const jsFiles = getAllFiles('assets/js', '.js');
  const cssFiles = getAllFiles('assets/css', '.css');
  const htmlFiles = ['web.html'].filter(f => fs.existsSync(f));

  function copyToDist(file) {
    const dest = path.join(DIST, file);
    fs.ensureDirSync(path.dirname(dest));
    fs.copySync(file, dest, { overwrite: true });
    console.log(`[COPY] ${file} -> ${dest}`);
  }

  jsFiles.forEach(copyToDist);
  cssFiles.forEach(copyToDist);
  htmlFiles.forEach(copyToDist);

  console.log('\n=== تنسيق (فك الضغط) ===\n');

  const allFiles = [...jsFiles, ...cssFiles, ...htmlFiles].map(f => path.join(DIST, f));

  try {
    execSync(`npx js-beautify -r ${allFiles.map(f => `"${f}"`).join(' ')} -s 2`, { stdio: 'inherit', cwd: process.cwd() });
    console.log('\n[DECOMPRESS] تم فك الضغط والتنسيق بنجاح');
  } catch {
    console.log('\n[INFO] لم يتم العثور على js-beautify - سيتم النسخ بدون تنسيق');
    console.log('للحصول على تنسيق أفضل شغّل: npm install -g js-beautify');
  }

  const size = (size) => (size / 1024).toFixed(1) + 'K';
  let totalSrc = 0, totalDist = 0;
  console.log('');
  for (const file of [...jsFiles, ...cssFiles, ...htmlFiles]) {
    const dest = path.join(DIST, file);
    if (fs.existsSync(dest)) {
      const srcSize = fs.statSync(file).size;
      const dstSize = fs.statSync(dest).size;
      totalSrc += srcSize; totalDist += dstSize;
      console.log(`  ${file}: ${size(srcSize)} -> ${size(dstSize)}`);
    }
  }
  console.log(`\n  الإجمالي: ${size(totalSrc)} -> ${size(totalDist)}`);
  console.log(`\n[DECOMPRESS] اكتمل! الإخراج في: ${DIST}`);
}

decompress();