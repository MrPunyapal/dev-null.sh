// Small deterministic helpers shared by the standalone, frontend-only prototypes.
// These are deliberately not anti-cheat mechanisms. No scores are globally ranked.
export function seedFor(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function random(state, max) {
  state.rng = (Math.imul(1664525, state.rng) + 1013904223) >>> 0;
  return max ? Math.floor((state.rng / 4294967296) * max) : state.rng / 4294967296;
}
export function shuffle(state, values) {
  const a = [...values];
  for (let i = a.length - 1; i > 0; i--) {
    const j = random(state, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function baseState(id, day) {
  return { id, day, rng: seedFor('dev-null-playground:v1:' + day + ':' + id), score: 0, done: false, message: 'Your move!' };
}
export function todayUTC() { return new Date().toISOString().slice(0, 10); }
export function format(n) { return Number(n || 0).toLocaleString('en-US'); }
export function neighbors(index, columns, rows) {
  const r = Math.floor(index / columns), c = index % columns, n = [];
  if (r > 0) n.push(index - columns);
  if (r < rows - 1) n.push(index + columns);
  if (c > 0) n.push(index - 1);
  if (c < columns - 1) n.push(index + 1);
  return n;
}
export function tile(index, symbol, label, action, classes = '', disabled = false, little = '') {
  return '<button type="button" class="cell ' + classes + '" data-action="' + action + '" data-index="' + index + '"' +
    (disabled ? ' disabled' : '') + ' aria-label="' + label.replace(/"/g, '&quot;') + '">' +
    (symbol || '') + (little ? '<span class="little">' + little + '</span>' : '') + '</button>';
}
export function button(label, action, classes = '', disabled = false) {
  return '<button type="button" class="btn ' + classes + '" data-action="' + action + '"' +
    (disabled ? ' disabled' : '') + '>' + label + '</button>';
}
export function board(columns, cells, classes = '') {
  return '<div class="board ' + (columns === 4 ? 'four' : columns === 5 ? 'five' : 'six') + ' ' + classes + '">' +
    cells.join('') + '</div>';
}
export function drawing(icon, heading, info) {
  return '<div class="draw-card"><div><strong>' + heading + '</strong><div class="small">' + info + '</div></div><div class="symbol">' + icon + '</div></div>';
}
