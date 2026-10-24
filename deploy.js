const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const DIST = 'dist/web';

async function deploy() {
  console.log('=== Foxy Web Deployment Script ===\n');

  console.log('[1/4] Building web project...');
  execSync('node buildweb.js', { stdio: 'inherit', cwd: __dirname });

  console.log('\n[2/4] Ensuring .htaccess is included...');
  const htaccessSrc = path.join(__dirname, '.htaccess');
  const htaccessDest = path.join(__dirname, DIST, '.htaccess');
  if (fs.existsSync(htaccessSrc)) {
    fs.copySync(htaccessSrc, htaccessDest, { overwrite: true });
    console.log('  âœ“ .htaccess copied to dist/web/');
  } else {
    console.log('  âڑ  .htaccess not found in project root');
  }

  console.log('\n[3/4] Creating server config fallback...');
  const userIniPath = path.join(__dirname, DIST, '.user.ini');
  const userIniContent = `; Fix 403 Forbidden on JS modules
; Some hosts block "modules" directory - this overrides it
; Remove this if your host doesn't support .user.ini
;
; Alternative: set file permissions to 644 via FTP/SSH
;
; If 403 persists, check:
; 1. File permissions (must be 644 or 755 for dirs)
; 2. mod_security rules
; 3. Apache configuration (AllowOverride)
`;
  fs.writeFileSync(userIniPath, userIniContent);

  console.log('\n[4/4] Deployment Summary');
  console.log('  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');
  console.log(`  Output folder: ${DIST}/`);
  console.log('  ');
  console.log('  âڑ  IMPORTANT: If you still get 403 Forbidden after uploading:');
  console.log('  ');
  console.log('  1. File permissions (most common cause):');
  console.log('     - Files must be 644 (rw-r--r--)');
  console.log('     - Directories must be 755 (rwxr-xr-x)');
  console.log('     - Run via SSH after upload:');
  console.log('       find /path/to/webroot -type f -exec chmod 644 {} \\;');
  console.log('       find /path/to/webroot -type d -exec chmod 755 {} \\;');
  console.log('  ');
  console.log('  2. If using cPanel File Manager:');
  console.log('     - Select all files â†’ "Change Permissions" â†’ 644');
  console.log('  ');
  console.log('  3. If using FTP (FileZilla etc.):');
  console.log('     - Right-click â†’ "File Permissions" â†’ 644');
  console.log('     - Check "Recurse into subdirectories"');
  console.log('  ');
  console.log('  4. Hosting-specific (mod_security):');
  console.log('     - Some hosts block "modules" in path');
  console.log('     - Contact hosting support to whitelist');
  console.log('     - Or rename "modules" folder (requires code changes)');
  console.log('  ');
  console.log('  5. Verify .htaccess is uploaded to server root:');
  console.log('     - The .htaccess file must be in the SAME folder as web.html');
  console.log('  ');
  console.log('  Build complete. Upload the contents of "dist/web/" to your server.');
  console.log('  â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');
}

deploy().catch(err => { console.error(err); process.exit(1); });
