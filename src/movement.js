// Grid movement. A mover travels from tile `from` to tile `to`; `t` is the
// progress in [0, 1]. Positions are in tile units (0.5 = centre of column 0).
import { wrapCol } from './maze.js';

export const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};
export const DIR_NAMES = ['up', 'left', 'down', 'right'];
export const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
export const TOUCH_DISTANCE = 0.6;

export function dist2(a, b) {
  return (a.col - b.col) ** 2 + (a.row - b.row) ** 2;
}

export function sameTile(a, b) {
  return a.col === b.col && a.row === b.row;
}

export function makeMover(col, row, dir) {
  return { from: { col, row }, to: { col, row }, t: 1, dir, moving: false };
}

export function position(m) {
  return {
    x: m.from.col + (m.to.col - m.from.col) * m.t + 0.5,
    y: m.from.row + (m.to.row - m.from.row) * m.t + 0.5,
  };
}

/** The tile the mover is closest to, with the column wrapped into the maze. */
export function tileOf(m) {
  const tile = m.t < 0.5 ? m.from : m.to;
  return { col: wrapCol(tile.col), row: tile.row };
}

export function touching(a, b) {
  const p = position(a);
  const q = position(b);
  return Math.hypot(p.x - q.x, p.y - q.y) <= TOUCH_DISTANCE;
}

export function reverse(m) {
  if (!m.moving) return;
  const from = m.from;
  m.from = m.to;
  m.to = from;
  m.t = 1 - m.t;
  m.dir = OPPOSITE[m.dir];
}

/** Move `dist` tiles along the grid, asking `chooseDir` for a new direction at each tile centre. */
export function advance(m, dist, canEnter, chooseDir) {
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
