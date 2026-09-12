import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAZE, ROWS, COLS, PACMAN_START, GHOST_DEFS, GHOST_DOOR, GHOST_HOME, wrapCol, cell, isWall, buildPellets,
} from '../src/maze.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const key = (col, row) => `${col},${row}`;

/** Breadth-first search over open cells; the door is a wall unless `passDoor`. */
function reachableFrom(start, passDoor) {
  const seen = new Set([key(start.col, start.row)]);
  const queue = [start];
  while (queue.length) {
    const { col, row } = queue.shift();
    for (const [dx, dy] of DIRS) {
      const next = { col: wrapCol(col + dx), row: row + dy };
      const ch = cell(next.col, next.row);
      if (ch === '#' || (ch === '-' && !passDoor) || seen.has(key(next.col, next.row))) continue;
      seen.add(key(next.col, next.row));
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
  for (const k of buildPellets().keys()) {
    const col = k % COLS;
    const row = Math.floor(k / COLS);
    assert.ok(reachable.has(key(col, row)), `pellet at ${col},${row} is sealed off`);
  }
});

test('every open cell outside the ghost house is reachable from the Pac-Man start', () => {
  const reachable = reachableFrom(PACMAN_START, false);
  const house = reachableFrom(GHOST_HOME, false);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (isWall(col, row) || cell(col, row) === '-') continue;
      assert.ok(reachable.has(key(col, row)) || house.has(key(col, row)), `open cell ${col},${row} is a sealed pocket`);
    }
  }
});

test('ghost house connects to the maze through the door', () => {
  const fromHouse = reachableFrom(GHOST_HOME, true);
  assert.ok(fromHouse.has(key(GHOST_DOOR.col, GHOST_DOOR.row)));
  assert.ok(fromHouse.has(key(PACMAN_START.col, PACMAN_START.row)));
});

test('Pac-Man and every ghost start on a fixed open cell', () => {
  for (const spot of [PACMAN_START, GHOST_DOOR, GHOST_HOME, ...GHOST_DEFS.map((g) => g.start)]) {
    assert.ok(!isWall(spot.col, spot.row), `${spot.col},${spot.row} is a wall`);
    assert.notEqual(cell(spot.col, spot.row), '-');
  }
});

test('the four power pellets sit on reachable open corridor cells', () => {
  const reachable = reachableFrom(PACMAN_START, false);
  const power = [...buildPellets()].filter(([, ch]) => ch === 'o').map(([k]) => [k % COLS, Math.floor(k / COLS)]);
  assert.equal(power.length, 4);
  for (const [col, row] of power) {
    assert.ok(reachable.has(key(col, row)), `power pellet at ${col},${row} unreachable`);
    assert.ok(DIRS.some(([dx, dy]) => !isWall(col + dx, row + dy)), `power pellet at ${col},${row} has no open neighbour`);
  }
});

test('the tunnel row wraps horizontally', () => {
  assert.equal(cell(-1, 14), cell(COLS - 1, 14));
  assert.ok(!isWall(0, 14) && !isWall(COLS - 1, 14));
});
