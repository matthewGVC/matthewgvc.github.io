const { chromium } = require(process.env.PW);
const fs=require('fs');
(async()=>{const [svgFile,out,scale]=process.argv.slice(2);
const b=await chromium.launch();const p=await b.newPage({deviceScaleFactor:+(scale||1)});
await p.goto('file:///'+svgFile.split(String.fromCharCode(92)).join('/'));
const el=await p.$('svg');await el.screenshot({path:out,omitBackground:true});await b.close();console.log('ok')})();
