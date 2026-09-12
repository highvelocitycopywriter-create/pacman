// Canvas rendering of the game state. Reads the game, never changes it.
import { ROWS, COLS, isWall, isDoor } from './maze.js';
import { DIRS, position } from './movement.js';
import { DEATH_SECONDS } from './game.js';

export const TILE = 20;
const FACING = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
const OVERLAY_TEXT = {
  idle: 'PRESS START',
  ready: 'READY!',
  paused: 'PAUSED',
  gameover: 'GAME OVER',
  won: 'YOU WIN!',
  levelclear: 'LEVEL CLEAR',
};
const RESTART_HINT = 'PRESS START TO PLAY AGAIN';

export function createRenderer(canvas, game) {
  const ctx = canvas.getContext('2d');
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;

  function pixels(m) {
    const p = position(m);
    return { x: p.x * TILE, y: p.y * TILE };
  }

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

  function drawPacman() {
    const pac = game.pac;
    const { x, y } = pixels(pac);
    const r = TILE / 2 - 1;
    let mouth;
    if (game.state === 'dying') {
      mouth = ((DEATH_SECONDS - game.timer) / DEATH_SECONDS) * Math.PI;
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
    const { x, y } = pixels(g);
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

  function drawOverlay() {
    const text = OVERLAY_TEXT[game.state];
    if (!text) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawBanner(text, 17, game.state === 'gameover' ? '#ff0000' : '#ffe600', 18);
    if (game.state === 'gameover' || game.state === 'won') drawBanner(RESTART_HINT, 20, '#fff', 13);
  }

  function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawMaze();
    drawPellets();
    if (game.state !== 'dying') for (const g of game.ghosts) drawGhost(g);
    drawPacman();
    drawOverlay();
  }

  return { draw };
}
