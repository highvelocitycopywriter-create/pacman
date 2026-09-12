from dotenv import load_dotenv
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

load_dotenv(override=True)

PROMPT = """
Make a vanilla HTML+JS+CSS Pac-Man game. Create three files -- index.html,
style.css, and game.js -- using RELATIVE paths in the current working directory.
Do not use absolute paths and do not write to the home directory.

Requirements for the maze and game logic:

- Define the maze as a fixed 2D array literal (a hardcoded layout), NOT generated
  procedurally with modulo math. Use a classic Pac-Man style layout: outer border
  walls, symmetric interior wall blocks, and open corridors.
- GUARANTEE every non-wall cell is reachable from Pac-Man's start position. The
  corridors must form one connected network with no sealed-off pockets, so that
  eating all pellets to win is always possible.
- Place pellets only on reachable floor cells. Place the 4 power-pellets in the
  four corners of the open corridor area (not inside walls).
- Pac-Man starts on a known open cell. All 4 ghosts start on known open cells
  (a central "ghost house" area is ideal).
- When Pac-Man or a ghost respawns after a collision, they must return to their
  designated open start cell -- never a random cell that could be a wall.
- Ghosts chase Pac-Man with simple AI; power-pellets make ghosts vulnerable.
- Score display, lives (start with 3), and Start/Pause/Reset controls.
- Keep everything vanilla HTML+JS+CSS. No libraries or frameworks.

Before finishing, verify the maze array has no sealed pockets by reasoning through
connectivity.
"""

TOOLS = ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "AskUserQuestion"]

async def main():
    options = ClaudeAgentOptions(allowed_tools=TOOLS, model="claude-sonnet-4-6")
    async for message in query(prompt=PROMPT, options=options):
        print(message)

asyncio.run(main())



