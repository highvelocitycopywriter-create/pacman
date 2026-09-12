'use strict';

// Legend: # wall, . pellet, o power pellet, - ghost house door, space = open floor.
const MAZE = [
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '######.##### ## #####.######',
  '######.##          ##.######',
  '######.## ###--### ##.######',
  '######.## #      # ##.######',
  '      .   #      #   .      ',
  '######.## #      # ##.######',
  '######.## ######## ##.######',
  '######.##          ##.######',
  '######.## ######## ##.######',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##.......  .......##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
];

const TILE = 20;
const ROWS = MAZE.length;
const COLS = MAZE[0].length;
const TUNNEL_ROW = 14;
const PACMAN_START = { col: 13, row: 23, dir: 'left' };
const GHOST_DOOR = { col: 13, row: 11 }; // tile just outside the house door
const GHOST_HOME = { col: 13, row: 14 }; // tile inside the house

const GHOST_DEFS = [
  { name: 'blinky', color: '#ff0000', start: { col: 13, row: 11, dir: 'left' }, scatter: { col: 25, row: -2 }, release: 0 },
  { name: 'pinky', color: '#ffb8ff', start: { col: 13, row: 14, dir: 'up' }, scatter: { col: 2, row: -2 }, release: 1 },
  { name: 'inky', color: '#00ffff', start: { col: 11, row: 14, dir: 'up' }, scatter: { col: 27, row: 32 }, release: 4 },
  { name: 'clyde', color: '#ffb852', start: { col: 16, row: 14, dir: 'up' }, scatter: { col: 0, row: 32 }, release: 7 },
];

// Speeds in tiles per second.
const SPEED = { pac: 7, ghost: 6.5, tunnel: 3.5, fright: 4, eyes: 12, house: 4 };
// Seconds per phase, alternating scatter / chase; chase forever afterwards.
const MODE_SCHEDULE = [7, 20, 7, 20, 5, 20];
const FINAL_LEVEL = 3;

const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};
const DIR_NAMES = ['up', 'left', 'down', 'right'];
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hud = {
  score: document.getElementById('score'),
  high: document.getElementById('high'),
  level: document.getElementById('level'),
  lives: document.getElementById('lives'),
};
const pauseButton = document.getElementById('pause');

const game = {
  state: 'idle',
  score: 0,
  high: Number(localStorage.getItem('pacman-high')) || 0,
  lives: 3,
  level: 1,
  pellets: new Map(),
  pac: null,
  ghosts: [],
  timer: 0,
  time: 0,
  houseTimer: 0,
  modeIndex: 0,
  modeTimer: 0,
  chase: false,
  ghostChain: 0,
};

// ---------- Maze helpers ----------

function wrapCol(col) {
  return ((col % COLS) + COLS) % COLS;
}

function cell(col, row) {
  if (row < 0 || row >= ROWS) return '#';
  return MAZE[row][wrapCol(col)];
}

function isWall(col, row) {
  return cell(col, row) === '#';
}

function isDoor(col, row) {
  return cell(col, row) === '-';
}

function pelletKey(col, row) {
  return row * COLS + wrapCol(col);
}

function buildPellets() {
  const pellets = new Map();
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const ch = MAZE[row][col];
      if (ch === '.' || ch === 'o') pellets.set(pelletKey(col, row), ch);
    }
  }
  return pellets;
}

function dist2(a, b) {
  return (a.col - b.col) ** 2 + (a.row - b.row) ** 2;
}

function sameTile(a, b) {
  return a.col === b.col && a.row === b.row;
}

// ---------- Movers ----------
// A mover travels from tile `from` to tile `to`; `t` is the progress in [0, 1].

function makeMover(col, row, dir) {
  return { from: { col, row }, to: { col, row }, t: 1, dir, moving: false };
}

function position(m) {
  return {
    x: (m.from.col + (m.to.col - m.from.col) * m.t + 0.5) * TILE,
    y: (m.from.row + (m.to.row - m.from.row) * m.t + 0.5) * TILE,
  };
}

function tileOf(m) {
  const tile = m.t < 0.5 ? m.from : m.to;
  return { col: wrapCol(tile.col), row: tile.row };
}

