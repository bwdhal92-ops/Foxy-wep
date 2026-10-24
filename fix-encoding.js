const fs = require('fs');
const path = require('path');

const htmlFile = path.join(__dirname, 'web.html');
let html = fs.readFileSync(htmlFile, 'utf-8');
let count = 0;

function log(label, oldStr, newStr) {
  count++;
  console.log(`[${count}] ${label}`);
  console.log(`  OLD: ${JSON.stringify(oldStr)}`);
  console.log(`  NEW: ${JSON.stringify(newStr)}`);
}

function replaceBetween(html, before, after, replacement, label) {
  const s = html.indexOf(before);
  if (s === -1) { console.log(`\u274c [${label}]: before not found`); return html; }
  const cs = s + before.length;
  const e = html.indexOf(after, cs);
  if (e === -1) { console.log(`\u274c [${label}]: after not found`); return html; }
  log(label, html.substring(cs, e), replacement);
  return html.substring(0, cs) + replacement + html.substring(e);
}

const updateOld = '<span>?? \u0627\u0644\u0646\u0633\u062e\u0629 \u0627\u0644\u062c\u062f\u064a\u062f\u0629 \u0645\u062a\u0627\u062d\u0629!</span>\r\n                            <button onclick="window.location.reload(true)" style="background:#3b82f6; color:white; border:none; padding:6px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">\u062a\u062d\u062f\u064a\u062b</button>';
const updateNew = '<span>\ud83d\ude80 \u0646\u0633\u062e\u0629 \u062c\u062f\u064a\u062f\u0629 \u0645\u062a\u0627\u062d\u0629!</span>\r\n                            <button onclick="window.location.reload(true)" style="background:#3b82f6; color:white; border:none; padding:6px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">\u062a\u062d\u062f\u064a\u062b</button>';
if (html.includes(updateOld)) {
  log('Update available span + button', updateOld, updateNew);
  html = html.replace(updateOld, updateNew);
} else {
  const updateOldLf = updateOld.replace(/\r\n/g, '\n');
  if (html.includes(updateOldLf)) {
    log('Update available span + button (LF)', updateOldLf, updateNew.replace(/\r\n/g, '\n'));
    html = html.replace(updateOldLf, updateNew.replace(/\r\n/g, '\n'));
  } else {
    console.log('\u274c [Update available span]: pattern not found');
  }
}

html = replaceBetween(html,
  '<h3 class="text-xl font-bold text-white mb-2">', '</h3><p id="join-invite-text"',
  '\u062f\u0639\u0648\u0629 \u0644\u0644\u0627\u0646\u0636\u0645\u0627\u0645!',
  'Join invite modal title'
);

html = replaceBetween(html,
  '<h3 class="text-lg font-bold text-white">', '</h3><button onclick="closeInviteFriendsPopup()"',
  '\u062f\u0639\u0648\u0629 \u0644\u0644\u0627\u0646\u0636\u0645\u0627\u0645!',
  'Invite friends popup title'
);

const winBefore = 'sp-tab-windows" class="flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 bg-blue-600 text-white shadow-lg shadow-blue-500/20" onclick="switchScreenPickerTab(\'window\')"><span class="flex items-center justify-center gap-2">';
html = replaceBetween(html,
  winBefore, '</span></button>',
  '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg> \u0627\u0644\u0646\u0648\u0627\u0641\u0630 \u0627\u0644\u0645\u0641\u062a\u0648\u062d\u0629 ',
  'Screen picker: windows tab'
);

const scrBefore = 'sp-tab-screens" class="flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 text-gray-400 hover:text-white hover:bg-white/5" onclick="switchScreenPickerTab(\'screen\')"><span class="flex items-center justify-center gap-2">';
html = replaceBetween(html,
  scrBefore, '</span></button>',
  '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg> \u0627\u0644\u0634\u0627\u0634\u0627\u062a \u0627\u0644\u0643\u0627\u0645\u0644\u0629 ',
  'Screen picker: screens tab'
);

html = replaceBetween(html,
  '<p id="join-invite-text" class="text-gray-400 mb-8 px-4">', '</p>',
  '\u0644\u0642\u062f \u062a\u0645\u062a \u062f\u0639\u0648\u062a\u0643 \u0644\u0644\u0627\u0646\u0636\u0645\u0627\u0645 \u0625\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0633\u064a\u0631\u0641\u0631. \u0647\u0644 \u062a\u0648\u062f \u0627\u0644\u0628\u062f\u0621\u061f',
  'Join invite paragraph'
);

html = replaceBetween(html,
  '<div id="sidebar-initial" class="absolute inset-0 w-full h-full flex items-center justify-center text-lg font-bold text-blue-400">', '</div>',
  '\u200b',
  'Sidebar initial'
);

html = replaceBetween(html,
  'if (window.electronAPI) return; // ', '',
  '\u062a\u062a\u0645 \u0627\u0644\u062a\u062d\u062f\u064a\u062b \u0639\u0628\u0631 \u062a\u0637\u0628\u064a\u0642 \u0627\u0644\u0643\u0645\u0628\u064a\u0648\u062a\u0631',
  'ElectronAPI comment'
);

fs.writeFileSync(htmlFile, html, 'utf-8');
console.log(`\nDone: ${count} replacements made.`);
