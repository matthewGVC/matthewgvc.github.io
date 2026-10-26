const {chromium}=require('playwright');const {outline}=require('../../scripts/floorplan/draw.js');
const cands=[['LIVING ROOM',800,7.2,0],['LIVING ROOM',900,7.1,0],['LIVING ROOM',900,7.5,0.04],['LIVING ROOM',800,7.0,0.02],["21'7\" x 30'6\"",300,7,0],["21'7\" x 30'6\"",400,7,0],["21'7\" x 30'6\"",400,6.9,0],["21'7\" x 30'6\"",300,6.5,0]];
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:200,height:30},deviceScaleFactor:3375/810});
for(const [t,w,s,tr] of cands){const d=outline(t,{weight:w,sizePt:s,x:5,y:20,tracking:tr});
await p.setContent(`<html><body style="margin:0;background:#fff"><svg width="200" height="30" viewBox="0 0 200 30"><path fill="#00273a" d="${d}"/></svg></body></html>`);
const buf=await p.screenshot({type:'png'});require('fs').writeFileSync(__dirname+'/c.png',buf);
const r=require('child_process').execSync('python -c "from PIL import Image;import numpy as np;a=255-np.array(Image.open(r\''+__dirname+'/c.png\').convert(\'L\')).astype(float);ys,xs=np.where(a>115);print(a.sum()/1000, xs.max()-xs.min()+1, ys.max()-ys.min()+1)"').toString().trim();
console.log(t.slice(0,8),w,s,tr,r);}
await b.close();})();
