// Layout probe: reports data.js geometry that overlaps where it shouldn't —
// ponds on dens/forests/obstacles, dens inside forests or human works, nodes
// sitting in the mud sink or on the rail. Run after moving anything in data.js.
//
//   node test/layout-probe.js     ->  "NO OVERLAPS" when the land is clean
const fs = require('fs'), vm = require('vm'), path = require('path');
const sb = { console };
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8'), sb, { filename: 'data.js' });
const code = `
const d=(a,b,c,e)=>Math.hypot(a-c,b-e);
const rects=['construction','subdivision','gravelPit'].map(k=>({k,o:OBSTACLES[k]}));
const rectDist=(o,x,y)=>Math.hypot(Math.max(o.x0-x,0,x-o.x1),Math.max(o.y0-y,0,y-o.y1));
// Interior nodes of a tear chain are SUPPOSED to be swallowed by the obstacle
// that earns the tear — The Bend drowns inside the mud sink by design, and the
// rip renders over it. Only end-node stubs must survive. So exempt those pairs
// rather than reporting them forever.
const drowned = new Set();
for (const g of TEAR_GROUPS) {
  if (!g.footprint || !g.chain) continue;
  for (const id of g.chain.slice(1, -1)) drowned.add(id + '|' + g.footprint);
}
const out=[];
for(const p of PONDS){
  for(const s of DEN_SITES) if(d(p.x,p.y,s.x,s.y)<p.r+130) out.push('POND '+p.name+' <-> DEN '+s.id+' d='+Math.round(d(p.x,p.y,s.x,s.y)));
  for(const f of TERRAIN.forests) if(d(p.x,p.y,f.x,f.y)<p.r+f.r-40) out.push('POND '+p.name+' <-> FOREST@'+f.x+','+f.y+' d='+Math.round(d(p.x,p.y,f.x,f.y)));
  for(const r of rects) if(rectDist(r.o,p.x,p.y)<p.r-10) out.push('POND '+p.name+' <-> RECT '+r.k);
  if(d(p.x,p.y,OBSTACLES.mudSink.x,OBSTACLES.mudSink.y)<p.r+OBSTACLES.mudSink.r-40) out.push('POND '+p.name+' <-> mudSink');
  const h=OBSTACLES.highway; if(p.x>h.x0-p.r&&p.x<h.x1+p.r) out.push('POND '+p.name+' <-> highway');
}
for(const s of DEN_SITES){
  for(const f of TERRAIN.forests) if(d(s.x,s.y,f.x,f.y)<f.r-30) out.push('DEN '+s.id+' inside FOREST@'+f.x+','+f.y);
  for(const r of rects) if(rectDist(r.o,s.x,s.y)<130) out.push('DEN '+s.id+' <-> RECT '+r.k);
  if(d(s.x,s.y,OBSTACLES.mudSink.x,OBSTACLES.mudSink.y)<OBSTACLES.mudSink.r+120) out.push('DEN '+s.id+' <-> mudSink');
}
for(const n of NODES){
  for(const r of rects) if(rectDist(r.o,n.x,n.y)<40) out.push('NODE '+n.id+' <-> RECT '+r.k);
  if(d(n.x,n.y,OBSTACLES.mudSink.x,OBSTACLES.mudSink.y)<OBSTACLES.mudSink.r-20 && !drowned.has(n.id+'|mudSink')) out.push('NODE '+n.id+' inside mudSink');
  const rl=OBSTACLES.rail; if(n.x>rl.x0-30&&n.x<rl.x1+30&&!(n.y>rl.gapY0&&n.y<rl.gapY1)) out.push('NODE '+n.id+' on the rail');
}
console.log(out.length?out.join('\\n'):'NO OVERLAPS');
`;
vm.runInContext(code, sb);
