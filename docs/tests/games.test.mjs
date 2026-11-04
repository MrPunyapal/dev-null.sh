import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES, getGame } from '../games.js';
import { neighbors } from '../shared.js';

const day = '2026-11-04';

test('seven game prototypes are available, deterministic and independent', () => {
  assert.equal(GAMES.length, 7);
  for (const game of GAMES) {
    assert.deepEqual(game.init(day), game.init(day), game.name + ' daily seed changes unexpectedly');
    assert.equal(game.init(day).score, 0);
    assert.equal(game.init(day).done, false);
    assert.equal(game.init(day).id, game.id);
    assert.ok(game.view(game.init(day)).includes('button'), game.name + ' has no interactive controls');
  }
  assert.notDeepEqual(getGame('commit-grid').init(day).deck, getGame('commit-grid').init('2026-11-05').deck);
});

test('Commit Grid finishes after exactly sixteen placements', () => {
  const game = getGame('commit-grid'), s = game.init(day);
  for (let i = 0; i < 16; i++) game.move(s, { type:'place', index:i });
  assert.equal(s.done, true);
  assert.equal(s.turn, 16);
  assert.ok(s.score >= 1200);
  const score = s.score;
  game.move(s, { type:'place', index:0 });
  assert.equal(s.score, score);
});

test('Merge Mayhem always offers a pair until twenty successful moves', () => {
  const game = getGame('merge-mayhem'), s = game.init(day);
  for (let turn = 0; turn < 20; turn++) {
    let match = null;
    for (let i = 0; i < 16 && !match; i++) {
      const j = neighbors(i,4,4).find(n => s.cells[i] === s.cells[n]);
      if (j !== undefined) match = [i,j];
    }
    assert.ok(match, 'Merge has no available match at move ' + turn);
    game.move(s, { type:'select', index:match[0] });
    game.move(s, { type:'select', index:match[1] });
    assert.equal(s.turn, turn + 1);
  }
  assert.ok(s.score > 0);
  assert.equal(s.done, true);
});

test('Cache Crash banks points through three releases', () => {
  const game = getGame('cache-crash'), s = game.init(day);
  for (let r=0;r<3;r++) {
    const fix = s.deck.findIndex(x => x === 'fix');
    game.move(s, { type:'flip', index:fix });
    assert.ok(s.pot > 0);
    game.move(s, { type:'ship' });
    if (r<2) game.move(s, { type:'next' });
  }
  assert.equal(s.done, true);
  assert.equal(s.score, 300);
});

test('Bug Bingo consumes its twenty-five shared draws and scores line choices', () => {
  const game = getGame('bug-bingo'), s = game.init(day);
  for (let i=0;i<25;i++) {
    const index = s.cells.findIndex((v,j) => v===s.draws[s.turn] && !s.marked[j]);
    game.move(s,index<0 ? {type:'skip'} : {type:'mark',index});
  }
  assert.equal(s.done, true);
  assert.equal(s.turn, 25);
  assert.ok(s.score >= 1000);
});

test('Flip or Ship handles matching pairs and perfect runs', () => {
  const game=getGame('flip-or-ship'), s=game.init(day);
  for (let r=0;r<3;r++) {
    for (let v=0;v<6;v++) {
      const cards = s.deck.flatMap((x,i) => x===v ? [i] : []);
      assert.equal(cards.length, 2);
      game.move(s,{type:'flip',index:cards[0]});
      game.move(s,{type:'flip',index:cards[1]});
    }
    if (r<2) game.move(s,{type:'next'});
  }
  assert.equal(s.done,true);
  assert.ok(s.score>=3000);
});

test('Bug Bash completes in twenty-five legal moves', () => {
  const game=getGame('bug-bash'), s=game.init(day);
  for (let i=0;i<25;i++) game.move(s,{type:'direction',dir:i%2?'left':'right'});
  assert.equal(s.done,true);
  assert.equal(s.turn,25);
  assert.ok(s.score>=0);
});

test('Bug Drop produces safe cascades and finishes within twenty-five drops', () => {
  const game=getGame('bug-drop'),s=game.init(day);
  for (let i=0;i<25&&!s.done;i++) {
    const column=[0,1,2,3,4,5].find(c=>s.cells[c]===null);
    assert.notEqual(column,undefined);
    game.move(s,{type:'drop',index:column});
    assert.ok(s.cells.length===48);
    assert.ok(s.cells.every(v=>v===null||(v>=0&&v<=3)));
    assert.ok(s.score>=0);
  }
  assert.equal(s.done,true);
  assert.ok(s.turn<=25);
});
