const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log('');
console.log('  ╔════════════════════════════════════╗');
console.log('  ║         Foxy Build Tool            ║');
console.log('  ╠════════════════════════════════════╣');
console.log('  ║  1. ضغط فقط                       ║');
console.log('  ║     (سريع - للتجربة)              ║');
console.log('  ║                                    ║');
console.log('  ║  2. ضغط + تشفير                   ║');
console.log('  ║     (للنشر - حماية الأكواد)        ║');
console.log('  ║                                    ║');
console.log('  ║  3. Electron                      ║');
console.log('  ║     (برنامج سطح مكتب)             ║');
console.log('  ║                                    ║');
console.log('  ║  4. فك ضغط                        ║');
console.log('  ║     (استخراج ملف مضغوط)           ║');
console.log('  ║                                    ║');
console.log('  ║  5. Electron Wrapper              ║');
console.log('  ║     (النسخة الجديدة - Stable/Beta) ║');
console.log('  ╚════════════════════════════════════╝');
console.log('');

rl.question('اختار (1 أو 2 أو 3 أو 4 أو 5): ', (answer) => {
  rl.close();
  const choice = answer.trim();
  console.log('');

  if (choice === '5') {
    console.log('تجميع Electron Wrapper (النسخة الجديدة)...\n');
    execSync('node build-wrapper.js', { stdio: 'inherit', cwd: process.cwd() });
  } else if (choice === '3') {
    console.log('تجميع Electron...\n');
    execSync('npx electron-builder --win', { stdio: 'inherit', cwd: process.cwd() });
  } else if (choice === '2') {
    console.log('تشفير + ضغط...\n');
    execSync('node build-encrypt.js', { stdio: 'inherit', cwd: process.cwd() });
  } else if (choice === '4') {
    console.log('فك ضغط...\n');
    execSync('node build-decompress.js', { stdio: 'inherit', cwd: process.cwd() });
  } else {
    console.log('ضغط فقط...\n');
    execSync('node build-compress.js', { stdio: 'inherit', cwd: process.cwd() });
  }
});
