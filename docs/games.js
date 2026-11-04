import { baseState, random, shuffle, neighbors, tile, button, board, drawing, format } from './shared.js';

const commitIcons = ['🐞', '🧪', '🚀', '☕'];
const mergeIcons = ['·', '🐞', '🧪', '🔧', '🚀', '⭐', '👑'];
const dropIcons = ['🐞', '☕', '🧪', '⚡'];
const memoryIcons = ['🐞', '🦆', '🧪', '☕', '🚀', '⚡'];
const bingoIcons = ['🐞', '☕', '🚀', '🧪', '🦆'];
const validIndex = (value, size) => Number.isInteger(value) && value >= 0 && value < size;
const isAdjacent = (a, b, cols, rows) => neighbors(a, cols, rows).includes(b);

// Commit Grid: place a known next card in one of sixteen spaces.
function commitInit(day) {
  const s = baseState('commit-grid', day);
  s.deck = shuffle(s, Array.from({ length: 16 }, (_, i) => i % 4));
  s.cells = Array(16).fill(null);
  s.turn = 0;
  s.message = 'Place the next card. Build matching rows and columns!';
  return s;
}
function commitMove(s, a) {
  const i = a.index;
  if (a.type !== 'place' || s.done || !validIndex(i, 16) || s.cells[i] !== null) return s;
  const value = s.deck[s.turn], r = Math.floor(i / 4), c = i % 4;
  s.cells[i] = value;
  const adj = neighbors(i, 4, 4).filter(n => s.cells[n] === value).length;
  let gain = 50 + adj * 100;
  if ([0, 1, 2, 3].every(x => s.cells[r * 4 + x] === value)) gain += 700;
  if ([0, 1, 2, 3].every(x => s.cells[x * 4 + c] === value)) gain += 700;
  for (let rr = Math.max(0, r - 1); rr <= Math.min(2, r); rr++) {
    for (let cc = Math.max(0, c - 1); cc <= Math.min(2, c); cc++) {
      if ([0, 1, 4, 5].every(d => s.cells[rr * 4 + cc + d] === value)) gain += 350;
    }
  }
  s.score += gain;
  s.turn++;
  s.message = commitIcons[value] + ' placed! +' + format(gain) + ' points.';
  if (s.turn === 16) {
    s.done = true;
    s.score += 400;
    s.message = 'Grid complete! +400 completion bonus.';
  }
  return s;
}
function commitView(s) {
  const cells = s.cells.map((v, i) => tile(i, v === null ? '+' : commitIcons[v], 'Cell ' + (i + 1) + (v === null ? ', empty. Place card.' : ', occupied.'), 'place', v === null ? 'empty' : 'marked', s.done || v !== null));
  return drawing(s.done ? '🏁' : commitIcons[s.deck[s.turn]], s.done ? 'Grid completed' : 'Next card', s.done ? 'Well played!' : 'Choose any empty space for this card.') + board(4, cells);
}

