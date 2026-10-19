/* Downloads the Chromium the helper renders with into its own home
   (%USERPROFILE%\.gvc-helper\browsers). Once per PC, after `npm install`:
     node helper/install-browser.js */
'use strict';

require('./config.js');
const { execFileSync } = require('child_process');
const path = require('path');

const cli = path.join(__dirname, 'node_modules', 'playwright', 'cli.js');
console.log('Installing Chromium into ' + process.env.PLAYWRIGHT_BROWSERS_PATH + ' …');
execFileSync(process.execPath, [cli, 'install', 'chromium'], { stdio: 'inherit', env: process.env });
