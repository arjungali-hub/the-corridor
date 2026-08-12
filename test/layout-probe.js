// Layout probe: reports data.js geometry that overlaps where it shouldn't —
// ponds on each other or on human works, dens inside forests or obstacles, nodes
// swallowed by the sink or standing on the rail, and so on. Run after moving
// anything in data.js.
//
//   node test/layout-probe.js     ->  "NO OVERLAPS" when the land is clean
//
// It checks EVERY water body against every other, including TERRAIN.springsPond
// (which is a pond that is not in the PONDS array and so used to be invisible to
// this probe — it was overlapping the marsh pond in plain sight).
const fs = require('fs'), vm = require('vm'), path = require('path');
const sb = { console };
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8'), sb, { filename: 'data.js' });
const code = `
const d=(a,b,c,e)=>Math.hypot(a-c,b-e);
const rects=[
  {k:'construction',o:OBSTACLES.construction},
  {k:'subdivision', o:OBSTACLES.subdivision},
  {k:'gravelPit',   o:OBSTACLES.gravelPit},
  {k:'westCut',     o:OBSTACLES.westCut},
  {k:'fence',       o:OBSTACLES.fence},
];
const rectDist=(o,x,y)=>Math.hypot(Math.max(o.x0-x,0,x-o.x1),Math.max(o.y0-y,0,y-o.y1));
function distSeg(px,py,x0,y0,x1,y1){
  const dx=x1-x0,dy=y1-y0;const L=dx*dx+dy*dy||1;
  const t=Math.max(0,Math.min(1,((px-x0)*dx+(py-y0)*dy)/L));
  return Math.hypot(px-(x0+dx*t),py-(y0+dy*t));
}
function polyDist(px,py,pts){
  let m=Infinity;
  for(let i=0;i<pts.length-1;i++) m=Math.min(m,distSeg(px,py,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1]));
  return m;
}
// Interior nodes of a tear chain are SUPPOSED to be swallowed by the obstacle
// that earns the tear — The Bend drowns inside the mud sink by design, and the
// rip renders over it. Only end-node stubs must survive. So exempt those pairs
// rather than reporting them forever.
const drowned = new Set();
for (const g of TEAR_GROUPS) {
  if (!g.footprint || !g.chain) continue;
  for (const id of g.chain.slice(1, -1)) drowned.add(id + '|' + g.footprint);
}

// every drawn body of standing water, wherever it is declared
const waters = PONDS.map(p=>({name:p.name,x:p.x,y:p.y,r:p.r}));
if (TERRAIN.springsPond) waters.push({name:'the springs pond (TERRAIN)',
  x:TERRAIN.springsPond.x,y:TERRAIN.springsPond.y,r:TERRAIN.springsPond.r});

const out=[];

// ── water against water ─────────────────────────────────────────────────────
for(let i=0;i<waters.length;i++) for(let j=i+1;j<waters.length;j++){
  const a=waters[i],b=waters[j];
  const gap=d(a.x,a.y,b.x,b.y)-(a.r+b.r);
  if(gap<40) out.push('WATER '+a.name+' <-> WATER '+b.name+'  gap='+Math.round(gap));
}
// ── water against everything else ───────────────────────────────────────────
for(const p of waters){
  for(const s of DEN_SITES) if(d(p.x,p.y,s.x,s.y)<p.r+130) out.push('WATER '+p.name+' <-> DEN '+s.id+' d='+Math.round(d(p.x,p.y,s.x,s.y)));
  for(const f of TERRAIN.forests) if(d(p.x,p.y,f.x,f.y)<p.r+f.r-40) out.push('WATER '+p.name+' <-> FOREST@'+f.x+','+f.y+' d='+Math.round(d(p.x,p.y,f.x,f.y)));
  for(const r of rects) if(rectDist(r.o,p.x,p.y)<p.r-10) out.push('WATER '+p.name+' <-> RECT '+r.k);
  if(d(p.x,p.y,OBSTACLES.mudSink.x,OBSTACLES.mudSink.y)<p.r+OBSTACLES.mudSink.r-40) out.push('WATER '+p.name+' <-> mudSink');
  const h=OBSTACLES.highway; if(p.x>h.x0-p.r&&p.x<h.x1+p.r) out.push('WATER '+p.name+' <-> highway');
  const rl=OBSTACLES.rail;   if(p.x>rl.x0-p.r&&p.x<rl.x1+p.r) out.push('WATER '+p.name+' <-> rail');
  // the springs pond IS the springs: a water body centred on its own eponymous
  // node is the point, not a collision
  for(const n of NODES) if(!n.dynamic && d(p.x,p.y,n.x,n.y)<p.r+40
      && !(n.id==='springs' && /springs/.test(p.name)))
    out.push('WATER '+p.name+' <-> NODE '+n.id+' d='+Math.round(d(p.x,p.y,n.x,n.y)));
  for(let i=0;i<HERDS.length;i++){ const a=HERDS[i].anchor;
    if(d(p.x,p.y,a.x,a.y)<p.r+60) out.push('WATER '+p.name+' <-> HERD '+i+' anchor'); }
  if(polyDist(p.x,p.y,POWERLINE?[[POWERLINE.x0,POWERLINE.y0],[POWERLINE.x1,POWERLINE.y1]]:[[0,0],[0,0]])<p.r+40)
    out.push('WATER '+p.name+' <-> powerline cut');
}
// ── dens ────────────────────────────────────────────────────────────────────
for(let i=0;i<DEN_SITES.length;i++){
  const s=DEN_SITES[i];
  for(let j=i+1;j<DEN_SITES.length;j++) if(d(s.x,s.y,DEN_SITES[j].x,DEN_SITES[j].y)<320)
    out.push('DEN '+s.id+' <-> DEN '+DEN_SITES[j].id+' d='+Math.round(d(s.x,s.y,DEN_SITES[j].x,DEN_SITES[j].y)));
  for(const f of TERRAIN.forests) if(d(s.x,s.y,f.x,f.y)<f.r-30) out.push('DEN '+s.id+' inside FOREST@'+f.x+','+f.y);
  for(const r of rects) if(rectDist(r.o,s.x,s.y)<130) out.push('DEN '+s.id+' <-> RECT '+r.k);
  if(d(s.x,s.y,OBSTACLES.mudSink.x,OBSTACLES.mudSink.y)<OBSTACLES.mudSink.r+120) out.push('DEN '+s.id+' <-> mudSink');
}
// ── nodes ───────────────────────────────────────────────────────────────────
for(const n of NODES){
  if (n.dynamic) continue;
  for(const r of rects) if(rectDist(r.o,n.x,n.y)<40) out.push('NODE '+n.id+' <-> RECT '+r.k);
  if(d(n.x,n.y,OBSTACLES.mudSink.x,OBSTACLES.mudSink.y)<OBSTACLES.mudSink.r-20 && !drowned.has(n.id+'|mudSink')) out.push('NODE '+n.id+' inside mudSink');
  const rl=OBSTACLES.rail; if(n.x>rl.x0-30&&n.x<rl.x1+30&&!(n.y>rl.gapY0&&n.y<rl.gapY1)) out.push('NODE '+n.id+' on the rail');
}
// ── rumors: a promise must not sit inside something impassable ──────────────
if (typeof RUMORS !== 'undefined') for(const r of RUMORS){
  // a rumor that resolves to 'changed' is SUPPOSED to sit on the thing that
  // changed — r-oldwater points at the water the impoundment drowned, and finding
  // the sink where the water was is the whole payoff
  const pointsAtWhatChanged = r.resolvesTo === 'changed';
  for(const q of rects) if(rectDist(q.o,r.x,r.y)<40 && !pointsAtWhatChanged) out.push('RUMOR '+r.id+' inside RECT '+q.k);
  if(d(r.x,r.y,OBSTACLES.mudSink.x,OBSTACLES.mudSink.y)<OBSTACLES.mudSink.r && !pointsAtWhatChanged) out.push('RUMOR '+r.id+' inside mudSink');
  for(const p of waters) if(d(r.x,r.y,p.x,p.y)<p.r) out.push('RUMOR '+r.id+' inside WATER '+p.name);
}
// ── the human works must not sit on top of each other ───────────────────────
for(let i=0;i<rects.length;i++) for(let j=i+1;j<rects.length;j++){
  const a=rects[i].o,b=rects[j].o;
  if(a.x0<b.x1&&b.x0<a.x1&&a.y0<b.y1&&b.y0<a.y1) out.push('RECT '+rects[i].k+' overlaps RECT '+rects[j].k);
}
console.log(out.length?out.join('\\n'):'NO OVERLAPS');
`;
vm.runInContext(code, sb);
