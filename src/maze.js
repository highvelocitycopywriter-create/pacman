// The maze layout and tile lookups. No browser dependencies.
// Legend: # wall, . pellet, o power pellet, - ghost house door, space = open floor.
export const MAZE = [
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

export const ROWS = MAZE.length;
export const COLS = MAZE[0].length;
export const TUNNEL_ROW = 14;
export const PACMAN_START = { col: 13, row: 23, dir: 'left' };
export const GHOST_DOOR = { col: 13, row: 11 }; // tile just outside the house door
export const GHOST_HOME = { col: 13, row: 14 }; // tile inside the house

export const GHOST_DEFS = [
  { name: 'blinky', color: '#ff0000', start: { col: 13, row: 11, dir: 'left' }, scatter: { col: 25, row: -2 }, release: 0 },
  { name: 'pinky', color: '#ffb8ff', start: { col: 13, row: 14, dir: 'up' }, scatter: { col: 2, row: -2 }, release: 1 },
  { name: 'inky', color: '#00ffff', start: { col: 11, row: 14, dir: 'up' }, scatter: { col: 27, row: 32 }, release: 4 },
  { name: 'clyde', color: '#ffb852', start: { col: 16, row: 14, dir: 'up' }, scatter: { col: 0, row: 32 }, release: 7 },
];

export function wrapCol(col) {
  return ((col % COLS) + COLS) % COLS;
}

export function cell(col, row) {
  if (row < 0 || row >= ROWS) return '#';
  return MAZE[row][wrapCol(col)];
}

export function isWall(col, row) {
  return cell(col, row) === '#';
}

export function isDoor(col, row) {
  return cell(col, row) === '-';
}

export function pelletKey(col, row) {
  return row * COLS + wrapCol(col);
}

/** Map of pellet key to '.' or 'o' for every pellet in the maze. */
export function buildPellets() {
  const pellets = new Map();
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const ch = MAZE[row][col];
      if (ch === '.' || ch === 'o') pellets.set(pelletKey(col, row), ch);
    }
  }
  return pellets;
}
