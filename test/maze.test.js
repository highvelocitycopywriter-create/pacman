'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/** Load game.js with a stubbed DOM and return its maze constants. */
function loadGame() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
  const stubs = `
    const noop = () => {};
    const fakeCtx = new Proxy({}, { get: () => noop, set: () => true });
    const document = { getElementById: () => ({ addEventListener: noop, getContext: () => fakeCtx }), addEventListener: noop };
    const localStorage = { getItem: () => null, setItem: noop };
    const performance = { now: () => 0 };
    const requestAnimationFrame = noop;
  `;
  const exports = 'return { MAZE, COLS, ROWS, PACMAN_START, GHOST_DEFS, GHOST_DOOR, GHOST_HOME, wrapCol };';
  return new Function(stubs + src.replace("'use strict';", '') + exports)();
}

const { MAZE, COLS, ROWS, PACMAN_START, GHOST_DEFS, GHOST_DOOR, GHOST_HOME, wrapCol } = loadGame();
const cell = (col, row) => (row < 0 || row >= ROWS ? '#' : MAZE[row][wrapCol(col)]);
const isOpen = (col, row) => cell(col, row) !== '#';
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Breadth-first search over open cells; the door is a wall for Pac-Man. */
function reachableFrom(start, passDoor) {
  const seen = new Set([`${start.col},${start.row}`]);
  const queue = [start];
  while (queue.length) {
    const { col, row } = queue.shift();
    for (const [dx, dy] of DIRS) {
      const next = { col: wrapCol(col + dx), row: row + dy };
      const ch = cell(next.col, next.row);
      const key = `${next.col},${next.row}`;
      if (ch === '#' || (ch === '-' && !passDoor) || seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return seen;
}

test('maze is a rectangular hardcoded grid', () => {
  assert.equal(ROWS, 31);
  assert.equal(COLS, 28);
  for (const row of MAZE) assert.equal(row.length, COLS);
});

test('every pellet is reachable from the Pac-Man start, so the level can be won', () => {
  const reachable = reachableFrom(PACMAN_START, false);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const ch = MAZE[row][col];
      if (ch === '.' || ch === 'o') assert.ok(reachable.has(`${col},${row}`), `pellet at ${col},${row} is sealed off`);
    }
  }
});

test('every open cell outside the ghost house is reachable from the Pac-Man start', () => {
  const reachable = reachableFrom(PACMAN_START, false);
  const houseInterior = reachableFrom(GHOST_HOME, false);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (!isOpen(col, row) || cell(col, row) === '-') continue;
      const key = `${col},${row}`;
      assert.ok(reachable.has(key) || houseInterior.has(key), `open cell ${col},${row} is a sealed pocket`);
    }
  }
});

test('ghost house connects to the maze through the door', () => {
  const fromHouse = reachableFrom(GHOST_HOME, true);
  assert.ok(fromHouse.has(`${GHOST_DOOR.col},${GHOST_DOOR.row}`));
  assert.ok(fromHouse.has(`${PACMAN_START.col},${PACMAN_START.row}`));
});

test('Pac-Man and every ghost start on a fixed open cell', () => {
  assert.ok(isOpen(PACMAN_START.col, PACMAN_START.row));
  assert.notEqual(cell(PACMAN_START.col, PACMAN_START.row), '-');
  for (const g of GHOST_DEFS) assert.ok(isOpen(g.start.col, g.start.row), `${g.name} starts in a wall`);
  assert.ok(isOpen(GHOST_DOOR.col, GHOST_DOOR.row));
  assert.ok(isOpen(GHOST_HOME.col, GHOST_HOME.row));
});

test('the four power pellets sit on open corridor cells reachable by Pac-Man', () => {
  const reachable = reachableFrom(PACMAN_START, false);
  const power = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) if (MAZE[row][col] === 'o') power.push({ col, row });
  }
  assert.equal(power.length, 4);
  for (const { col, row } of power) {
    assert.ok(reachable.has(`${col},${row}`), `power pellet at ${col},${row} unreachable`);
    assert.ok(DIRS.some(([dx, dy]) => isOpen(col + dx, row + dy)), `power pellet at ${col},${row} has no open neighbour`);
  }
});