// Merge Mayhem: combine adjacent equal tiles; the rest fall into place.
function mergeHasPair(s) {
  return s.cells.some((v, i) => neighbors(i, 4, 4).some(n => s.cells[n] === v));
}
function mergeEnsurePair(s) {
  for (let tries = 0; tries < 24 && !mergeHasPair(s); tries++) s.cells = shuffle(s, s.cells);
  if (!mergeHasPair(s)) s.cells[1] = s.cells[0];
}
function mergeInit(day) {
  const s = baseState('merge-mayhem', day);
  s.cells = Array.from({ length: 16 }, () => 1 + random(s, 3));
  s.turn = 0;
  s.selected = null;
  mergeEnsurePair(s);
  s.message = 'Tap two neighboring, identical tiles to merge them.';
  return s;
}
function mergeGravity(s) {
  for (let c = 0; c < 4; c++) {
    const values = [];
    for (let r = 3; r >= 0; r--) {
      const v = s.cells[r * 4 + c];
      if (v) values.push(v);
    }
    for (let r = 3; r >= 0; r--) s.cells[r * 4 + c] = values[3 - r] || 1 + random(s, 3);
  }
}
function mergeMove(s, a) {
  if (a.type !== 'select' || s.done || !validIndex(a.index, 16)) return s;
  const i = a.index;
  if (s.selected === null) { s.selected = i; s.message = 'Pick a matching neighbor.'; return s; }
  if (s.selected === i) { s.selected = null; s.message = 'Selection cleared.'; return s; }
  const first = s.selected;
  if (!isAdjacent(first, i, 4, 4) || s.cells[first] !== s.cells[i]) {
    s.selected = i;
    s.message = 'Not a match. Select a neighboring tile with the same icon.';
    return s;
  }
  const level = s.cells[first];
  s.cells[i] = Math.min(level + 1, 6);
  s.cells[first] = 0;
  const gained = Math.pow(2, level - 1) * 100;
  s.score += gained;
  s.turn++;
  s.selected = null;
  mergeGravity(s);
  mergeEnsurePair(s);
  s.message = 'Merged! +' + format(gained) + ' points.';
  if (s.turn >= 20) { s.done = true; s.message = '20 merges complete! You scored ' + format(s.score) + '.'; }
  return s;
}
function mergeView(s) {
  return drawing('✨', 'Make bigger merges', (20 - s.turn) + ' merges left · higher levels score more.') +
    board(4, s.cells.map((v, i) => tile(i, mergeIcons[v], 'Cell ' + (i + 1) + ', level ' + v + (s.selected === i ? ', selected' : ''), 'select', s.selected === i ? 'selected' : '', s.done, 'Lv ' + v)));
}

// Cache Crash: high-risk card reveals with only three banking opportunities.
const cacheTypes = ['fix','fix','fix','fix','fix','fix','fix','fix','boost','boost','double','double','bug','bug','bug','bug'];
const cacheIcons = { fix:'🧪', boost:'🚀', double:'⚡', bug:'🐞' };
function cacheRound(s) {
  s.deck = shuffle(s, cacheTypes);
  s.revealed = Array(16).fill(false);
  s.bugs = 0;
  s.pot = 0;
  s.multiplier = 1;
  s.phase = 'play';
}
function cacheInit(day) {
  const s = baseState('cache-crash', day);
  s.round = 0;
  s.phase = 'play';
  s.last = '';
  cacheRound(s);
  s.message = 'Flip a card. Bank your points before 3 bugs appear.';
  return s;
}
function cacheFinish(s, crashed) {
  const earned = crashed ? 0 : s.pot;
  s.score += earned;
  s.last = crashed ? '💥 Cache crashed. Unbanked points lost!' : '🚀 Shipped! +' + format(earned) + ' banked.';
  s.pot = 0;
  s.phase = s.round === 2 ? 'done' : 'between';
  s.done = s.round === 2;
  s.message = s.last;
}
function cacheMove(s, a) {
  if (s.done) return s;
  if (a.type === 'next' && s.phase === 'between') {
    s.round++;
    cacheRound(s);
    s.message = 'New cache, new chance. Flip or bank!';
    return s;
  }
  if (s.phase !== 'play') return s;
  if (a.type === 'ship' && s.pot > 0) { cacheFinish(s, false); return s; }
  if (a.type !== 'flip' || !validIndex(a.index, 16) || s.revealed[a.index]) return s;
  s.revealed[a.index] = true;
  const card = s.deck[a.index];
  if (card === 'bug') {
    s.bugs++;
    s.message = '🐞 Bug found! ' + (3 - s.bugs) + ' more until a crash.';
    if (s.bugs === 3) { cacheFinish(s, true); return s; }
  } else if (card === 'double') {
    s.multiplier = Math.min(4, s.multiplier + 1);
    s.message = '⚡ Multiplier increased to ×' + s.multiplier + '.';
  } else {
    const gain = (card === 'boost' ? 250 : 100) * s.multiplier;
    s.pot += gain;
    s.message = cacheIcons[card] + ' +' + format(gain) + ' at risk. Ship or keep flipping?';
  }
  if (s.revealed.every(Boolean)) cacheFinish(s, false);
  return s;
}
function cacheView(s) {
  const faces = s.deck.map((v, i) => {
    const revealed = s.revealed[i];
    return tile(i, revealed ? cacheIcons[v] : '❔', 'Card ' + (i + 1) + (revealed ? ', ' + v : ', face down'), 'flip', revealed ? (v === 'bug' ? 'danger' : v === 'double' ? 'gold' : 'marked') : '', s.phase !== 'play' || revealed);
  });
  let html = drawing('🗃️', 'Cache ' + (s.round + 1) + ' of 3', 'Bugs: ' + s.bugs + '/3 · Multiplier: ×' + s.multiplier + ' · At risk: ' + format(s.pot)) + board(4, faces, 'memory');
  if (s.phase === 'play') html += '<div class="game-actions">' + button('🚀 Ship +' + format(s.pot) + ' points', 'ship', 'primary', s.pot === 0) + '</div>';
  else if (s.phase === 'between') html += '<div class="finished">' + s.last + '</div><div class="game-actions">' + button('Next cache →', 'next', 'primary') + '</div>';
  return html;
}