function reverse(m) {
  if (!m.moving) return;
  const from = m.from;
  m.from = m.to;
  m.to = from;
  m.t = 1 - m.t;
  m.dir = OPPOSITE[m.dir];
}

/** Move `dist` tiles along the grid, asking `chooseDir` for a new direction at each tile centre. */
function advance(m, dist, canEnter, chooseDir) {
  while (dist > 0) {
    if (m.t >= 1) {
      m.from = { col: wrapCol(m.to.col), row: m.to.row };
      m.to = m.from;
      m.t = 0;
      const dir = chooseDir(m);
      const next = dir && { col: m.from.col + DIRS[dir].dx, row: m.from.row + DIRS[dir].dy };
      if (!next || !canEnter(next.col, next.row)) {
        m.moving = false;
        m.t = 1;
        return;
      }
      m.dir = dir;
      m.moving = true;
      m.to = next;
    }
    const step = Math.min(dist, 1 - m.t);
    m.t += step;
    dist -= step;
  }
}

// ---------- Pac-Man ----------

function pacCanEnter(col, row) {
  return !isWall(col, row) && !isDoor(col, row);
}

function pacChooseDir(pac) {
  const here = pac.from;
  const open = (dir) => pacCanEnter(here.col + DIRS[dir].dx, here.row + DIRS[dir].dy);
  if (pac.want && open(pac.want)) return pac.want;
  if (open(pac.dir)) return pac.dir;
  return null;
}

function updatePacman(dt) {
  const pac = game.pac;
  if (pac.want && pac.moving && pac.want === OPPOSITE[pac.dir]) reverse(pac);
  const speed = Math.min(SPEED.pac + 0.25 * (game.level - 1), 9);
  advance(pac, speed * dt, pacCanEnter, pacChooseDir);
}

function frightDuration() {
  return Math.max(2, 7 - (game.level - 1));
}

function eatPellet() {
  const tile = tileOf(game.pac);
  const key = pelletKey(tile.col, tile.row);
  const ch = game.pellets.get(key);
  if (!ch) return;
  game.pellets.delete(key);
  addScore(ch === 'o' ? 50 : 10);
  if (ch !== 'o') {
    sound.pellet();
    return;
  }
  sound.power();
  game.ghostChain = 0;
  for (const g of game.ghosts) {
    if (g.mode !== 'normal' && g.mode !== 'leaving') continue;
    g.fright = frightDuration();
    if (g.mode === 'normal') reverse(g);
  }
}

// ---------- Ghosts ----------

function ghostCanEnter(g, col, row) {
  if (isWall(col, row)) return false;
  if (isDoor(col, row)) return g.mode === 'leaving' || g.mode === 'entering';
  return true;
}

function inTunnel(g) {
  return g.from.row === TUNNEL_ROW && (g.from.col <= 5 || g.from.col >= 22);
}

function ghostSpeed(g) {
  if (g.mode === 'eyes' || g.mode === 'entering') return SPEED.eyes;
  if (g.mode === 'leaving') return SPEED.house;
  if (g.fright > 0) return SPEED.fright;
  if (inTunnel(g)) return SPEED.tunnel;
  return Math.min(SPEED.ghost + 0.25 * (game.level - 1), 8.5);
}

function chaseTarget(g) {
  const p = tileOf(game.pac);
  const d = DIRS[game.pac.dir];
  switch (g.name) {
    case 'pinky':
      return { col: p.col + 4 * d.dx, row: p.row + 4 * d.dy };
    case 'inky': {
      const blinky = tileOf(game.ghosts[0]);
      const ahead = { col: p.col + 2 * d.dx, row: p.row + 2 * d.dy };
      return { col: 2 * ahead.col - blinky.col, row: 2 * ahead.row - blinky.row };
    }
    case 'clyde':
      return dist2(tileOf(g), p) > 64 ? p : g.scatter;
    default:
      return p;
  }
}

function ghostTarget(g) {
  if (g.mode === 'eyes' || g.mode === 'leaving') return GHOST_DOOR;
  if (g.mode === 'entering') return GHOST_HOME;
  return game.chase ? chaseTarget(g) : g.scatter;
}

