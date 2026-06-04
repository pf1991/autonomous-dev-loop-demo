# autonomous-dev-loop-demo

A mini tower defense game built entirely by the autonomous-dev-loop AI skill — no human wrote the game code.

## Commands

- **Build**: `npm run build`
- **Dev**: `npm run dev`
- **Test**: `npm run test`
- **Lint**: `npm run lint`

Note: Run `npm install` first on a fresh checkout.

## Architecture

### File structure
- `src/components/` — React components (one file per component)
- `src/game/` — Game logic: pure functions only, zero React imports allowed
- `src/hooks/` — Custom React hooks (game loop, state management)
- `src/App.jsx` — Root component; all top-level game state lives here
- `tests/` — Unit tests (Vitest)

### Rules
- No direct DOM manipulation inside components (use React state/refs only)
- `src/game/` files: pure functions only — no side effects, no imports from `react`
- Components render and call game functions; they contain zero game logic
- Tests: Vitest with `describe`/`it`/`expect` — no Enzyme, no testing-library required
- ESLint: zero warnings on commit (`npm run lint` must exit 0)
- One component per file; filenames match component names (PascalCase)