// Bug Bingo: each drawn symbol can mark ONE matching square.
const bingoLines = [];
for (let r = 0; r < 5; r++) bingoLines.push([0,1,2,3,4].map(c => r * 5 + c));
for (let c = 0; c < 5; c++) bingoLines.push([0,1,2,3,4].map(r => r * 5 + c));
bingoLines.push([0,6,12,18,24], [4,8,12,16,20]);
function bingoInit(day) {
  const s = baseState('bug-bingo', day);
  const set = Array.from({ length:25 }, (_, i) => i % 5);
  s.cells = shuffle(s, set);
  s.draws = shuffle(s, set);
  s.marked = Array(25).fill(false);
  s.lines = [];
  s.turn = 0;
  s.message = 'Mark one matching tile for the current draw, or skip.';
  return s;
}
function bingoMove(s, a) {
  if (s.done || !['mark','skip'].includes(a.type)) return s;
  const icon = s.draws[s.turn];
  if (a.type === 'mark' && (!validIndex(a.index, 25) || s.marked[a.index] || s.cells[a.index] !== icon)) return s;
  if (a.type === 'mark') {
    s.marked[a.index] = true;
    s.score += 50;
    let bonus = 0;
    bingoLines.forEach((line, i) => {
      if (!s.lines.includes(i) && line.every(p => s.marked[p])) { s.lines.push(i); bonus += 500; }
    });
    s.score += bonus;
    s.message = bonus ? 'BINGO! +' + format(bonus + 50) + ' points!' : 'Marked! +50 points.';
  } else s.message = 'Draw skipped.';
  s.turn++;
  if (s.turn === 25) { s.done = true; s.message = 'Bingo finished: ' + s.lines.length + ' lines, ' + format(s.score) + ' points.'; }
  return s;
}
function bingoView(s) {
  const icon = s.done ? '🏆' : bingoIcons[s.draws[s.turn]];
  const available = s.done ? 0 : s.cells.filter((v,i) => v === s.draws[s.turn] && !s.marked[i]).length;
  let html = drawing(icon, s.done ? 'Bingo complete!' : 'Draw ' + (s.turn + 1) + ' of 25', s.done ? s.lines.length + ' lines completed.' : 'Choose ONE matching square. ' + available + ' available.');
  html += board(5, s.cells.map((v,i) => tile(i, bingoIcons[v], 'Row ' + (Math.floor(i/5)+1) + ', column ' + (i%5+1) + ', ' + (s.marked[i] ? 'marked' : 'unmarked'), 'mark', s.marked[i] ? 'marked' : s.cells[i] === s.draws[s.turn] && !s.done ? 'selected' : '', s.done || s.marked[i] || s.cells[i] !== s.draws[s.turn])));
  if (!s.done) html += '<div class="game-actions">' + button('Skip this draw →', 'skip', 'ghost') + '</div>';
  return html;
}

