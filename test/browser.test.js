// Smoke tests for the browser modules using stubbed canvas, audio and DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.js';
import { createRenderer, TILE } from '../src/render.js';
import { sound } from '../src/sound.js';
import { ROWS, COLS } from '../src/maze.js';
import { step, place, startPlaying, FRAME } from './helpers.js';

function fakeCanvas() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, name) => (name === 'measureText' ? () => ({ width: 100 }) : (...args) => calls.push([name, args])),
    set: () => true,
  });
  return { canvas: { getContext: () => ctx, width: 0, height: 0 }, calls };
}

class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.destination = {};
    this.oscillators = 0;
    this.resumed = 0;
  }
  resume() { this.resumed++; this.state = 'running'; }
  createOscillator() {
    this.oscillators++;
    const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
    return { frequency: param, connect: () => ({ connect() {} }), start() {}, stop() {} };
  }
  createGain() {
    return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: () => ({}) };
  }
}

test('renderer sizes the canvas to the maze and draws every game state', () => {
  const { canvas, calls } = fakeCanvas();
  const game = createGame();
  const renderer = createRenderer(canvas, game);
  assert.equal(canvas.width, COLS * TILE);
  assert.equal(canvas.height, ROWS * TILE);

  renderer.draw();
  assert.ok(calls.some(([name]) => name === 'fillText'), 'idle banner drawn');

  startPlaying(game);
  game.setWantedDir('left');
  step(game, 0.5);
  game.ghosts[0].fright = 5;
  game.ghosts[1].fright = 1;
  game.ghosts[2].mode = 'eyes';
  renderer.draw();

  game.state = 'dying';
  game.timer = 1;
  renderer.draw();

  for (const state of ['paused', 'levelclear', 'gameover', 'won']) {
    game.state = state;
    calls.length = 0;
    renderer.draw();
    assert.ok(calls.some(([name]) => name === 'fillText'), `${state} banner drawn`);
  }
});

test('sound creates one audio context, resumes it, and plays a tone per effect', () => {
  const original = globalThis.AudioContext;
  globalThis.AudioContext = FakeAudioContext;
  try {
    sound.ctx = null;
    sound.enabled = true;
    sound.init();
    sound.init();
    const ctx = sound.ctx;
    assert.equal(ctx.resumed, 1);
    sound.pellet();
    sound.pellet();
    sound.power();
    sound.ghost();
    sound.death();
    assert.equal(ctx.oscillators, 5);
    sound.enabled = false;
    sound.pellet();
    assert.equal(ctx.oscillators, 5, 'muted sound plays nothing');
  } finally {
    globalThis.AudioContext = original;
    sound.ctx = null;
    sound.enabled = true;
  }
});

test('main wires the page: keyboard steers, Enter starts, buttons and HUD work', async () => {
  const { canvas } = fakeCanvas();
  const elements = {};
  const listeners = {};
  const listen = (target) => (type, handler) => { (listeners[`${target}:${type}`] ??= []).push(handler); };
  const element = (id) => (elements[id] ??= { textContent: '', addEventListener: listen(id), dataset: { dir: id } });
  Object.assign(canvas, { addEventListener: listen('canvas') });
  const stored = {};
  let rafCallback = null;
  Object.assign(globalThis, {
    document: {
      getElementById: (id) => (id === 'game' ? canvas : element(id)),
      querySelectorAll: () => ['up', 'left', 'right', 'down'].map(element),
      addEventListener: listen('document'),
    },
    localStorage: { getItem: (k) => stored[k] ?? null, setItem: (k, v) => { stored[k] = v; } },
    performance: { now: () => 0 },
    requestAnimationFrame: (cb) => { rafCallback = cb; },
    AudioContext: FakeAudioContext,
  });

  await import('../src/main.js');
  const fire = (key, type, event) => listeners[`${key}:${type}`].forEach((h) => h(event));
  const frames = (n) => { for (let i = 0; i < n; i++) rafCallback(i * 1000 / 60); };

  fire('document', 'keydown', { key: 'Enter' });
  frames(130);
  assert.equal(elements.lives.textContent, 3);
  assert.equal(elements.level.textContent, 1);

  let prevented = 0;
  fire('document', 'keydown', { key: 'ArrowLeft', preventDefault: () => prevented++ });
  fire('document', 'keydown', { key: 'A', preventDefault: () => prevented++ });
  assert.equal(prevented, 2);
  frames(60);
  assert.ok(elements.score.textContent > 0, 'moving left eats pellets');
  assert.equal(stored['pacman-high'], String(elements.score.textContent));

  fire('document', 'keydown', { key: 'p' });
  frames(1);
  assert.equal(elements.pause.textContent, 'Resume');
  fire('pause', 'click');
  frames(1);
  assert.equal(elements.pause.textContent, 'Pause');

  fire('sound', 'click');
  assert.equal(elements.sound.textContent, 'Sound: Off');
  fire('sound', 'click');
  assert.equal(elements.sound.textContent, 'Sound: On');

  fire('up', 'pointerdown', { preventDefault() {} });
  fire('canvas', 'pointerdown', { clientX: 0, clientY: 0 });
  fire('canvas', 'pointermove', { clientX: 5, clientY: 5 });
  fire('canvas', 'pointermove', { clientX: 60, clientY: 0 });
  fire('canvas', 'pointerdown', { clientX: 0, clientY: 0 });
  fire('canvas', 'pointermove', { clientX: 0, clientY: -60 });
  fire('canvas', 'pointerup');
  fire('canvas', 'pointercancel');

  fire('reset', 'click');
  frames(1);
  assert.equal(elements.score.textContent, 0);
  fire('start', 'click');
  frames(1);
  assert.equal(elements.lives.textContent, 3);
});
