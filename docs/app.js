import { GAMES, getGame } from './games.js';
import { todayUTC, format } from './shared.js';

const root = document.getElementById('app');
const SITE = 'dev-null-games:v1';
let activeGame = null;
let activeState = null;
let filter = 'All';
let pendingTimer = null;

const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Storage may be disabled. */ } };
const stateKey = (id, day) => SITE + ':state:' + day + ':' + id;
const bestKey = (id, day) => SITE + ':best:' + day + ':' + id;

function getBest(id, day) {
  const value = Number(read(bestKey(id, day)) || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}
function loadState(game) {
  const day = todayUTC();
  let saved = null;
  try { saved = JSON.parse(read(stateKey(game.id, day)) || 'null'); } catch { /* Invalid stored data. */ }
  if (saved && saved.id === game.id && saved.day === day && Number.isFinite(saved.score) && typeof saved.done === 'boolean') return saved;
  return game.init(day);
}
function save() {
  if (!activeState || !activeGame) return;
  write(stateKey(activeGame.id, activeState.day), JSON.stringify(activeState));
  if (activeState.done && activeState.score > getBest(activeGame.id, activeState.day)) {
    write(bestKey(activeGame.id, activeState.day), String(activeState.score));
  }
}
function header() {
  const current = activeGame?.id;
  const gameLinks = GAMES.map(g =>
    '<a class="sidebar-game' + (current === g.id ? ' active' : '') + '" href="#/' + g.id + '"' +
    (current === g.id ? ' aria-current="page"' : '') +
    '><span aria-hidden="true">' + g.emoji + '</span><span>' + g.name + '</span></a>'
  ).join('');
  return '<header class="site-header"><div class="shell">' +
    '<a class="brand" href="#/" aria-label="/dev/null Games Playground homepage">' +
    '<span class="brand-symbol" aria-hidden="true"><svg viewBox="1.6 1.5 45 45" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M2 42h10L26 6H16Z" fill="currentColor"/>' +
    '<path fill="#ff8a4c" fill-rule="evenodd" clip-rule="evenodd" d="M17.81 43.5h13.22L46.19 4.5H32.97ZM22.19 40.5l12.84-33h6.78l-12.84 33Z"/>' +
    '</svg></span><span class="brand-copy"><span class="brand-wordmark">/dev<span class="brand-stroke">/</span>null</span>' +
    '<span class="brand-sub">games playground</span></span></a>' +
    '<div class="sidebar-content">' +
    '<nav class="nav-right" aria-label="Playground navigation"><span class="nav-caption">PLAYGROUND</span>' +
    '<a class="nav-link' + (!current ? ' active' : '') + '" href="#/"' + (!current ? ' aria-current="page"' : '') + '>▦ <span>All games</span></a>' +
    '<a class="nav-link" href="https://dev-null.sh/" target="_blank" rel="noopener noreferrer">↗ <span>/dev/null</span></a>' +
    '</nav><nav class="sidebar-games" aria-label="Choose a game"><span class="nav-caption">GAMES</span>' +
    gameLinks + '</nav></div>' +
    '<div class="sidebar-bottom"><span class="sidebar-mark" aria-hidden="true">⌘</span> Built for a coffee break.<br>Open source. No sign-in.</div>' +
    '</div></header>';
}
function footer() {
  return '<footer class="footer"><div class="shell"><span>Made for fun. No login, tracking, or online leaderboards.</span>' +
    '<a href="https://github.com/MrPunyapal/dev-null.sh" target="_blank" rel="noopener noreferrer">Open-source /dev/null fork ↗</a></div></footer>';
}
function gameCard(g) {
  const best = getBest(g.id, todayUTC());
  return '<a class="game-card" href="#/' + g.id + '" aria-label="Play ' + g.name + '">' +
    '<div class="top"><span class="game-emoji" aria-hidden="true">' + g.emoji + '</span><span class="tag">' + g.tag + '</span></div>' +
    '<h3>' + g.name + '</h3><p>' + g.description + '</p>' +
    '<div class="card-footer"><span>Today’s best: <b>' + (best ? format(best) : 'Not played') + '</b></span><span class="card-arrow" aria-hidden="true">→</span></div></a>';
}
function renderHome() {
  const categories = ['All','Strategy','Cards','Casual','Memory','Arcade'];
  const list = GAMES.filter(g => filter === 'All' || g.tag === filter);
  document.title = 'Games Playground · /dev/null';
  root.innerHTML = header() + '<main class="shell main">' +
    '<section class="hero"><div>' +
    '<div class="eyebrow">The experimental arcade</div>' +
    '<h1>Small games.<br><span>Big little breaks.</span></h1>' +
    '<p>Seven playful developer-themed games. Pick one, chase your own high score, and discover a new daily shuffle. No signup, no setup, just play.</p>' +
    '<span class="tag">🗓 ' + todayUTC() + ' · UTC challenge</span></div>' +
    '<div class="hero-card" aria-hidden="true"><div class="tiny">/dev/null arcade</div><div class="large-art">🃏🦆</div><strong>Which game wins?</strong><div class="tiny">Play them all and pick your favorite.</div><div class="bar"><span></span><span></span><span></span><span></span></div></div></section>' +
    '<section aria-label="Choose a game"><div class="filter-row"><h2 class="section-title">Choose your game <span style="color:var(--muted);font-size:13px;font-weight:500">(' + list.length + ')</span></h2>' +
    '<div class="filter-controls" role="group" aria-label="Filter games">' +
    categories.map(cat => '<button type="button" class="chip ' + (cat === filter ? 'active' : '') + '" data-filter="' + cat + '" aria-pressed="' + (cat === filter) + '">' + cat + '</button>').join('') +
    '</div></div><div class="games-list">' + list.map(gameCard).join('') + '</div></section>' +
    '<aside class="note"><strong>Playtest mode.</strong> Each game gets a shared UTC-date seed, unlimited practice attempts and a local best score saved in your browser. Daily ranked attempts, playing streaks and global leaderboards need an authenticated backend and are intentionally not simulated here. Everything runs on GitHub Pages.</aside>' +
    '</main>' + footer();
}
function renderGame() {
  if (!activeGame || !activeState) return;
  const g = activeGame, s = activeState;
  document.title = g.name + ' · /dev/null Games Playground';
  const boxes = g.metrics(s).map(([name,value]) => '<div class="score-box"><label>' + name + '</label><strong>' + value + '</strong></div>').join('');
  root.innerHTML = header() + '<main class="shell main"><div class="game-page">' +
    '<a class="back-link" href="#/">← Back to all games</a>' +
    '<div class="game-top"><span class="game-emoji" aria-hidden="true">' + g.emoji + '</span><div>' +
    '<div class="eyebrow">' + g.tag + ' · ' + s.day + ' UTC</div><h1>' + g.name + '</h1><p>' + g.description + '</p></div></div>' +
    '<div class="play-layout"><section class="play-panel" aria-label="' + g.name + ' game">' +
    '<div class="score-bar">' + boxes + '</div>' +
    '<div class="game-instruction">' + (s.done ? '🏆 Run complete! Restart to try a different strategy.' : 'Practice round · No ranked attempts, unlimited restarts.') + '</div>' +
    g.view(s) +
    '<div class="game-message" role="status" aria-live="polite">' + s.message + '</div>' +
    (s.done ? '<div class="finished">🏆 Final score: ' + format(s.score) + ' · Today’s local best: ' + format(getBest(g.id, s.day)) + '</div>' : '') +
    '<div class="game-actions">' +
    '<button class="btn ghost" data-control="restart">↻ Restart</button>' +
    '<button class="btn ghost" data-control="share">⧉ Copy result</button></div>' +
    '</section><aside class="rules-panel"><h2>How to play</h2><ol class="rule-list">' +
    g.rules.map(rule => '<li>' + rule + '</li>').join('') +
    '</ol><hr class="side-divider"><div class="side-label">Today’s local best</div>' +
    '<div class="best-number">' + format(getBest(g.id,s.day)) + '</div>' +
    '<div class="stats-caption">Practice as often as you like. Scores are only saved on this device after a completed run.</div>' +
    '<hr class="side-divider"><div class="side-label">About this playground</div>' +
    '<p class="stats-caption">Open-source, frontend-only prototypes. No accounts, server-side validation or public leaderboard.</p>' +
    (g.id === 'bug-bash' ? '<p class="stats-caption">Tip: Use arrow keys or WASD on your keyboard.</p>' : '') +
    '</aside></div></div></main>' + footer();
  schedulePending();
}
function schedulePending() {
  if (pendingTimer !== null) { clearTimeout(pendingTimer); pendingTimer = null; }
  if (activeGame?.id === 'flip-or-ship' && activeState?.waiting) {
    pendingTimer = setTimeout(() => { pendingTimer = null; dispatch({ type: 'resolve' }); }, activeState.waiting === 'peek' ? 1700 : 950);
  }
}
function navigate() {
  if (pendingTimer !== null) { clearTimeout(pendingTimer); pendingTimer = null; }
  const raw = location.hash.replace(/^#\/?/, '').split('/')[0];
  const game = getGame(raw);
  if (game) {
    if (!activeGame || activeGame.id !== game.id || activeState?.day !== todayUTC()) {
      activeGame = game;
      activeState = loadState(game);
    }
    renderGame();
  } else {
    activeGame = null;
    activeState = null;
    renderHome();
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function dispatch(a) {
  if (!activeGame || !activeState) return;
  if (activeState.day !== todayUTC()) activeState = activeGame.init(todayUTC());
  activeState = activeGame.move(activeState, a);
  save();
  renderGame();
}
function resetGame() {
  if (!activeGame) return;
  activeState = activeGame.init(todayUTC());
  save();
  renderGame();
}
async function copyResult() {
  if (!activeGame || !activeState) return;
  const g = activeGame, s = activeState;
  const link = location.origin + location.pathname + '#/' + g.id;
  const result = g.emoji + ' ' + g.name + ' · ' + s.day + ' UTC\n' +
    'Score: ' + format(s.score) + ' points (' + (s.done ? 'finished' : 'in progress') + ')\n' +
    'Play: ' + link;
  let copied = false;
  try { await navigator.clipboard.writeText(result); copied = true; } catch { /* Secure clipboard may be unavailable. */ }
  if (!copied) {
    const field = document.createElement('textarea');
    field.value = result;
    field.style.position = 'fixed';
    field.style.left = '-9999px';
    document.body.appendChild(field);
    field.select();
    try { copied = document.execCommand('copy'); } catch { /* Clipboard denied. */ }
    field.remove();
  }
  if (activeGame?.id === g.id && activeState?.day === s.day) {
    activeState.message = copied ? 'Score copied! Share it with a friend.' : 'Clipboard unavailable in this browser.';
    renderGame();
  }
}

root.addEventListener('click', event => {
  const filterButton = event.target.closest('button[data-filter]');
  if (filterButton) { filter = filterButton.dataset.filter; renderHome(); return; }
  const control = event.target.closest('button[data-control]');
  if (control) {
    if (control.dataset.control === 'restart') resetGame();
    if (control.dataset.control === 'share') void copyResult();
    return;
  }
  const actionButton = event.target.closest('button[data-action]');
  if (!actionButton) return;
  const type = actionButton.dataset.action;
  if (['up','down','left','right'].includes(type)) dispatch({ type:'direction', dir:type });
  else dispatch({ type, index: Number(actionButton.dataset.index) });
});
document.addEventListener('keydown', event => {
  if (activeGame?.id !== 'bug-bash' || event.altKey || event.metaKey || event.ctrlKey) return;
  if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
  const dirs = { ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',a:'left',s:'down',d:'right' };
  if (dirs[event.key]) { event.preventDefault(); dispatch({ type:'direction', dir:dirs[event.key] }); }
});
window.addEventListener('hashchange', navigate);
navigate();
