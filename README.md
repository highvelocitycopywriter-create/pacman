# Pac-Man

A vanilla HTML, CSS and JavaScript Pac-Man game. No libraries or build step.

The page uses ES modules, so serve the folder and open http://localhost:8000:

```
python3 -m http.server
```

Arrow keys or WASD move Pac-Man. Enter starts, P pauses. On touch devices,
swipe on the maze or use the on-screen pad. Clear three levels to win.

## Layout

- `src/maze.js`, `src/movement.js`, `src/game.js`: game logic with no browser dependencies.
- `src/render.js`, `src/sound.js`, `src/main.js`: canvas drawing, Web Audio, and page wiring.
- `test/`: Node test-runner suites for the maze, movement and collisions, scoring, win/lose flow, and browser wiring.

Run the tests with `node --test`, or with coverage (thresholds at 80%):

```
npm test
```
