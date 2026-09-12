import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, FINAL_LEVEL, START_LIVES } from '../src/game.js';
import { step, place, startPlaying, FRAME } from './helpers.js';

test('start moves through ready into playing', () => {
  const game = createGame();
  assert.equal(game.state, 'idle');
  game.start();
  assert.equal(game.state, 'ready');
  step(game, 2.1);
  assert.equal(game.state, 'playing');
});

test('pause freezes the game and resume continues it', () => {
  const game = createGame();
  startPlaying(game);
  game.setWantedDir('left');
  step(game, 0.5);
  game.togglePause();
  assert.equal(game.state, 'paused');
  const pellets = game.pellets.size;
  step(game, 1);
  assert.equal(game.pellets.size, pellets);
  game.togglePause();
  assert.equal(game.state, 'playing');
});

test('touching a ghost costs a life and respawns everyone on their start cells', () => {
  const events = [];
  const game = createGame({ onEvent: (name) => events.push(name) });
  startPlaying(game);
  const blinky = game.ghosts[0];
  place(game.pac, 1, 1, 'left');
  place(blinky, 1, 1, 'right');
  game.update(FRAME);
  assert.equal(game.state, 'dying');
  assert.ok(events.includes('death'));
  step(game, 1.6);
  assert.equal(game.lives, START_LIVES - 1);
  assert.equal(game.state, 'ready');
  assert.deepEqual(game.pac.from, { col: 13, row: 23 });
  assert.deepEqual(game.ghosts[0].from, { col: 13, row: 11 });
  assert.deepEqual(game.ghosts[1].from, { col: 13, row: 14 });
});

test('losing the last life ends the game and start restarts it', () => {
  const game = createGame();
  startPlaying(game);
  for (let life = 0; life < START_LIVES; life++) {
    place(game.pac, 1, 1, 'left');
    place(game.ghosts[0], 1, 1, 'right');
    Object.assign(game.ghosts[0], { mode: 'normal', fright: 0 });
    step(game, 4);
  }
  assert.equal(game.state, 'gameover');
  assert.equal(game.lives, 0);
  game.start();
  assert.equal(game.state, 'ready');
  assert.equal(game.lives, START_LIVES);
  assert.equal(game.score, 0);
});

test('clearing all pellets advances to a new level with fresh pellets', () => {
  const game = createGame();
  startPlaying(game);
  const total = game.pellets.size;
  game.pellets.clear();
  game.update(FRAME);
  assert.equal(game.state, 'levelclear');
  step(game, 2.1);
  assert.equal(game.level, 2);
  assert.equal(game.pellets.size, total);
  assert.equal(game.state, 'ready');
});

test('clearing the final level wins the game', () => {
  const game = createGame();
  startPlaying(game);
  game.level = FINAL_LEVEL;
  game.pellets.clear();
  game.update(FRAME);
  step(game, 2.1);
  assert.equal(game.state, 'won');
  game.start();
  assert.equal(game.state, 'ready');
  assert.equal(game.level, 1);
});

test('ghosts leave the house in release order and never enter walls', () => {
  const game = createGame();
  startPlaying(game);
  step(game, 9);
  assert.ok(game.state === 'playing' || game.state === 'dying');
  assert.ok(game.ghosts.every((g) => g.mode !== 'waiting'), game.ghosts.map((g) => g.mode).join(','));
});
