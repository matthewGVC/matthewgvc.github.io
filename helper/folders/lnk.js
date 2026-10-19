/* ============================================================
   LNK — reads the Windows shortcuts in "ACTIVE LISTINGS & DEALS".

     await resolveLnks('G:\\Shared drives\\GVC - New York\\ACTIVE LISTINGS & DEALS')
       → [{ name: '1050 Fifth - 2E.lnk', target: 'G:\\Shared drives\\…\\1050 Fifth Ave\\2E' }]
         target is null when the shortcut points at a folder that no longer exists.

   One PowerShell call (WScript.Shell) for the whole folder. Reads the
   shortcut files only; never opens the folders they point to.
   ============================================================ */
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');

function resolveLnks(dir) {
  const ps = "$sh = New-Object -ComObject WScript.Shell; " +
    "@(Get-ChildItem -LiteralPath $env:GVC_LNK_DIR -Filter *.lnk | ForEach-Object { " +
    "[pscustomobject]@{ name = $_.Name; target = $sh.CreateShortcut($_.FullName).TargetPath } }) | ConvertTo-Json -Compress";
  const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps],
    { env: Object.assign({}, process.env, { GVC_LNK_DIR: dir }), encoding: 'utf8', timeout: 60000 });
  const list = out.trim() ? [].concat(JSON.parse(out)) : [];
  return list.map(x => ({ name: x.name, target: x.target && fs.existsSync(x.target) ? x.target : null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = { resolveLnks };
