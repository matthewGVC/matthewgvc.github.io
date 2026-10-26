const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const {draw}=require('../../scripts/floorplan/draw.js');
const studio=require('../../scripts/floorplan/fixtures/studio.json');
const extra=JSON.parse(JSON.stringify(studio));
extra.north=30; extra.levels[0].name='UPPER LEVEL'; extra.levels.push({name:'LOWER LEVEL',walls:[]});
const L=extra.levels[0];
L.walls.push({a:[240,120],b:[300,120],type:'exterior'},{a:[300,120],b:[300,200],type:'exterior'},{a:[300,200],b:[240,200],type:'exterior'});
L.areas=[{type:'terrace',poly:[[240,120],[300,120],[300,200],[240,200]]},{type:'closet',poly:[[180,100],[238,100],[238,118],[180,118]]},{type:'stair',poly:[[100,160],[145,160],[145,195],[100,195]]}];
L.solids=[[[0,0],[12,0],[12,12],[0,12]]];
L.openings.push({wall:2,from:0.1,to:0.4,type:'sliding'},{wall:5,from:0.1,to:0.5,type:'double-door',side:'right'});
L.labels=[{text:'W/D',at:[120,180]}];
L.fixtures.push({type:'shower',at:[225,60],w:28,h:28,rot:0});
const out=path.join(__dirname);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:810,height:630},deviceScaleFactor:3});
for(const [n,svg] of [['studio-unbranded',draw(studio,0,{branded:false})],['studio-branded',draw(studio,0,{branded:true,facts:{beds:0,baths:1}})],['extra-branded',draw(extra,0,{branded:true,facts:{beds:2,baths:1}})]]){
 fs.writeFileSync(path.join(out,n+'.svg'),svg);
 await p.setContent('<html><body style="margin:0">'+svg+'</body></html>');await p.screenshot({path:path.join(out,n+'.png')});}
await b.close();})();