function fleeDir(options, here) {
  const pac = tileOf(game.pac);
  let best = options[0];
  let bestDist = -1;
  for (const dir of options) {
    const next = { col: here.col + DIRS[dir].dx, row: here.row + DIRS[dir].dy };
    const d = dist2(next, pac);
    if (d > bestDist) {
      bestDist = d;
      best = dir;
    }
  }
  return best;
}

function ghostChooseDir(g) {
  const here = g.from;
  if (g.mode === 'leaving' && sameTile(here, GHOST_DOOR)) g.mode = 'normal';
  else if (g.mode === 'eyes' && sameTile(here, GHOST_DOOR)) g.mode = 'entering';
  else if (g.mode === 'entering' && sameTile(here, GHOST_HOME)) g.mode = 'leaving';

  const options = DIR_NAMES.filter((dir) =>
    dir !== OPPOSITE[g.dir] && ghostCanEnter(g, here.col + DIRS[dir].dx, here.row + DIRS[dir].dy));
  if (options.length === 0) return OPPOSITE[g.dir];
  if (g.fright > 0 && g.mode === 'normal') return fleeDir(options, here);

  const target = ghostTarget(g);
  let best = options[0];
  let bestDist = Infinity;
  for (const dir of options) {
    const next = { col: here.col + DIRS[dir].dx, row: here.row + DIRS[dir].dy };
    const d = dist2(next, target);
    if (d < bestDist) {
      bestDist = d;
      best = dir;
    }
  }
  return best;
}

function updateGhost(g, dt) {
  if (g.fright > 0) g.fright -= dt;
  if (g.mode === 'waiting') {
    if (game.houseTimer >= g.release) g.mode = 'leaving';
    return;
  }
  advance(g, ghostSpeed(g) * dt, (col, row) => ghostCanEnter(g, col, row), () => ghostChooseDir(g));
}

function updateModeTimer(dt) {
  if (game.modeIndex >= MODE_SCHEDULE.length) return;
  game.modeTimer -= dt;
  if (game.modeTimer > 0) return;
  game.modeIndex++;
  game.chase = game.modeIndex >= MODE_SCHEDULE.length || game.modeIndex % 2 === 1;
  game.modeTimer = MODE_SCHEDULE[game.modeIndex] ?? Infinity;
  for (const g of game.ghosts) if (g.mode === 'normal') reverse(g);
}

function checkCollisions() {
  const p = position(game.pac);
  for (const g of game.ghosts) {
    if (g.mode === 'eyes' || g.mode === 'entering' || g.mode === 'waiting') continue;
    const q = position(g);
    if (Math.hypot(p.x - q.x, p.y - q.y) > TILE * 0.6) continue;
    if (g.fright > 0) {
      g.fright = 0;
      g.mode = 'eyes';
      game.ghostChain++;
      addScore(200 * 2 ** (game.ghostChain - 1));
      sound.ghost();
    } else {
      game.state = 'dying';
      game.timer = 1.5;
      sound.death();
      return;
    }
  }
}

// ---------- Sound (Web Audio, no files) ----------

const sound = {
  ctx: null,
  enabled: true,
  waka: false,
  init() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(from, to, duration, type = 'square', volume = 0.06) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duration);
  },
  pellet() {
    this.waka = !this.waka;
    this.tone(this.waka ? 440 : 330, this.waka ? 330 : 440, 0.08);
  },
  power() {
    this.tone(200, 400, 0.3, 'sawtooth');
  },
  ghost() {
    this.tone(400, 1200, 0.4, 'triangle');
  },
  death() {
    this.tone(600, 80, 1.2, 'sawtooth', 0.08);
  },
};

// ---------- Game flow ----------

function addScore(points) {
  game.score += points;
  if (game.score > game.high) {
    game.high = game.score;
    localStorage.setItem('pacman-high', String(game.high));
  }
}