// Flip or Ship: memory pairs, consecutive-match bonuses and a decision to bank.
function memoryRound(s) {
  s.deck = shuffle(s, Array.from({length:12}, (_,i) => Math.floor(i/2)));
  s.matched = Array(12).fill(false);
  s.first = null;
  s.second = null;
  s.waiting = null;
  s.errors = 0;
  s.combo = 0;
  s.pot = 0;
  s.phase = 'play';
}
function memoryInit(day) {
  const s = baseState('flip-or-ship', day);
  s.round = 0;
  s.peeks = 2;
  s.phase = 'play';
  s.last = '';
  memoryRound(s);
  s.message = 'Find matching pairs. Ship before your 6th mismatch!';
  return s;
}
function memoryFinish(s, kind) {
  const gained = kind === 'crash' ? 0 : s.pot + (kind === 'perfect' ? 400 : 0);
  s.score += gained;
  s.last = kind === 'crash' ? '💥 Six bugs. Release crashed! Unbanked points lost.' : kind === 'perfect' ? '✨ Perfect release! +' + format(gained) + ' banked.' : '🚀 Shipped! +' + format(gained) + ' banked.';
  s.pot = 0;
  s.first = null;
  s.second = null;
  s.waiting = null;
  s.phase = s.round === 2 ? 'done' : 'between';
  s.done = s.round === 2;
  s.message = s.last;
}
function memoryMove(s, a) {
  if (s.done) return s;
  if (a.type === 'next' && s.phase === 'between') {
    s.round++;
    memoryRound(s);
    s.message = 'New release: find pairs or play it safe!';
    return s;
  }
  if (a.type === 'resolve' && s.waiting === 'peek') {
    s.waiting = null; s.message = 'Peek finished. Good luck remembering!';
    return s;
  }
  if (a.type === 'resolve' && s.waiting === 'mismatch') {
    s.waiting = null;
    s.errors++;
    s.first = null;
    s.second = null;
    s.combo = 0;
    s.message = '🐞 Mismatch! ' + (6 - s.errors) + ' chances left.';
    if (s.errors >= 6) memoryFinish(s, 'crash');
    return s;
  }
  if (s.phase !== 'play' || s.waiting) return s;
  if (a.type === 'peek' && s.peeks > 0) {
    s.peeks--; s.first = null; s.second = null;
    s.waiting = 'peek'; s.message = '👁 Remember the card positions!';
    return s;
  }
  if (a.type === 'ship' && s.pot > 0) { memoryFinish(s, 'ship'); return s; }
  if (a.type !== 'flip' || !validIndex(a.index, 12) || s.matched[a.index] || s.first === a.index) return s;
  if (s.first === null) { s.first = a.index; s.message = 'Now find its pair.'; return s; }
  const first = s.first;
  if (s.deck[first] === s.deck[a.index]) {
    s.matched[first] = s.matched[a.index] = true;
    s.first = null;
    s.combo = Math.min(s.combo + 1, 4);
    const gain = (s.deck[a.index] === 5 ? 200 : 100) * s.combo;
    s.pot += gain;
    s.message = '✨ Matching pair! +' + gain + ' at risk, ×' + s.combo + ' combo.';
    if (s.matched.every(Boolean)) memoryFinish(s, 'perfect');
  } else {
    s.second = a.index;
    s.waiting = 'mismatch';
    s.message = 'Not a match! Remember these cards.';
  }
  return s;
}
function memoryView(s) {
  const all = s.waiting === 'peek';
  const faces = s.deck.map((v,i) => {
    const visible = all || s.matched[i] || s.first === i || s.second === i;
    return tile(i, visible ? memoryIcons[v] : '‹/›', 'Card ' + (i+1) + (visible ? ', ' + memoryIcons[v] : ', face down'), 'flip', visible ? s.matched[i] ? 'matched' : 'revealed' : '', s.phase !== 'play' || !!s.waiting || s.matched[i] || s.first === i);
  });
  let html = drawing('🃏', 'Release ' + (s.round + 1) + ' of 3', 'Pairs: ' + (s.matched.filter(Boolean).length/2) + '/6 · Bugs: ' + s.errors + '/6 · Combo ×' + s.combo + ' · At risk: ' + format(s.pot));
  html += board(4, faces, 'memory');
  if (s.phase === 'play') html += '<div class="game-actions">' + button('🚀 Ship +' + format(s.pot), 'ship', 'primary', !s.pot || !!s.waiting) + button('👁 Peek (' + s.peeks + ' left)', 'peek', 'warning', !s.peeks || !!s.waiting) + '</div>';
  else if (s.phase === 'between') html += '<div class="finished">' + s.last + '</div><div class="game-actions">' + button('Next release →', 'next', 'primary') + '</div>';
  return html;
}

