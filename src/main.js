// Wires the game logic to the page: canvas, HUD, sound, keyboard and touch input.
import { createGame } from './game.js';
import { createRenderer } from './render.js';
import { sound } from './sound.js';

const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
};
const HIGH_SCORE_KEY = 'pacman-high';

const game = createGame({
  highScore: Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0,
  onEvent(name, detail) {
    if (name === 'highscore') localStorage.setItem(HIGH_SCORE_KEY, String(detail));
    else sound[name]();
  },
});

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas, game);
const hud = {
  score: document.getElementById('score'),
  high: document.getElementById('high'),
  level: document.getElementById('level'),
  lives: document.getElementById('lives'),
};
const pauseButton = document.getElementById('pause');
const soundButton = document.getElementById('sound');

function startGame() {
  sound.init();
  game.start();
}

function steer(dir) {
  sound.init();
  game.setWantedDir(dir);
}

document.addEventListener('keydown', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const dir = KEYS[key];
  if (dir) {
    event.preventDefault();
    steer(dir);
  } else if (key === 'p') {
    game.togglePause();
  } else if (key === 'Enter') {
    startGame();
  }
});

document.getElementById('start').addEventListener('click', startGame);
pauseButton.addEventListener('click', () => game.togglePause());
document.getElementById('reset').addEventListener('click', () => game.reset());
soundButton.addEventListener('click', () => {
  sound.enabled = !sound.enabled;
  soundButton.textContent = sound.enabled ? 'Sound: On' : 'Sound: Off';
});

for (const button of document.querySelectorAll('.dpad button')) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    steer(button.dataset.dir);
  });
}

const SWIPE_MIN = 24;
let swipeStart = null;
canvas.addEventListener('pointerdown', (event) => {
  sound.init();
  swipeStart = { x: event.clientX, y: event.clientY };
});
canvas.addEventListener('pointermove', (event) => {
  if (!swipeStart) return;
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
  if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 'right' : 'left');
  else steer(dy > 0 ? 'down' : 'up');
  swipeStart = null;
});
canvas.addEventListener('pointerup', () => { swipeStart = null; });
canvas.addEventListener('pointercancel', () => { swipeStart = null; });

function drawHud() {
  hud.score.textContent = game.score;
  hud.high.textContent = game.high;
  hud.level.textContent = game.level;
  hud.lives.textContent = game.lives;
  pauseButton.textContent = game.state === 'paused' ? 'Resume' : 'Pause';
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  game.update(dt);
  renderer.draw();
  drawHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