function resetPositions() {
  game.pac = { ...makeMover(PACMAN_START.col, PACMAN_START.row, PACMAN_START.dir), want: null };
  game.ghosts = GHOST_DEFS.map((def) => ({
    ...def,
    ...makeMover(def.start.col, def.start.row, def.start.dir),
    mode: def.release === 0 ? 'normal' : 'waiting',
    fright: 0,
  }));
  game.houseTimer = 0;
  game.modeIndex = 0;
  game.modeTimer = MODE_SCHEDULE[0];
  game.chase = false;
  game.ghostChain = 0;
}

function resetGame() {
  game.score = 0;
  game.lives = 3;
  game.level = 1;
  game.pellets = buildPellets();
  resetPositions();
  game.state = 'idle';
}

function startGame() {
  sound.init();
  if (game.state === 'paused') {
    game.state = 'playing';
    return;
  }
  if (game.state !== 'idle' && game.state !== 'gameover' && game.state !== 'won') return;
  resetGame();
  game.state = 'ready';
  game.timer = 2;
}

function togglePause() {
  if (game.state === 'playing') game.state = 'paused';
  else if (game.state === 'paused') game.state = 'playing';
}

function afterDeath() {
  game.lives--;
  if (game.lives <= 0) {
    game.state = 'gameover';
    return;
  }
  resetPositions();
  game.state = 'ready';
  game.timer = 2;
}

function nextLevel() {
  game.level++;
  game.pellets = buildPellets();
  resetPositions();
  game.state = 'ready';
  game.timer = 2;
}

function updatePlaying(dt) {
  game.houseTimer += dt;
  updateModeTimer(dt);
  updatePacman(dt);
  eatPellet();
  for (const g of game.ghosts) updateGhost(g, dt);
  checkCollisions();
  if (game.state === 'playing' && game.pellets.size === 0) {
    game.state = 'levelclear';
    game.timer = 2;
  }
}

function update(dt) {
  game.time += dt;
  switch (game.state) {
    case 'ready':
      game.timer -= dt;
      if (game.timer <= 0) game.state = 'playing';
      break;
    case 'playing':
      updatePlaying(dt);
      break;
    case 'dying':
      game.timer -= dt;
      if (game.timer <= 0) afterDeath();
      break;
    case 'levelclear':
      game.timer -= dt;
      if (game.timer <= 0) {
        if (game.level >= FINAL_LEVEL) game.state = 'won';
        else nextLevel();
      }
      break;
  }
}

// ---------- Rendering ----------

function drawMaze() {
  ctx.fillStyle = '#2121de';
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (!isWall(col, row)) continue;
      const x = col * TILE;
      const y = row * TILE;
      const inset = 4;
      const x0 = x + (isWall(col - 1, row) ? 0 : inset);
      const x1 = x + TILE - (isWall(col + 1, row) ? 0 : inset);
      const y0 = y + (isWall(col, row - 1) ? 0 : inset);
      const y1 = y + TILE - (isWall(col, row + 1) ? 0 : inset);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  ctx.fillStyle = '#ffb8de';
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (isDoor(col, row)) ctx.fillRect(col * TILE, row * TILE + TILE / 2 - 2, TILE, 4);
    }
  }
}