// Bug Bash: move a rubber duck across a six-by-six board in 25 moves.
function bugInit(day) {
  const s = baseState('bug-bash', day);
  s.cells = Array(36).fill(null);
  s.duck = 14;
  s.turn = 0;
  s.combo = 0;
  s.squashed = 0;
  s.cells[15] = 1;
  s.cells[20] = 1;
  const empty = shuffle(s, Array.from({length:36},(_,i)=>i).filter(i=>i!==s.duck && !s.cells[i]));
  empty.slice(0,10).forEach((idx,i)=>{s.cells[idx] = i < 2 ? 2 : 1;});
  s.message = 'Move one square. Squash consecutive bugs for combos!';
  return s;
}
function bugMove(s, a) {
  if (s.done || !['step','direction'].includes(a.type)) return s;
  let target = a.index;
  if (a.type === 'direction') {
    const r = Math.floor(s.duck/6), c = s.duck%6;
    const d = {up:[-1,0],down:[1,0],left:[0,-1],right:[0,1]}[a.dir];
    if (!d || r+d[0]<0 || r+d[0]>=6 || c+d[1]<0 || c+d[1]>=6) return s;
    target = (r+d[0])*6+c+d[1];
  }
  if (!validIndex(target,36) || !isAdjacent(s.duck,target,6,6)) return s;
  const bug=s.cells[target];
  s.cells[target]=null;
  s.duck=target;
  s.turn++;
  if (bug) {
    s.combo=Math.min(s.combo+1,4);
    const gain=(bug===2?250:100)*s.combo;
    s.score+=gain;
    s.squashed++;
    s.message=(bug===2?'✨ Golden bug! ':'🐞 Squashed! ')+'+'+gain+' points · ×'+s.combo+' combo.';
  } else {s.combo=0;s.message='Empty square. Combo reset.';}
  if (s.turn%2===0) {
    const free=shuffle(s,Array.from({length:36},(_,i)=>i).filter(i=>i!==s.duck && !s.cells[i]));
    const count=s.turn%6===0?2:1;
    free.slice(0,count).forEach(i=>s.cells[i]=random(s,9)===0?2:1);
  }
  if (s.turn>=25) {s.done=true;s.message='Time to ship! '+format(s.score)+' points from '+s.squashed+' bugs.';}
  return s;
}
function bugView(s) {
  const choices=neighbors(s.duck,6,6);
  let html=drawing('🦆',s.done?'Run complete':'Squash the bugs',(25-s.turn)+' moves remaining · combo ×'+s.combo);
  html+=board(6,s.cells.map((v,i)=>tile(i,i===s.duck?'🦆':v===2?'✨':v===1?'🐞':'','Row '+(Math.floor(i/6)+1)+', column '+(i%6+1)+(i===s.duck?', duck':v===2?', golden bug':v===1?', bug':', empty'),'step',i===s.duck?'selected':v===2?'gold':v===1?'danger':'empty',s.done||!choices.includes(i))));
  if (!s.done) html+='<div class="mini-keypad">'+button('↑','up','up')+button('←','left','left')+button('↓','down','down')+button('→','right','right')+'</div>';
  return html;
}

