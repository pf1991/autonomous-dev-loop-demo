# autonomous-dev-loop-demo

A mini tower defense game built entirely by the autonomous-dev-loop AI skill — no human wrote the game code.

## Commands

- **Build**: `npm run build`
- **Dev**: `npm run dev`
- **Test**: `npm run test`
- **Lint**: `npm run lint`
- **E2E**: `npx playwright test` (install once: `npx playwright install --with-deps chromium`)

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
- All visual styles live in `src/index.css`; every PR that adds or changes a component must update this file so tiles, the HUD, and layout are visible in the browser

## QA Requirements

Unit tests alone are insufficient for this project. Every PR that touches a component or game hook **must** also pass a browser smoke test via Playwright.

### QA owns E2E tests end-to-end

**QA** is responsible for writing, maintaining, and running the Playwright suite:

- E2E tests live in `e2e/` (e.g. `e2e/smoke.spec.js`)
- `playwright.config.js` must exist at the repo root with `baseURL: 'http://localhost:5173'`
- If `e2e/` does not yet exist, QA must create it (including config and initial smoke spec) before marking any PR as passing
- When Coder adds or changes a visible component, QA adds corresponding assertions to the smoke test

### QA run order on every PR

1. `npm run dev` — start the Vite dev server in the background
2. `npx playwright install --with-deps chromium` — idempotent, safe to re-run
3. Write or update `e2e/smoke.spec.js` to cover any new/changed components
4. `npx playwright test` — run the suite
5. Assertions must include: `.game-board` visible, `.hud` visible, clicking a `.tower-slot` tile produces a `.tower-icon`
6. Kill the dev server after tests complete

QA fails the PR if either `npm test` or `npx playwright test` exits non-zero.