function drawPellets() {
  const blink = Math.floor(game.time * 4) % 2 === 0;
  ctx.fillStyle = '#ffb8ae';
  for (const [key, ch] of game.pellets) {
    const col = key % COLS;
    const row = Math.floor(key / COLS);
    const x = col * TILE + TILE / 2;
    const y = row * TILE + TILE / 2;
    if (ch === 'o' && !blink) continue;
    ctx.beginPath();
    ctx.arc(x, y, ch === 'o' ? 6 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

const FACING = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

function drawPacman() {
  const pac = game.pac;
  const { x, y } = position(pac);
  const r = TILE / 2 - 1;
  let mouth;
  if (game.state === 'dying') {
    mouth = ((1.5 - game.timer) / 1.5) * Math.PI;
  } else if (pac.moving && game.state === 'playing') {
    mouth = 0.15 + 0.6 * Math.abs(Math.sin(game.time * 12));
  } else {
    mouth = 0.3;
  }
  const facing = FACING[pac.dir];
  ctx.fillStyle = '#ffe600';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, r, facing + mouth, facing + Math.PI * 2 - mouth);
  ctx.closePath();
  ctx.fill();
}

function drawGhost(g) {
  const { x, y } = position(g);
  const r = TILE / 2 - 1;
  const eyesOnly = g.mode === 'eyes' || g.mode === 'entering';
  if (!eyesOnly) {
    let body = g.color;
    if (g.fright > 0) {
      const flash = g.fright < 2 && Math.floor(game.time * 8) % 2 === 0;
      body = flash ? '#f0f0f0' : '#2121de';
    }
    const bottom = y + r;
    const bumps = 3;
    const w = (2 * r) / bumps;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y - 1, r, Math.PI, 0);
    ctx.lineTo(x + r, bottom);
    for (let i = 0; i < bumps; i++) {
      const bx = x + r - w * i;
      ctx.lineTo(bx - w / 2, bottom - 4);
      ctx.lineTo(bx - w, bottom);
    }
    ctx.closePath();
    ctx.fill();
  }
  const d = DIRS[g.dir];
  const frightened = g.fright > 0 && !eyesOnly;
  for (const side of [-1, 1]) {
    const ex = x + side * 4;
    const ey = y - 2;
    ctx.fillStyle = frightened ? '#ffb8ae' : '#fff';
    ctx.beginPath();
    ctx.ellipse(ex, ey, frightened ? 1.5 : 3, frightened ? 1.5 : 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (frightened) continue;
    ctx.fillStyle = '#2121de';
    ctx.beginPath();
    ctx.arc(ex + d.dx * 1.5, ey + d.dy * 1.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

const OVERLAY_TEXT = {
  idle: 'PRESS START',
  ready: 'READY!',
  paused: 'PAUSED',
  gameover: 'GAME OVER',
  won: 'YOU WIN!',
  levelclear: 'LEVEL CLEAR',
};
const RESTART_HINT = 'PRESS START TO PLAY AGAIN';

function drawOverlay() {
  const text = OVERLAY_TEXT[game.state];
  if (!text) return;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawBanner(text, 17, game.state === 'gameover' ? '#ff0000' : '#ffe600', 18);
  if (game.state === 'gameover' || game.state === 'won') drawBanner(RESTART_HINT, 20, '#fff', 13);
}

function drawBanner(text, row, color, size) {
  ctx.font = `bold ${size}px "Courier New", monospace`;
  const width = ctx.measureText(text).width + 16;
  const x = COLS * TILE / 2;
  const y = row * TILE + TILE / 2;
  ctx.fillStyle = '#000';
  ctx.fillRect(x - width / 2, y - size, width, size * 2);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawHud() {
  hud.score.textContent = game.score;
  hud.high.textContent = game.high;
  hud.level.textContent = game.level;
  hud.lives.textContent = game.lives;
  pauseButton.textContent = game.state === 'paused' ? 'Resume' : 'Pause';
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawMaze();
  drawPellets();
  if (game.state !== 'dying') for (const g of game.ghosts) drawGhost(g);
  drawPacman();
  drawOverlay();
  drawHud();
}

// ---------- Input and loop ----------

document.addEventListener('keydown', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const dir = KEYS[key];
  if (dir) {
    event.preventDefault();
    sound.init();
    game.pac.want = dir;
  } else if (key === 'p') {
    togglePause();
  } else if (key === 'Enter') {
    startGame();
  }
});

document.getElementById('start').addEventListener('click', startGame);
pauseButton.addEventListener('click', togglePause);
document.getElementById('reset').addEventListener('click', resetGame);
const soundButton = document.getElementById('sound');
soundButton.addEventListener('click', () => {
  sound.enabled = !sound.enabled;
  soundButton.textContent = sound.enabled ? 'Sound: On' : 'Sound: Off';
});

for (const button of document.querySelectorAll('.dpad button')) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    sound.init();
    game.pac.want = button.dataset.dir;
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
  if (Math.abs(dx) > Math.abs(dy)) game.pac.want = dx > 0 ? 'right' : 'left';
  else game.pac.want = dy > 0 ? 'down' : 'up';
  swipeStart = null;
});
canvas.addEventListener('pointerup', () => { swipeStart = null; });
canvas.addEventListener('pointercancel', () => { swipeStart = null; });

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

resetGame();
requestAnimationFrame(frame);