// Bug Drop: choose columns, clear groups of 3+ and chain gravity cascades.
function dropGravity(s) {
  for (let c=0;c<6;c++) {
    const values=[];
    for (let r=7;r>=0;r--) if (s.cells[r*6+c]!==null) values.push(s.cells[r*6+c]);
    for (let r=7;r>=0;r--) s.cells[r*6+c]=values[7-r]??null;
  }
}
function dropClusters(s) {
  const visited=new Set(), groups=[];
  for (let i=0;i<48;i++) {
    if (visited.has(i)||s.cells[i]===null) continue;
    const group=[],q=[i],symbol=s.cells[i];
    visited.add(i);
    while(q.length){
      const p=q.shift();group.push(p);
      for(const n of neighbors(p,6,8)) if(!visited.has(n)&&s.cells[n]===symbol){visited.add(n);q.push(n);}
    }
    if(group.length>=3)groups.push(group);
  }
  return groups;
}
function dropResolve(s) {
  let chains=0,gained=0;
  for (let i=0;i<12;i++){
    const groups=dropClusters(s);if(!groups.length)break;
    chains++;
    for(const group of groups){gained+=group.length*100*chains;for(const cell of group)s.cells[cell]=null;}
    dropGravity(s);
  }
  return {chains,gained};
}
function dropInit(day) {
  const s=baseState('bug-drop',day);
  s.cells=Array(48).fill(null);
  for(let r=6;r<8;r++)for(let c=0;c<6;c++)s.cells[r*6+c]=random(s,4);
  s.next=random(s,4);
  s.turn=0;
  s.message='Drop the next bug into any column. Match three to explode!';
  return s;
}
function dropMove(s,a) {
  if (s.done||a.type!=='drop'||!validIndex(a.index,6))return s;
  const c=a.index;
  let r=7;
  while(r>=0&&s.cells[r*6+c]!==null)r--;
  if(r<0){s.message='That column is full!';return s;}
  s.cells[r*6+c]=s.next;
  s.next=random(s,4);
  s.turn++;
  const result=dropResolve(s);
  s.score+=result.gained;
  s.message=result.chains?'💥 '+result.chains+' chain'+(result.chains>1?'s':'')+'! +'+format(result.gained)+' points.':'Keep building groups of three!';
  if (s.turn===25||[0,1,2,3,4,5].every(col=>s.cells[col]!==null)){
    s.done=true;
    s.message='Drop complete! Final score: '+format(s.score)+'.';
  }
  return s;
}
function dropView(s) {
  let html=drawing(dropIcons[s.next],s.done?'Board complete':'Next tile',(25-s.turn)+' drops remaining · connect 3 or more matching tiles');
  html+='<div class="board-column">'+[0,1,2,3,4,5].map(c=>button('↓','drop','',s.done||s.cells[c]!==null).replace('data-action="drop"','data-action="drop" data-index="'+c+'"')).join('')+'</div>';
  html+=board(6,s.cells.map((v,i)=>tile(i,v===null?'':dropIcons[v],'Cell '+(i+1)+(v===null?', empty':', '+dropIcons[v]),'none',v===null?'empty':'',true)));
  return html;
}

