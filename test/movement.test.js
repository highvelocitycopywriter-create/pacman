import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMover, advance, reverse, position, tileOf, touching } from '../src/movement.js';
import { isWall, COLS } from '../src/maze.js';

const open = (col, row) => !isWall(col, row);

test('a mover advances along its direction and stops at walls', () => {
  const m = makeMover(6, 1, 'left');
  advance(m, 3, open, (mover) => mover.dir);
  assert.deepEqual(tileOf(m), { col: 3, row: 1 });
  advance(m, 10, open, (mover) => mover.dir);
  assert.deepEqual(tileOf(m), { col: 1, row: 1 });
  assert.equal(m.moving, false);
});

test('a buffered turn is taken at the first open junction', () => {
  const m = makeMover(6, 5, 'left');
  m.want = 'down';
  advance(m, 0.5, open, (mover) => (open(mover.from.col, mover.from.row + 1) ? mover.want : mover.dir));
  assert.equal(m.dir, 'down');
  assert.deepEqual(m.to, { col: 6, row: 6 });
});

test('reversing mid-tile keeps the same position and flips direction', () => {
  const m = makeMover(6, 1, 'left');
  advance(m, 0.3, open, (mover) => mover.dir);
  const before = position(m);
  reverse(m);
  assert.equal(m.dir, 'right');
  assert.deepEqual(position(m), before);
});

test('moving through the tunnel wraps to the other side', () => {
  const m = makeMover(0, 14, 'left');
  advance(m, 1.25, open, (mover) => mover.dir);
  assert.deepEqual(tileOf(m), { col: COLS - 1, row: 14 });
  assert.ok(position(m).x > COLS - 1, 'drawn at the right edge after wrapping');
});

test('collision detection uses centre distance', () => {
  const a = makeMover(5, 1, 'left');
  const b = makeMover(5, 1, 'right');
  assert.ok(touching(a, b), 'same tile touches');
  advance(b, 0.5, open, (mover) => mover.dir);
  assert.ok(touching(a, b), 'half a tile apart touches');
  advance(b, 0.5, open, (mover) => mover.dir);
  assert.ok(!touching(a, b), 'a full tile apart does not touch');
});
