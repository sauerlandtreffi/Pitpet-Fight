# PitSpin Duel

PitSpin Duel is a deterministic, single-match pitpet duel prototype built with Vite and TypeScript. It recreates the forge-slot combat loop, PetJack mini-game, and lightweight AI opponent outlined in the design brief.

## Getting Started

```bash
npm install
npm run dev
```

The Vite dev server will print a local URL (typically `http://localhost:5173`). Open it in a modern Chromium, Firefox, or Edge browser.

### Production Build

```bash
npm run build
```

The production build outputs to `dist/`. Serve the contents of `dist/` with any static file server or `npm run preview` for a local preview.

## Project Structure

```
├── index.html          # App entry
├── package.json        # Scripts and dev dependencies
├── tsconfig.json       # Strict TypeScript config
├── vite.config.ts      # Vite bundler setup
├── src/
│   ├── main.ts         # Bootstraps UI and state
│   ├── styles.css      # Layout and styling
│   └── game/
│       ├── ai.ts       # AI spin selection logic
│       ├── combat.ts   # Turn resolution and damage math
│       ├── config.ts   # Tunable constants, pitpet stats, reel weights
│       ├── petjack.ts  # Blackjack-lite mini-game implementation
│       ├── reels.ts    # Forge-slot spinning, locking, respins
│       ├── rng.ts      # Seeded RNG (LCG)
│       ├── state.ts    # Game state machine and data model
│       ├── types.ts    # Shared TypeScript types
│       └── utils.ts    # Helpers (clamp, weighting, formatting)
└── README.md
```

## Tweaking the Game

Edit values in `src/game/config.ts` to adjust stats, weights, and multipliers. Save changes while `npm run dev` is running to hot-reload the session. Use the in-game "Reset Config" button to revert to defaults at runtime.

## Known Limitations

- Visual polish is intentionally light; animations are minimal.
- The AI’s expected value approximation ignores crit variance and status odds for simplicity.
- Accessibility relies on keyboard shortcuts and descriptive labels, but no screen reader narration has been added yet.

Enjoy crafting the ultimate PitSpin Duel!
