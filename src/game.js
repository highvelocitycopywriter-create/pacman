// Game rules: Pac-Man, ghosts, scoring, lives, levels. No browser dependencies.
// Events emitted through `onEvent(name, detail)`: pellet, power, ghost, death, highscore.
import {
  PACMAN_START, GHOST_DOOR, GHOST_HOME, GHOST_DEFS, TUNNEL_ROW, isWall, isDoor, pelletKey, buildPellets,
} from './maze.js';
import {
  DIRS, DIR_NAMES, OPPOSITE, dist2, sameTile, makeMover, tileOf, touching, reverse, advance,
} from './movement.js';

// Speeds in tiles per second.
export const SPEED = { pac: 7, ghost: 6.5, tunnel: 3.5, fright: 4, eyes: 12, house: 4 };
// Seconds per phase, alternating scatter / chase; chase forever afterwards.
export const MODE_SCHEDULE = [7, 20, 7, 20, 5, 20];
export const FINAL_LEVEL = 3;
export const START_LIVES = 3;
export const READY_SECONDS = 2;
export const DEATH_SECONDS = 1.5;
export const LEVEL_CLEAR_SECONDS = 2;
export const POINTS = { pellet: 10, power: 50, ghost: 200 };

export function createGame({ onEvent = () => {}, highScore = 0 } = {}) {
  const game = {
    state: 'idle',
    score: 0,
    high: highScore,
    lives: START_LIVES,
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

  function pacSpeed() {
    return Math.min(SPEED.pac + 0.25 * (game.level - 1), 9);
  }

  function updatePacman(dt) {
    const pac = game.pac;
    if (pac.want && pac.moving && pac.want === OPPOSITE[pac.dir]) reverse(pac);
    advance(pac, pacSpeed() * dt, pacCanEnter, pacChooseDir);
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
    if (ch !== 'o') {
      addScore(POINTS.pellet);
      onEvent('pellet');
      return;
    }
    addScore(POINTS.power);
    onEvent('power');
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

  function pickDir(options, here, target, farthest) {
    let best = options[0];
    let bestDist = farthest ? -1 : Infinity;
    for (const dir of options) {
      const next = { col: here.col + DIRS[dir].dx, row: here.row + DIRS[dir].dy };
      const d = dist2(next, target);
      if (farthest ? d > bestDist : d < bestDist) {
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
    if (g.fright > 0 && g.mode === 'normal') return pickDir(options, here, tileOf(game.pac), true);
    return pickDir(options, here, ghostTarget(g), false);
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

  function ghostIsSolid(g) {
    return g.mode !== 'eyes' && g.mode !== 'entering' && g.mode !== 'waiting';
  }

  function checkCollisions() {
    for (const g of game.ghosts) {
      if (!ghostIsSolid(g) || !touching(game.pac, g)) continue;
      if (g.fright > 0) {
        eatGhost(g);
      } else {
        loseLife();
        return;
      }
    }
  }

  function eatGhost(g) {
    g.fright = 0;
    g.mode = 'eyes';
    game.ghostChain++;
    addScore(POINTS.ghost * 2 ** (game.ghostChain - 1));
    onEvent('ghost');
  }

  function loseLife() {
    game.state = 'dying';
    game.timer = DEATH_SECONDS;
    onEvent('death');
  }

  // ---------- Game flow ----------

  function addScore(points) {
    game.score += points;
    if (game.score > game.high) {
      game.high = game.score;
      onEvent('highscore', game.high);
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

  function getReady() {
    resetPositions();
    game.state = 'ready';
    game.timer = READY_SECONDS;
  }

  function reset() {
    game.score = 0;
    game.lives = START_LIVES;
    game.level = 1;
    game.pellets = buildPellets();
    resetPositions();
    game.state = 'idle';
  }

  function start() {
    if (game.state === 'paused') {
      game.state = 'playing';
      return;
    }
    if (game.state !== 'idle' && game.state !== 'gameover' && game.state !== 'won') return;
    reset();
    getReady();
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
    getReady();
  }

  function afterLevelClear() {
    if (game.level >= FINAL_LEVEL) {
      game.state = 'won';
      return;
    }
    game.level++;
    game.pellets = buildPellets();
    getReady();
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
      game.timer = LEVEL_CLEAR_SECONDS;
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
        if (game.timer <= 0) afterLevelClear();
        break;
    }
  }

  function setWantedDir(dir) {
    game.pac.want = dir;
  }

  reset();
  return Object.assign(game, { update, start, togglePause, reset, setWantedDir });
}
