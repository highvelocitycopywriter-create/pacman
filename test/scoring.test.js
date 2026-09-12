import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, POINTS } from '../src/game.js';
import { pelletKey } from '../src/maze.js';
import { step, place, startPlaying, FRAME } from './helpers.js';

test('eating a pellet scores 10 and removes it', () => {
  const game = createGame();
  startPlaying(game);
  const before = game.pellets.size;
  place(game.pac, 12, 23, 'left');
  game.update(FRAME);
  assert.equal(game.score, POINTS.pellet);
  assert.equal(game.pellets.size, before - 1);
  assert.ok(!game.pellets.has(pelletKey(12, 23)));
});

test('eating a power pellet scores 50 and frightens ghosts outside the house', () => {
  const events = [];
  const game = createGame({ onEvent: (name) => events.push(name) });
  startPlaying(game);
  place(game.pac, 1, 3, 'left');
  game.update(FRAME);
  assert.equal(game.score, POINTS.power);
  assert.ok(game.ghosts[0].fright > 0, 'blinky is frightened');
  assert.ok(events.includes('power'));
});

test('eating frightened ghosts doubles the bonus each time', () => {
  const game = createGame();
  startPlaying(game);
  place(game.pac, 1, 3, 'left');
  game.update(FRAME);
  const base = game.score;
  const bonuses = [];
  for (const g of game.ghosts) {
    Object.assign(g, { mode: 'normal', fright: 5 });
    place(g, 9, 11, 'left');
    place(game.pac, 9, 11, 'left');
    const before = game.score;
    game.update(FRAME);
    bonuses.push(game.score - before);
    assert.equal(g.mode, 'eyes');
  }
  assert.deepEqual(bonuses, [200, 400, 800, 1600]);
  assert.equal(game.score, base + 3000);
});

test('high score tracks the score and is reported once beaten', () => {
  const highs = [];
  const game = createGame({ highScore: 15, onEvent: (name, detail) => name === 'highscore' && highs.push(detail) });
  startPlaying(game);
  place(game.pac, 12, 23, 'left');
  game.update(FRAME);
  assert.equal(game.high, 15);
  place(game.pac, 11, 23, 'left');
  game.update(FRAME);
  assert.equal(game.high, 20);
  assert.deepEqual(highs, [20]);
});

test('reset clears the score but keeps the high score', () => {
  const game = createGame();
  startPlaying(game);
  place(game.pac, 12, 23, 'left');
  step(game, 0.5);
  assert.ok(game.score > 0);
  game.reset();
  assert.equal(game.score, 0);
  assert.ok(game.high > 0);
});
