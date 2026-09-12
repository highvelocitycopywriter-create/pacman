import { makeMover } from '../src/movement.js';

export const FRAME = 1 / 60;

/** Advance the game by `seconds` in 60 Hz frames. */
export function step(game, seconds) {
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) game.update(FRAME);
}

/** Put a mover on a tile, stationary, facing `dir`. */
export function place(mover, col, row, dir) {
  Object.assign(mover, makeMover(col, row, dir));
}

/** Start a game and skip the READY countdown. */
export function startPlaying(game) {
  game.start();
  step(game, 2);
  game.update(FRAME);
}