export const GAMES = [
  {id:'commit-grid',name:'Commit Grid',emoji:'🧩',tag:'Strategy',description:'Draw a card, place it on a 4×4 board, and build combos.',rules:['You get the same 16-card sequence each day.','Place each card on an empty square.','Matching neighbors score extra. Full rows, columns, and 2×2 blocks score big.','One filled grid ends your run.'],init:commitInit,move:commitMove,view:commitView,metrics:s=>[['Score',format(s.score)],['Cards left',16-s.turn],['Placed',s.turn+'/16']]},
  {id:'merge-mayhem',name:'Merge Mayhem',emoji:'✨',tag:'Strategy',description:'Combine matching neighbors into higher-level tiles.',rules:['Tap one tile, then a matching neighboring tile.','They merge into a stronger tile that scores more.','New tiles fall in and the board reshuffles when stuck.','Make 20 merges for your final score.'],init:mergeInit,move:mergeMove,view:mergeView,metrics:s=>[['Score',format(s.score)],['Merges left',20-s.turn],['Highest level',Math.max(...s.cells)]]},
  {id:'cache-crash',name:'Cache Crash',emoji:'💥',tag:'Cards',description:'Flip for points. Ship before you reveal too many bugs.',rules:['Flip a hidden card to reveal points, multipliers, or a bug.','Three bugs crash the current cache and lose its unbanked points.','Ship to safely bank points and start the next cache.','You have three caches per run.'],init:cacheInit,move:cacheMove,view:cacheView,metrics:s=>[['Banked',format(s.score)],['At risk',format(s.pot)],['Cache',(s.round+1)+'/3']]},
  {id:'bug-bingo',name:'Bug Bingo',emoji:'🎯',tag:'Casual',description:'Choose the smartest square to mark on each symbol draw.',rules:['Each turn reveals one developer-themed symbol.','Mark exactly one matching square, or skip it.','Each mark is worth 50 points. Complete a line for +500.','Twenty-five draws, including diagonals, make one game.'],init:bingoInit,move:bingoMove,view:bingoView,metrics:s=>[['Score',format(s.score)],['Draws left',25-s.turn],['Lines',s.lines.length]]},
  {id:'flip-or-ship',name:'Flip or Ship',emoji:'🃏',tag:'Memory',description:'Find matching pairs, build streaks, and decide when to bank.',rules:['Find pairs among twelve face-down cards.','Consecutive matches score more. Mismatches reset combos.','Six mistakes crash the release and lose unbanked points.','Ship early, clear the board for a bonus, or use a limited peek. Three releases per run.'],init:memoryInit,move:memoryMove,view:memoryView,metrics:s=>[['Banked',format(s.score)],['At risk',format(s.pot)],['Release',(s.round+1)+'/3']]},
  {id:'bug-bash',name:'Bug Bash',emoji:'🦆',tag:'Arcade',description:'Guide a rubber duck through a board full of mischievous bugs.',rules:['Move the duck one square in any direction.','Landing on bugs scores points. Consecutive bugs build combos.','Golden bugs are worth extra, and new bugs appear every two moves.','You have 25 moves. Arrow keys and WASD work on desktop.'],init:bugInit,move:bugMove,view:bugView,metrics:s=>[['Score',format(s.score)],['Moves left',25-s.turn],['Combo','×'+s.combo]]},
  {id:'bug-drop',name:'Bug Drop',emoji:'🪲',tag:'Arcade',description:'Drop colorful bugs into columns and trigger chain reactions.',rules:['Choose a column for the next tile. It falls to the lowest empty cell.','Connect at least three matching tiles orthogonally to clear them.','When tiles fall, new matches create chain reactions for larger bonuses.','Play up to 25 drops, or until the board fills.'],init:dropInit,move:dropMove,view:dropView,metrics:s=>[['Score',format(s.score)],['Drops left',25-s.turn],['Board',s.cells.filter(v=>v!==null).length+'/48']]}
];
export function getGame(id) { return GAMES.find(g=>g.id===id); }
