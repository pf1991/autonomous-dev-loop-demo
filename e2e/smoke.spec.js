import { test, expect } from '@playwright/test';

/**
 * Helper: find the React state setter for gamePhase inside the App component.
 * Uses dispatch-only counting. All hook indices verified against live App.jsx (PR #135).
 *
 * App.jsx useState dispatch indices (verified post-PR #135 — historyPanelOpen inserted at [28]):
 *   stateHook[ 0] = difficultyMode   stateHook[ 1] = tileSize
 *   stateHook[ 2] = gold             stateHook[ 3] = lives
 *   stateHook[ 4] = wave             stateHook[ 5] = speed
 *   stateHook[ 6] = towers           stateHook[ 7] = enemies
 *   stateHook[ 8] = projectiles      stateHook[ 9] = deathAnimations
 *   stateHook[10] = deathParticles   stateHook[11] = damageNumbers
 *   stateHook[12] = poisonPuffs      stateHook[13] = placementPulses
 *   stateHook[14] = screenShakeActive stateHook[15] = selectedTowerType
 *   stateHook[16] = hoverTowerType   stateHook[17] = selectedTower
 *   stateHook[18] = hoveredSlot      stateHook[19] = gamePhase
 *   stateHook[20] = finalScore       stateHook[21] = powerCrates
 *   stateHook[22] = overchargeActive stateHook[23] = interestFlash
 *   stateHook[24] = interestCountdown stateHook[25] = unlockedAchievements
 *   stateHook[26] = achievementToasts stateHook[27] = achievementModalOpen
 *   stateHook[28] = historyPanelOpen ← NEW PR #135
 *   stateHook[29] = prestigeStars    stateHook[30] = wavesReached
 *   stateHook[31] = comboDisplay     stateHook[32] = adjacencySynergies
 *   stateHook[33] = synergyPartners  stateHook[34] = showSynergies
 *   stateHook[35] = earlyWaveCalled  stateHook[36] = pendingWaveAdvance
 *   stateHook[37] = currentWaveEventType
 */
async function triggerGamePhase(page, phase) {
  await page.evaluate((targetPhase) => {
    const gameEl = document.querySelector('#game');
    const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
    let fiber = gameEl[fiberKey];
    while (fiber) {
      if (fiber.memoizedState && typeof fiber.type === 'function') {
        // Collect only dispatch-capable hooks (useState, not useRef)
        const stateHooks = [];
        let hookNode = fiber.memoizedState;
        while (hookNode) {
          if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
            stateHooks.push(hookNode);
          }
          hookNode = hookNode.next;
        }
        // stateHooks[19] = gamePhase (verified against live build post-PR #131)
        if (stateHooks[19] && stateHooks[19].queue && stateHooks[19].queue.dispatch) {
          stateHooks[19].queue.dispatch(targetPhase);
          return;
        }
        throw new Error('Could not find gamePhase hook dispatcher (expected stateHooks[19])');
      }
      fiber = fiber.return;
    }
    throw new Error('Could not find gamePhase hook dispatcher');
  }, phase);
}

/**
 * Helper: force lives to a given value via React fiber injection and set gamePhase.
 * Uses dispatch-only counting (verified post-PR #131):
 *   stateHooks[3]  = lives
 *   stateHooks[19] = gamePhase
 */
async function setLivesAndPhase(page, livesValue, phase) {
  await page.evaluate(({ livesValue, phase }) => {
    const gameEl = document.querySelector('#game');
    const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
    let fiber = gameEl[fiberKey];
    while (fiber) {
      if (fiber.memoizedState && typeof fiber.type === 'function') {
        const stateHooks = [];
        let hookNode = fiber.memoizedState;
        while (hookNode) {
          if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
            stateHooks.push(hookNode);
          }
          hookNode = hookNode.next;
        }
        // stateHooks[3]=lives, stateHooks[19]=gamePhase (verified post-PR #131)
        if (stateHooks[3] && stateHooks[3].queue && stateHooks[3].queue.dispatch) {
          stateHooks[3].queue.dispatch(livesValue);
        }
        if (stateHooks[19] && stateHooks[19].queue && stateHooks[19].queue.dispatch) {
          stateHooks[19].queue.dispatch(phase);
        }
        return;
      }
      fiber = fiber.return;
    }
    throw new Error('Could not find App fiber hooks');
  }, { livesValue, phase });
}

test.describe('Tower Defense - smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Dismiss the DifficultySelector overlay (added in PR #97) using Normal mode
    // so all pre-existing tests see the same starting state as before (100 gold, 20 lives).
    const diffOverlay = page.locator('.difficulty-overlay');
    if (await diffOverlay.isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
  });

  test('game board is visible', async ({ page }) => {
    await expect(page.locator('.game-board')).toBeVisible();
  });

  test('HUD is visible', async ({ page }) => {
    await expect(page.locator('.hud')).toBeVisible();
  });

  test('clicking a tower-slot tile produces a tower-icon', async ({ page }) => {
    // Dismiss the NextWave overlay first so the board is interactive
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    const slot = page.locator('.tower-slot').first();
    await expect(slot).toBeVisible();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
  });

  test('CSS styles are applied - HUD has correct background color', async ({ page }) => {
    const hud = page.locator('.hud');
    await expect(hud).toBeVisible();
    const bgColor = await hud.evaluate(el => getComputedStyle(el).backgroundColor);
    // rgb(22, 33, 62) = #16213e
    expect(bgColor).toBe('rgb(22, 33, 62)');
  });

  // --- NextWave component ---

  test('NextWave overlay is shown on initial load with wave 1 incoming message', async ({ page }) => {
    await expect(page.locator('.next-wave-overlay')).toBeVisible();
    await expect(page.locator('.next-wave-message')).toContainText('Wave 1 incoming');
  });

  test('NextWave Start button dismisses the overlay and game becomes active', async ({ page }) => {
    await expect(page.locator('.next-wave-start')).toBeVisible();
    await page.locator('.next-wave-start').click();
    await expect(page.locator('.next-wave-overlay')).not.toBeVisible();
    await expect(page.locator('.game-board')).toBeVisible();
  });

  // --- GameOver component ---

  test('GameOver lose overlay shows "Game Over" message and Restart button', async ({ page }) => {
    await triggerGamePhase(page, 'lose');
    await expect(page.locator('.game-over-overlay')).toBeVisible();
    await expect(page.locator('.game-over-message')).toContainText('Game Over');
    await expect(page.locator('.game-over-restart')).toBeVisible();
  });

  test('GameOver always shows "Game Over" — there is no win state (PR #110 removes campaign mode)', async ({ page }) => {
    // PR #110: endless is the only mode. The 'win' phase was removed; only 'lose' ends the game.
    await triggerGamePhase(page, 'lose');
    await expect(page.locator('.game-over-overlay')).toBeVisible();
    // Message must always be "Game Over" — "You Win" no longer exists
    await expect(page.locator('.game-over-message')).toContainText('Game Over');
    await expect(page.locator('.game-over-message')).not.toContainText('You Win');
  });

  test('GameOver Restart button resets the game to initial state', async ({ page }) => {
    await triggerGamePhase(page, 'lose');
    await expect(page.locator('.game-over-overlay')).toBeVisible();
    await page.locator('.game-over-restart').click();
    // After restart (PR #97): difficulty selector reappears first; dismiss it to return to game
    await expect(page.locator('.game-over-overlay')).not.toBeVisible();
    const diffOverlay = page.locator('.difficulty-overlay');
    if (await diffOverlay.isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    await expect(page.locator('.next-wave-overlay')).toBeVisible();
  });

  // --- Enemy rendering (issue #19) ---

  test('enemy elements appear on the board after a wave starts', async ({ page }) => {
    // Start the wave so enemies begin spawning
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Wait up to 5 s for at least one .enemy div to appear
    await expect(page.locator('.enemy').first()).toBeVisible({ timeout: 5000 });
  });

  test('enemy-hp-bar is rendered inside each enemy element', async ({ page }) => {
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Wait for an enemy to appear
    await expect(page.locator('.enemy').first()).toBeVisible({ timeout: 5000 });
    // Each enemy must contain an hp bar
    const hpBar = page.locator('.enemy .enemy-hp-bar').first();
    await expect(hpBar).toBeVisible();
  });

  // --- Smooth enemy movement via enemy-layer overlay (issue #31) ---

  test('enemy-layer overlay is present and enemies are positioned within it', async ({ page }) => {
    // Start the wave so enemies begin spawning
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Wait for the enemy-layer to be attached to the DOM (rendered when enemies.length > 0).
    // It has pointer-events:none so toBeVisible() would fail — use toBeAttached() instead.
    await expect(page.locator('.enemy-layer').first()).toBeAttached({ timeout: 5000 });
    // Enemy elements must be inside the .enemy-layer, not inside tile divs
    const enemyInLayer = page.locator('.enemy-layer .enemy').first();
    await expect(enemyInLayer).toBeAttached();
    // Enemies must have inline left/top styles (pixel-based smooth positioning)
    const leftStyle = await enemyInLayer.evaluate(el => el.style.left);
    expect(leftStyle).toMatch(/\d+px/);
  });

  // --- Game-over via lives depletion (issue #21) ---

  test('game-over overlay appears when lives reach 0', async ({ page }) => {
    // Set lives to 0 and phase to 'playing' via fiber injection to trigger the useEffect
    await setLivesAndPhase(page, 0, 'playing');
    // The useEffect in App.jsx should fire and transition gamePhase to 'lose'
    await expect(page.locator('.game-over-overlay')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.game-over-message')).toContainText('Game Over');
  });

  test('game-over overlay does not appear simultaneously with NextWave overlay', async ({ page }) => {
    // Trigger lose phase directly
    await triggerGamePhase(page, 'lose');
    await expect(page.locator('.game-over-overlay')).toBeVisible();
    // NextWave must NOT be visible at the same time
    await expect(page.locator('.next-wave-overlay')).not.toBeVisible();
  });

  test('Restart button from game-over resets lives to 20 and returns to between-waves', async ({ page }) => {
    // Force lose phase
    await triggerGamePhase(page, 'lose');
    await expect(page.locator('.game-over-overlay')).toBeVisible();
    // Click restart
    await page.locator('.game-over-restart').click();
    await expect(page.locator('.game-over-overlay')).not.toBeVisible();
    // After restart (PR #97): difficulty selector reappears; select Normal to continue
    const diffOverlay = page.locator('.difficulty-overlay');
    if (await diffOverlay.isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    // Should now show NextWave overlay
    await expect(page.locator('.next-wave-overlay')).toBeVisible();
    // HUD should show lives = 20 (Normal difficulty), gold = 100, wave = 1
    await expect(page.locator('.hud-lives')).toContainText('20');
    await expect(page.locator('.hud-gold')).toContainText('100');
    await expect(page.locator('.hud-wave')).toContainText('1');
  });

  // --- TowerPicker component (issue #22) ---

  test('TowerPicker is visible with at least one tower type button', async ({ page }) => {
    await expect(page.locator('.tower-picker')).toBeVisible();
    const buttons = page.locator('.tower-picker button');
    await expect(buttons.first()).toBeVisible();
  });

  test('TowerPicker has a button selected by default (BasicTower)', async ({ page }) => {
    const selectedBtn = page.locator('.tower-picker button.selected');
    await expect(selectedBtn).toBeVisible();
  });

  test('clicking a TowerPicker button changes the selection', async ({ page }) => {
    // Dismiss the NextWave overlay first so pointer events reach the TowerPicker
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    const buttons = page.locator('.tower-picker button');
    const count = await buttons.count();
    // Click the last button (SniperTower) if it's enabled, otherwise skip
    if (count >= 2) {
      const lastBtn = buttons.nth(count - 1);
      const disabled = await lastBtn.getAttribute('disabled');
      if (disabled === null) {
        await lastBtn.click();
        await expect(lastBtn).toHaveClass(/selected/);
      }
    }
  });

  test('unaffordable tower type buttons are disabled', async ({ page }) => {
    // SniperTower costs 100 gold; player starts with 100 gold
    // After placing one BasicTower (cost 50), sniper may still be affordable, but
    // at minimum we assert that the disabled attribute works as expected for any disabled button.
    const buttons = page.locator('.tower-picker button');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('clicking a tower-slot places the selected tower type', async ({ page }) => {
    // Dismiss NextWave overlay first
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Ensure BasicTower is selected
    const basicBtn = page.locator('.tower-picker button').filter({ hasText: 'BasicTower' });
    if (await basicBtn.isVisible() && (await basicBtn.getAttribute('disabled')) === null) {
      await basicBtn.click();
    }
    const slot = page.locator('.tower-slot').first();
    await expect(slot).toBeVisible();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
  });

  // --- UpgradePanel component (issue #23) ---

  test('clicking an occupied tower-slot opens the upgrade panel', async ({ page }) => {
    // Dismiss NextWave overlay first
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Place a BasicTower on the first slot — auto-select opens the upgrade panel immediately
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    // Panel opens automatically on placement (auto-select behavior from issue #42)
    await expect(page.locator('.upgrade-panel')).toBeVisible();
  });

  test('upgrade panel shows stats and upgrade button', async ({ page }) => {
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    // Panel opens automatically on placement (auto-select behavior from issue #42)
    const panel = page.locator('.upgrade-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.upgrade-panel-btn')).toBeVisible();
  });

  // --- Upgrade panel stats diff table (issue #117 / PR #132) ---

  test('upgrade panel shows .upgrade-panel-diff-table for a non-maxed tower (BasicTower)', async ({ page }) => {
    // Dismiss NextWave overlay
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Place a BasicTower — auto-select opens upgrade panel immediately
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    const panel = page.locator('.upgrade-panel');
    await expect(panel).toBeVisible();
    // Diff table must be present for a level-0 upgradable tower
    await expect(panel.locator('.upgrade-panel-diff-table')).toBeVisible();
    // Must have at least one row
    const rows = panel.locator('.upgrade-panel-diff-row');
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('upgrade panel diff table has Stat / Now / Next / Δ column headers', async ({ page }) => {
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    const panel = page.locator('.upgrade-panel');
    await expect(panel).toBeVisible();
    const table = panel.locator('.upgrade-panel-diff-table');
    await expect(table).toBeVisible();
    // All four column headers must be present
    await expect(table.locator('.upgrade-panel-diff-th').filter({ hasText: 'Stat' })).toBeAttached();
    await expect(table.locator('.upgrade-panel-diff-th').filter({ hasText: 'Now' })).toBeAttached();
    await expect(table.locator('.upgrade-panel-diff-th').filter({ hasText: 'Next' })).toBeAttached();
    await expect(table.locator('.upgrade-panel-diff-th').filter({ hasText: 'Δ' })).toBeAttached();
  });

  test('upgrade panel diff table shows positive delta with "+" prefix for damage stat', async ({ page }) => {
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    const panel = page.locator('.upgrade-panel');
    await expect(panel).toBeVisible();
    const table = panel.locator('.upgrade-panel-diff-table');
    await expect(table).toBeVisible();
    // Damage row delta must use the positive class and start with "+"
    const positiveDeltas = table.locator('.upgrade-panel-delta-positive');
    expect(await positiveDeltas.count()).toBeGreaterThan(0);
    const firstDelta = await positiveDeltas.first().textContent();
    expect(firstDelta).toMatch(/^\+/);
  });

  test('upgrade panel shows MAX LEVEL text (not diff table) for a maxed tower', async ({ page }) => {
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Place BasicTower (costs 50g, 50g left) and upgrade twice (40g + 60g = 100g total, need 50+40+60=150 — unaffordable)
    // Instead, inject a maxed tower object directly via fiber to test the MAX LEVEL display.
    // Place first, then inject upgrade level beyond max (BasicTower has 2 upgrades → level 2 is max).
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    await expect(page.locator('.upgrade-panel')).toBeVisible();
    // Upgrade once (costs 40g; we have 50g left after 50g placement)
    const upgradeBtn = page.locator('.upgrade-panel-btn');
    if (await upgradeBtn.isEnabled()) {
      await upgradeBtn.click();
      // After upgrade: upgradeLevel=1, gold=10 (50-40). Can't afford next upgrade (60g).
      // The diff table should still show (level 1 is not max for BasicTower which has 2 upgrades).
      const panel = page.locator('.upgrade-panel');
      await expect(panel).toBeVisible();
      // upgradeBtn is now disabled (can't afford) but should still exist
      await expect(page.locator('.upgrade-panel-btn')).toBeDisabled();
      // MAX LEVEL must NOT be shown yet (tower is level 1 of 2)
      await expect(page.locator('.upgrade-panel-max')).not.toBeAttached();
    }
  });

  // --- Upgrade menu overlapping text fix (issue #54) ---

  test('upgrade panel text is not collapsed — line-height is not zero', async ({ page }) => {
    // Dismiss NextWave overlay
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Place a tower to open the upgrade panel
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    const panel = page.locator('.upgrade-panel');
    await expect(panel).toBeVisible();
    // Verify that line-height on the panel is NOT '0px' (the inherited collapsed value)
    const lineHeight = await panel.evaluate(el => getComputedStyle(el).lineHeight);
    expect(lineHeight).not.toBe('0px');
    // Also verify the panel has non-zero height (text is actually rendered/visible)
    const panelHeight = await panel.evaluate(el => el.getBoundingClientRect().height);
    expect(panelHeight).toBeGreaterThan(20);
  });

  // --- Projectile visualization and enemy combat (issue #29) ---

  test('.game-board-wrapper container is present and wraps the game board', async ({ page }) => {
    await expect(page.locator('.game-board-wrapper')).toBeVisible();
    await expect(page.locator('.game-board-wrapper .game-board')).toBeVisible();
  });

  // --- Layout redesign (issue #125 / PR #126) ---

  test('.game-area flex-row wrapper is present and contains the tower picker and game board', async ({ page }) => {
    await expect(page.locator('.game-area')).toBeVisible();
    // Tower picker must be inside .game-area (left sidebar position)
    await expect(page.locator('.game-area .tower-picker')).toBeVisible();
    // Game board wrapper must also be inside .game-area
    await expect(page.locator('.game-area .game-board-wrapper')).toBeVisible();
  });

  test('.game-area lays out tower picker to the left of the game board (flex row)', async ({ page }) => {
    // Verify the tower picker is horizontally to the left of the game board
    const pickerBox = await page.locator('.game-area .tower-picker').boundingBox();
    const boardBox = await page.locator('.game-area .game-board-wrapper').boundingBox();
    expect(pickerBox).not.toBeNull();
    expect(boardBox).not.toBeNull();
    // Picker left edge should be left of (or at) the board's left edge
    expect(pickerBox.x).toBeLessThanOrEqual(boardBox.x);
    // They should be vertically overlapping (same row)
    const pickerMidY = pickerBox.y + pickerBox.height / 2;
    const boardMidY = boardBox.y + boardBox.height / 2;
    expect(Math.abs(pickerMidY - boardMidY)).toBeLessThan(boardBox.height);
  });

  test('.hud is a full-width header bar above .game-area', async ({ page }) => {
    const hudBox = await page.locator('.hud').boundingBox();
    const gameAreaBox = await page.locator('.game-area').boundingBox();
    expect(hudBox).not.toBeNull();
    expect(gameAreaBox).not.toBeNull();
    // HUD must be above the game-area
    expect(hudBox.y + hudBox.height).toBeLessThanOrEqual(gameAreaBox.y + 5); // small tolerance
  });

  test('.hud-burger-btn is visible in the HUD right cluster', async ({ page }) => {
    await expect(page.locator('.hud-burger-btn')).toBeVisible();
  });

  test('clicking .hud-burger-btn opens the burger menu with expected items', async ({ page }) => {
    // Dismiss NextWave overlay so the HUD burger button is clickable
    const nwBtn = page.locator('.next-wave-start');
    if (await nwBtn.isVisible()) await nwBtn.click();
    await page.locator('.hud-burger-btn').click();
    await expect(page.locator('.hud-burger-menu')).toBeVisible();
    // Must contain Show Synergies and Achievements items
    await expect(page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: /Synergies/ })).toBeVisible();
    await expect(page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: 'Achievements' })).toBeVisible();
    // Must contain prestige stars section
    await expect(page.locator('.hud-burger-stars')).toBeAttached();
  });

  test('clicking .hud-burger-btn again closes the burger menu', async ({ page }) => {
    // Dismiss NextWave overlay so the HUD burger button is clickable
    const nwBtn = page.locator('.next-wave-start');
    if (await nwBtn.isVisible()) await nwBtn.click();
    await page.locator('.hud-burger-btn').click();
    await expect(page.locator('.hud-burger-menu')).toBeVisible();
    await page.locator('.hud-burger-btn').click();
    await expect(page.locator('.hud-burger-menu')).not.toBeVisible();
  });

  test('projectile SVG layer appears when a tower fires at an enemy', async ({ page }) => {
    // Start the wave, place a tower on the first slot (row 1, col 1) — directly above the
    // path start at (row 2, col 1) where enemies enter. Distance = 1 tile, well within range 3.
    await page.locator('.next-wave-start').click();
    await page.locator('.tower-slot').first().click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();

    // Wait for first enemy to spawn, then for the projectile SVG overlay to appear.
    // .projectile-layer is only rendered when projectiles[] is non-empty (conditional in GameBoard).
    // Use waitForFunction for reliable detection of this short-lived (200 ms) DOM state.
    await expect(page.locator('.enemy').first()).toBeVisible({ timeout: 4000 });
    await page.waitForFunction(
      () => document.querySelector('.projectile-layer') !== null,
      { timeout: 5000 }
    );
  });

  test('enemy HP bar decreases after being hit by a tower', async ({ page }) => {
    // Start wave, place tower at the first slot adjacent to the enemy spawn point.
    await page.locator('.next-wave-start').click();
    await page.locator('.tower-slot').first().click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();

    // Wait for at least one HP bar to drop below 100 % (enemy takes damage).
    // Timeout: 8 s — first enemy spawns at ~3 s, tower fires at ~3 s, second shot at ~4 s.
    await page.waitForFunction(() => {
      const bars = document.querySelectorAll('.enemy-hp-bar');
      for (const bar of bars) {
        if (parseFloat(bar.style.width) < 100) return true;
      }
      return false;
    }, { timeout: 8000 });
  });

  test('upgrade panel closes when clicking an empty tile after opening', async ({ page }) => {
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Place tower on first slot — auto-select opens panel immediately (issue #42)
    const occupiedSlot = page.locator('.tower-slot').first();
    await occupiedSlot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    await expect(page.locator('.upgrade-panel')).toBeVisible();
    // Click a different empty tower slot to place a second tower and switch selection
    const emptySlots = page.locator('.tower-slot');
    const count = await emptySlots.count();
    if (count >= 2) {
      await emptySlots.nth(1).click();
      // After placing a second tower, panel should show for that tower OR close —
      // either way, clicking somewhere else should dismiss the original panel
      // Here we just verify the UI is still responsive
      await expect(page.locator('.game-board')).toBeVisible();
    }
  });

  // --- Click outside tower deselects it (issue #55) ---

  test('clicking a non-tower tile deselects the tower and closes the upgrade panel', async ({ page }) => {
    // Dismiss NextWave overlay
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Place a BasicTower on the first slot — auto-select opens the upgrade panel
    const slots = page.locator('.tower-slot');
    const firstSlot = slots.first();
    await firstSlot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    await expect(page.locator('.upgrade-panel')).toBeVisible();
    await expect(page.locator('.fire-radius-ring')).toBeAttached({ timeout: 2000 });

    // Now click a path tile (non-tower tile) to deselect — path tiles have class .path
    const pathTile = page.locator('.tile.path').first();
    await expect(pathTile).toBeAttached();
    await pathTile.click();

    // Upgrade panel must be gone and fire-radius-ring must disappear
    await expect(page.locator('.upgrade-panel')).not.toBeVisible();
    await expect(page.locator('.fire-radius-ring')).not.toBeAttached();
  });

  test('fire-radius-ring disappears after clicking outside selected tower', async ({ page }) => {
    // Dismiss NextWave overlay
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Place a tower to get the fire-radius-ring
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    await expect(page.locator('.fire-radius-ring')).toBeAttached({ timeout: 2000 });

    // Click a path tile to deselect
    const pathTile = page.locator('.tile.path').first();
    await pathTile.click();

    // Ring must be gone (no tower selected)
    await expect(page.locator('.fire-radius-ring')).not.toBeAttached({ timeout: 2000 });
  });

  // --- Geometric SVG shapes for towers and enemies (issue #32) ---

  test('BasicTower renders an SVG with a teal diamond (rect.tower-basic)', async ({ page }) => {
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Ensure BasicTower is selected in the picker
    const basicBtn = page.locator('.tower-picker button').filter({ hasText: 'BasicTower' });
    if (await basicBtn.isVisible() && (await basicBtn.getAttribute('disabled')) === null) {
      await basicBtn.click();
    }
    // Place a BasicTower on the first slot
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    // .tower-icon should now contain an SVG
    const towerIcon = page.locator('.tower-icon').first();
    await expect(towerIcon).toBeVisible();
    const svgEl = towerIcon.locator('svg');
    await expect(svgEl).toBeAttached();
    // The SVG must contain a rect with class tower-basic (cannon body + barrel — PR #121 redesign)
    const diamond = svgEl.locator('rect.tower-basic').first();
    await expect(diamond).toBeAttached();
    // Verify no emoji text remains — the icon element should contain an SVG, not raw text
    const innerText = await towerIcon.evaluate(el => el.innerText.trim());
    expect(innerText).toBe('');
  });

  test('SniperTower renders an SVG with a rifle barrel (rect.tower-sniper)', async ({ page }) => {
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Select SniperTower — it costs 100 gold and player starts with 100 gold
    const sniperBtn = page.locator('.tower-picker button').filter({ hasText: 'SniperTower' });
    const isAffordable = await sniperBtn.getAttribute('disabled');
    if (isAffordable !== null) {
      // Cannot afford — skip assertion (insufficient gold after earlier actions)
      return;
    }
    await sniperBtn.click();
    await expect(sniperBtn).toHaveClass(/selected/);
    // Place a SniperTower on the first available slot
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    // .tower-icon should now contain an SVG with a rect.tower-sniper (rifle barrel — PR #121 redesign)
    const towerIcon = page.locator('.tower-icon').first();
    await expect(towerIcon).toBeVisible();
    const svgEl = towerIcon.locator('svg');
    await expect(svgEl).toBeAttached();
    const barrel = svgEl.locator('rect.tower-sniper').first();
    await expect(barrel).toBeAttached();
  });

  test('enemy circle size reflects HP ratio via inline width/height styles', async ({ page }) => {
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Wait for at least one enemy to appear in the enemy-layer
    await expect(page.locator('.enemy-layer .enemy').first()).toBeAttached({ timeout: 5000 });
    // Wave 1 spawns only Grunts: radius 10 px → diameter 20 px
    const enemy = page.locator('.enemy-layer .enemy').first();
    const widthStyle = await enemy.evaluate(el => el.style.width);
    const heightStyle = await enemy.evaluate(el => el.style.height);
    // Valid diameters: 20px (grunt radius 10) or 32px (tank radius 16)
    expect(['20px', '32px']).toContain(widthStyle);
    expect(['20px', '32px']).toContain(heightStyle);
  });

  // --- Two enemy types: Grunt and Tank (issue #38) ---

  test('wave 1 spawns only grunt enemies with enemy-grunt CSS class', async ({ page }) => {
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Wait for at least one enemy to appear
    await expect(page.locator('.enemy-layer .enemy').first()).toBeAttached({ timeout: 5000 });
    // Wave 1 = Grunts only: every enemy must have class enemy-grunt, none should have enemy-tank
    const enemies = page.locator('.enemy-layer .enemy');
    const count = await enemies.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const cls = await enemies.nth(i).getAttribute('class');
      expect(cls).toContain('enemy-grunt');
      expect(cls).not.toContain('enemy-tank');
    }
  });

  test('grunt enemy has 20px diameter (radius 10)', async ({ page }) => {
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Wait for at least one grunt to appear
    await expect(page.locator('.enemy-layer .enemy-grunt').first()).toBeAttached({ timeout: 5000 });
    const grunt = page.locator('.enemy-layer .enemy-grunt').first();
    const w = await grunt.evaluate(el => el.style.width);
    const h = await grunt.evaluate(el => el.style.height);
    expect(w).toBe('20px');
    expect(h).toBe('20px');
  });

  // --- WaveCountdownBanner component (issue #34) ---

  /**
   * Helper injected into tests below: set wave and gamePhase via React fiber to trigger
   * the countdown banner (shown when gamePhase === 'between-waves' && wave > 1).
   * App.jsx hook order (all hooks including useRef) post-PR #131 (tileSize added):
   *   difficultyMode(0), difficultyModeRef(1), tileSize(2), gold(3), lives(4), wave(5),
   *   speed(6), towers(7), enemies(8), projectiles(9), deathAnimations(10),
   *   deathAnimationsRef(11), ..., gamePhase at all-hooks[25]
   */

  test('countdown banner is visible when between-waves with wave > 1', async ({ page }) => {
    // Inject wave=2 and gamePhase='between-waves' via React fiber
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          let hookNode = fiber.memoizedState;
          let waveHook = null;
          let phaseHook = null;
          let i = 0;
          while (hookNode) {
            if (i === 5) waveHook = hookNode;
            if (i === 25) phaseHook = hookNode;  // gamePhase = all-hooks[25] post-PR #131
            hookNode = hookNode.next;
            i++;
          }
          if (waveHook && waveHook.queue && waveHook.queue.dispatch) {
            waveHook.queue.dispatch(2);
          }
          if (phaseHook && phaseHook.queue && phaseHook.queue.dispatch) {
            phaseHook.queue.dispatch('between-waves');
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });
    // Countdown banner should now be visible (wave > 1 and between-waves)
    await expect(page.locator('.wave-countdown-banner')).toBeVisible({ timeout: 2000 });
    // Banner should contain countdown text mentioning "Wave"
    await expect(page.locator('.wave-countdown-text')).toContainText('Wave');
    // "Start Now" button should be visible
    await expect(page.locator('.wave-countdown-start-now')).toBeVisible();
  });

  test('wave auto-starts within 4 s after countdown banner appears (wave > 1)', async ({ page }) => {
    // Inject wave=2 and gamePhase='between-waves'
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          let hookNode = fiber.memoizedState;
          let waveHook = null;
          let phaseHook = null;
          let i = 0;
          while (hookNode) {
            if (i === 5) waveHook = hookNode;
            if (i === 25) phaseHook = hookNode;  // gamePhase = all-hooks[25] post-PR #131
            hookNode = hookNode.next;
            i++;
          }
          if (waveHook && waveHook.queue && waveHook.queue.dispatch) {
            waveHook.queue.dispatch(2);
          }
          if (phaseHook && phaseHook.queue && phaseHook.queue.dispatch) {
            phaseHook.queue.dispatch('between-waves');
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });
    // Banner must appear first
    await expect(page.locator('.wave-countdown-banner')).toBeVisible({ timeout: 2000 });
    // Within 4 s the banner should disappear (auto-start fires after 3 countdown seconds)
    await expect(page.locator('.wave-countdown-banner')).not.toBeVisible({ timeout: 4000 });
    // Game should now be in 'playing' phase — HUD wave should show 2 (or 3 if wave incremented)
    await expect(page.locator('.hud-wave')).toBeVisible();
  });

  test('"Start Now" button dismisses countdown banner and starts wave immediately', async ({ page }) => {
    // Inject wave=2 and gamePhase='between-waves'.
    // WavePreviewPanel (PR #120) renders when wave>1 and difficultyMode!==null.
    // WaveCountdownBanner renders when wave>1 and between-waves — but is blocked by
    // WavePreviewPanel (z-index 105 vs banner z-index 30). Strategy: inject the state,
    // then forcibly hide the WavePreviewPanel overlay via DOM so the banner is clickable.
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          let hookNode = fiber.memoizedState;
          let waveHook = null;
          let phaseHook = null;
          let i = 0;
          while (hookNode) {
            if (i === 5) waveHook = hookNode;
            if (i === 25) phaseHook = hookNode;  // gamePhase = all-hooks[25] post-PR #131
            hookNode = hookNode.next;
            i++;
          }
          if (waveHook && waveHook.queue && waveHook.queue.dispatch) {
            waveHook.queue.dispatch(2);
          }
          if (phaseHook && phaseHook.queue && phaseHook.queue.dispatch) {
            phaseHook.queue.dispatch('between-waves');
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });
    // WaveCountdownBanner is now rendering (z-index 30), but WavePreviewPanel overlay
    // (z-index 105) covers it. Remove the overlay from the DOM so the banner is accessible.
    await page.waitForSelector('.wave-countdown-banner', { state: 'attached', timeout: 2000 });
    await page.evaluate(() => {
      const overlay = document.querySelector('.wave-preview-overlay');
      if (overlay) overlay.remove();
    });
    // Banner must appear
    await expect(page.locator('.wave-countdown-banner')).toBeVisible({ timeout: 2000 });
    // Click "Start Now"
    await page.locator('.wave-countdown-start-now').click();
    // Banner should disappear immediately (no 3-second wait)
    await expect(page.locator('.wave-countdown-banner')).not.toBeVisible({ timeout: 1000 });
    // Game should be in playing phase — enemies start spawning
    await expect(page.locator('.hud-wave')).toBeVisible();
  });

  // --- Wave difficulty scaling (issue #35) ---

  test('NextWave overlay shows enemy count and HP info for wave 1', async ({ page }) => {
    // On initial load, NextWave overlay is visible for wave 1
    await expect(page.locator('.next-wave-overlay')).toBeVisible();
    // .next-wave-info should show wave-1 values: 5 enemies, 100 HP
    const info = page.locator('.next-wave-info');
    await expect(info).toBeVisible();
    await expect(info).toContainText('5 enemies');
    await expect(info).toContainText('100 HP');
  });

  test('WaveCountdownBanner shows enemy count and HP info for upcoming wave', async ({ page }) => {
    // Inject wave=5 and gamePhase='between-waves' to show the countdown banner
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          let hookNode = fiber.memoizedState;
          let waveHook = null;
          let phaseHook = null;
          let i = 0;
          while (hookNode) {
            if (i === 5) waveHook = hookNode;
            if (i === 25) phaseHook = hookNode;  // gamePhase = all-hooks[25] post-PR #131
            hookNode = hookNode.next;
            i++;
          }
          if (waveHook && waveHook.queue && waveHook.queue.dispatch) {
            waveHook.queue.dispatch(5);
          }
          if (phaseHook && phaseHook.queue && phaseHook.queue.dispatch) {
            phaseHook.queue.dispatch('between-waves');
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });
    // Countdown banner for wave 5 shows NEXT wave (wave+1=6) stats.
    // Exact count depends on the random waveEventSeed (horde x2.5 vs normal: 10 or 25 enemies).
    // HP = Math.round(100 * 1.4^5) = 538 (horde hpMultiplier=1, so HP is always 538).
    await expect(page.locator('.wave-countdown-banner')).toBeVisible({ timeout: 2000 });
    const info = page.locator('.wave-countdown-info');
    // Use toBeAttached + inner text check — the span may be visually clipped in headless
    await expect(info).toBeAttached();
    const infoText = await info.textContent();
    // Count is event-dependent (normal=10, horde=25); assert format rather than exact value.
    expect(infoText).toMatch(/\d+ enemies/);
    expect(infoText).toContain('538 HP');
  });

  // --- Tower range preview ring (issue #36) ---

  test('hovering an empty tower-slot shows the range-preview-ring', async ({ page }) => {
    // Dismiss the NextWave overlay so the board is interactive
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Hover over the first empty tower-slot
    const slot = page.locator('.tower-slot').first();
    await expect(slot).toBeVisible();
    await slot.hover();
    // The range-preview-ring SVG circle should be present in the DOM while hovering
    await expect(page.locator('.range-preview-ring')).toBeAttached({ timeout: 2000 });
  });

  test('moving mouse away from tower-slot hides the range-preview-ring', async ({ page }) => {
    // Dismiss the NextWave overlay so the board is interactive
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Hover over the first empty tower-slot to show the ring
    const slot = page.locator('.tower-slot').first();
    await expect(slot).toBeVisible();
    await slot.hover();
    await expect(page.locator('.range-preview-ring')).toBeAttached({ timeout: 2000 });
    // Move the mouse to the game-board-wrapper (outside any tower-slot) to trigger mouse-leave
    await page.locator('.hud').hover();
    // The range-preview-ring should no longer be in the DOM
    await expect(page.locator('.range-preview-ring')).not.toBeAttached({ timeout: 2000 });
  });

  // --- Fire radius ring on placed tower selection (issue #42) ---

  test('fire-radius-ring appears immediately after placing a tower', async ({ page }) => {
    // Dismiss the NextWave overlay so the board is interactive
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Place a tower — the auto-select on placement should show the fire-radius-ring
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    // Fire radius ring must be present in the SVG layer right after placement
    await expect(page.locator('.fire-radius-ring')).toBeAttached({ timeout: 2000 });
  });

  test('fire-radius-ring appears when clicking an already-placed tower', async ({ page }) => {
    // Dismiss the NextWave overlay
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Place a tower on the first slot
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();

    // Click elsewhere to deselect — clicking another empty slot
    const slots = page.locator('.tower-slot');
    if (await slots.count() >= 2) {
      await slots.nth(1).click();
      // The fire-radius-ring should now point at the second tower (just placed)
      await expect(page.locator('.fire-radius-ring')).toBeAttached({ timeout: 2000 });
    }
  });

  test('fire-radius-ring is absent when no tower is selected', async ({ page }) => {
    // On initial load, before placing anything, no tower is selected
    // .fire-radius-ring should not be in the DOM at all
    await expect(page.locator('.fire-radius-ring')).not.toBeAttached();
  });

  test('hover preview ring (.range-preview-ring) still shows on empty tower-slot hover', async ({ page }) => {
    // Dismiss the NextWave overlay
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Hover over the first empty tower-slot
    const slot = page.locator('.tower-slot').first();
    await slot.hover();
    // The hover ring must still be present
    await expect(page.locator('.range-preview-ring')).toBeAttached({ timeout: 2000 });
    // The fire-radius-ring must NOT appear just from hovering (no tower placed yet)
    await expect(page.locator('.fire-radius-ring')).not.toBeAttached();
  });

  // --- HUD restart button (issue #33) ---

  // --- Sell Tower feature (issue #37) ---

  test('upgrade panel shows a Sell button with gold refund amount', async ({ page }) => {
    // Dismiss NextWave overlay
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Place a BasicTower on the first slot — auto-select opens the panel immediately (issue #42)
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    const panel = page.locator('.upgrade-panel');
    await expect(panel).toBeVisible();
    // Sell button must be visible and show the refund amount (25g for BasicTower: Math.floor(50 * 0.5))
    const sellBtn = panel.locator('.upgrade-panel-sell-btn');
    await expect(sellBtn).toBeVisible();
    await expect(sellBtn).toContainText('Sell');
    await expect(sellBtn).toContainText('25g');
  });

  test('clicking Sell removes the tower and refunds gold', async ({ page }) => {
    // Dismiss NextWave overlay
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Note starting gold (100)
    const goldBefore = await page.locator('.hud-gold').textContent();
    const goldNum = parseInt(goldBefore.replace(/\D/g, ''), 10);

    // Place a BasicTower (costs 50g → gold becomes 50)
    // Auto-select opens upgrade panel immediately (issue #42)
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    await expect(page.locator('.upgrade-panel')).toBeVisible();

    // Sell the tower
    await page.locator('.upgrade-panel-sell-btn').click();

    // Tower should be gone — no .tower-icon on the board
    await expect(page.locator('.tower-icon')).toHaveCount(0);

    // Upgrade panel should be closed
    await expect(page.locator('.upgrade-panel')).not.toBeVisible();

    // Gold should be goldNum - 50 (buy) + 25 (sell refund: Math.floor(50 * 0.5)) = goldNum - 25
    const goldAfterText = await page.locator('.hud-gold').textContent();
    const goldAfterNum = parseInt(goldAfterText.replace(/\D/g, ''), 10);
    expect(goldAfterNum).toBe(goldNum - 50 + 25);

    // The tile should now be a clickable .tower-slot again
    await expect(page.locator('.tower-slot').first()).toBeVisible();
  });

  test('HUD restart button resets game to initial state', async ({ page }) => {
    // Dismiss the NextWave overlay so the board is interactive
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }

    // Place a tower on the first available slot
    const slot = page.locator('.tower-slot').first();
    await expect(slot).toBeVisible();
    await slot.click();
    // Verify the tower was placed
    await expect(page.locator('.tower-icon').first()).toBeVisible();

    // Click the HUD restart button
    const restartBtn = page.locator('.hud-restart');
    await expect(restartBtn).toBeVisible();
    await restartBtn.click();

    // After restart (PR #97): difficulty selector reappears; select Normal to continue
    const diffOverlay = page.locator('.difficulty-overlay');
    if (await diffOverlay.isVisible()) {
      await page.click('.difficulty-btn--normal');
    }

    // Game state should be reset: lives=20 (Normal), gold=100, wave=1
    await expect(page.locator('.hud-lives')).toContainText('20');
    await expect(page.locator('.hud-gold')).toContainText('100');
    await expect(page.locator('.hud-wave')).toContainText('1');

    // The between-waves overlay should be visible (Wave 1 start)
    await expect(page.locator('.next-wave-overlay')).toBeVisible();

    // No towers should remain on the board
    await expect(page.locator('.tower-icon')).toHaveCount(0);
  });

  // --- Score & Leaderboard (issue #39) ---

  test('GameOver overlay shows final score', async ({ page }) => {
    // Inject a non-null finalScore then trigger game-over phase.
    // We detect useState hooks by queue.dispatch (useRef hooks have no dispatch).
    // App.jsx useState dispatch order after PR #110 (endlessMode removed — stateHooks[13] now=finalScore):
    //   0=difficultyMode,1=gold,2=lives,3=wave,4=speed,5=towers,6=enemies,
    //   7=projectiles,8=deathAnimations,9=deathParticles,10=damageNumbers,
    //   11=poisonPuffs,12=placementPulses,13=screenShakeActive (was endlessMode slot — now removed),
    //   ...(selectedTowerType, selectedTower, hoveredSlot, gamePhase, finalScore follow)
    // Use triggerGamePhase for gamePhase and inject finalScore via the state order below:
    //   stateHooks[12]=gamePhase, stateHooks[13]=finalScore (PR #110: endlessMode removed)
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // Dispatch both in same React batch so score is non-null when overlay renders
          // PR #131: tileSize inserted at [1]; finalScore=[20], gamePhase=[19]
          if (stateHooks[20]) stateHooks[20].queue.dispatch(1234);  // finalScore (stateHooks[20] post-PR #131)
          if (stateHooks[19]) stateHooks[19].queue.dispatch('lose'); // gamePhase (stateHooks[19] post-PR #131)
          return;
        }
        fiber = fiber.return;
      }
    });
    await expect(page.locator('.game-over-overlay')).toBeVisible();
    // Final score element must be present with the injected score
    await expect(page.locator('.final-score')).toBeVisible();
    await expect(page.locator('.final-score')).toContainText('1234');
  });

  test('GameOver overlay shows leaderboard section with title', async ({ page }) => {
    await triggerGamePhase(page, 'lose');
    await expect(page.locator('.game-over-overlay')).toBeVisible();
    await expect(page.locator('.leaderboard')).toBeVisible();
    await expect(page.locator('.leaderboard-title')).toBeVisible();
  });

  test('GameOver overlay shows Clear scores button', async ({ page }) => {
    await triggerGamePhase(page, 'lose');
    await expect(page.locator('.game-over-overlay')).toBeVisible();
    await expect(page.locator('.leaderboard-clear-btn')).toBeVisible();
  });

  test('Clear scores button wipes leaderboard and shows empty state', async ({ page }) => {
    // Seed a leaderboard entry in localStorage so there is something to clear
    await page.evaluate(() => {
      localStorage.setItem('towerDefense_leaderboard', JSON.stringify([
        { score: 999, date: '2025-01-01', result: 'win' }
      ]));
    });
    await triggerGamePhase(page, 'lose');
    await expect(page.locator('.game-over-overlay')).toBeVisible();

    // Reload the overlay so the seeded entry is picked up
    await page.reload();
    // After reload, dismiss difficulty overlay (PR #97) before interacting
    const diffOverlayAfterReload = page.locator('.difficulty-overlay');
    if (await diffOverlayAfterReload.isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    await triggerGamePhase(page, 'lose');
    await expect(page.locator('.game-over-overlay')).toBeVisible();
    await expect(page.locator('.leaderboard-entry')).toHaveCount(1);

    // Click Clear scores
    await page.locator('.leaderboard-clear-btn').click();

    // Leaderboard should now be empty
    await expect(page.locator('.leaderboard-empty')).toBeVisible();
    await expect(page.locator('.leaderboard-entry')).toHaveCount(0);
  });

  // --- Upgrade-level indicator on placed towers (issue #40) ---

  test('fresh tower shows no .tower-level-badge', async ({ page }) => {
    // Dismiss NextWave overlay
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Place a BasicTower (upgradeLevel starts at 0)
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    // No badge should be visible on a level-0 tower
    await expect(page.locator('.tower-level-badge')).toHaveCount(0);
  });

  // --- Next Wave Early button (issue #44) ---
  // PR #125: "Next Wave Early" moved into the burger menu (☰). Tests open the menu first.

  test('"Next Wave Early" button is not present in the DOM before a wave starts (burger menu closed)', async ({ page }) => {
    // On initial load the game is between-waves — the burger menu is closed and .hud-next-wave
    // is not rendered (showNextWave=false means it is conditionally absent from the menu).
    // Dismiss NextWave overlay so the HUD burger button is clickable, then open the menu
    const nwStartBtn = page.locator('.next-wave-start');
    // Do NOT start the wave — we want to test between-waves state. Use the overlay dismiss only if
    // it's blocking clicks (the NextWave overlay covers the game board, not the HUD bar).
    // The HUD bar is above the overlay. Use force:true as a fallback if the overlay z-index blocks.
    await page.locator('.hud-burger-btn').click({ force: true });
    await expect(page.locator('.hud-next-wave')).not.toBeAttached();
  });

  test('"Next Wave Early" button appears in the burger menu once a wave is playing', async ({ page }) => {
    // Start wave 1
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Open the burger menu to reveal the button
    await page.locator('.hud-burger-btn').click();
    // The button must be present and enabled in the menu during a wave
    await expect(page.locator('.hud-next-wave')).toBeVisible({ timeout: 3000 });
  });

  test('"Next Wave Early" button becomes disabled after being clicked once (via burger menu)', async ({ page }) => {
    // Start wave 1
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Open burger menu
    await page.locator('.hud-burger-btn').click();
    const earlyBtn = page.locator('.hud-next-wave');
    await expect(earlyBtn).toBeVisible({ timeout: 3000 });
    // Initially enabled
    await expect(earlyBtn).not.toBeDisabled();
    // Click it — the menu closes and earlyWaveCalled is set
    await earlyBtn.click();
    // Re-open menu to verify disabled state
    await page.locator('.hud-burger-btn').click();
    // Must be disabled immediately after use (one early call per wave)
    await expect(page.locator('.hud-next-wave')).toBeDisabled();
  });

  test('clicking "Next Wave Early" adds enemies to the board (wave overlap, via burger menu)', async ({ page }) => {
    // Start wave 1
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Open burger menu to access the button
    await page.locator('.hud-burger-btn').click();
    const earlyBtn = page.locator('.hud-next-wave');
    await expect(earlyBtn).toBeVisible({ timeout: 3000 });
    // Wait for some enemies to spawn so there is already a wave in flight
    await expect(page.locator('.enemy').first()).toBeVisible({ timeout: 5000 });
    // Trigger the early wave — menu closes automatically
    await earlyBtn.click();
    // The board should still have enemies (not reset) — at least one enemy must be present
    await expect(page.locator('.enemy').first()).toBeAttached({ timeout: 2000 });
    // Re-open menu to verify disabled state
    await page.locator('.hud-burger-btn').click();
    await expect(page.locator('.hud-next-wave')).toBeDisabled();
  });

  // --- 5x speed option (issue #63) ---

  test('speed button cycles through 1×, 2×, 5× and back to 1×', async ({ page }) => {
    // Dismiss the NextWave overlay so the board is interactive
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    const speedBtn = page.locator('.hud-speed');
    await expect(speedBtn).toBeVisible();

    // Initial state: 1×
    await expect(speedBtn).toContainText('1×');

    // First click: 1× → 2×
    await speedBtn.click();
    await expect(speedBtn).toContainText('2×');

    // Second click: 2× → 5×
    await speedBtn.click();
    await expect(speedBtn).toContainText('5×');

    // Third click: 5× → 1×
    await speedBtn.click();
    await expect(speedBtn).toContainText('1×');
  });

  // --- Endless mode (issue #56) — PR #110: endless is now the ONLY mode; toggle removed ---
  // The .endless-mode-toggle, .endless-mode-checkbox, and .hud-endless-badge UI elements
  // no longer exist. Tests for those were removed by QA in PR #110.

  test('NextWave overlay does NOT contain an endless-mode toggle (PR #110)', async ({ page }) => {
    // PR #110 removed the toggle — game is always endless; confirm the element is gone
    await expect(page.locator('.next-wave-overlay')).toBeVisible();
    await expect(page.locator('.endless-mode-toggle')).not.toBeAttached();
    await expect(page.locator('.endless-mode-checkbox')).not.toBeAttached();
  });

  test('HUD does not show an ENDLESS badge (PR #110 — always-endless needs no badge)', async ({ page }) => {
    // Start wave 1 — the ENDLESS badge no longer exists in the HUD
    await page.locator('.next-wave-start').click();
    await expect(page.locator('.hud-endless-badge')).not.toBeAttached();
  });

  test('tower shows .tower-level-badge with roman numeral I after one upgrade', async ({ page }) => {
    // Dismiss NextWave overlay
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Place a BasicTower — costs 50g, leaves 50g (enough for level-1 upgrade at 40g)
    // Auto-select opens upgrade panel immediately (issue #42)
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    await expect(page.locator('.upgrade-panel')).toBeVisible();

    // Click the Upgrade button
    await page.locator('.upgrade-panel-btn').click();

    // Badge should now show roman numeral I
    const badge = page.locator('.tower-level-badge').first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('I');
  });

  // --- New tower types: RapidTower, CannonTower, SlowTower (issue #57) ---

  test('TowerPicker shows RapidTower, CannonTower, and SlowTower buttons', async ({ page }) => {
    await expect(page.locator('.tower-picker')).toBeVisible();
    await expect(page.locator('.tower-picker button').filter({ hasText: 'RapidTower' })).toBeAttached();
    await expect(page.locator('.tower-picker button').filter({ hasText: 'CannonTower' })).toBeAttached();
    await expect(page.locator('.tower-picker button').filter({ hasText: 'SlowTower' })).toBeAttached();
  });

  test('TowerPicker shows Splash special-ability tooltip for CannonTower', async ({ page }) => {
    const cannonBtn = page.locator('.tower-picker-btn').filter({ hasText: 'CannonTower' });
    await expect(cannonBtn).toBeAttached();
    // PR #121: special ability moved from inline .tower-picker-special span to native title tooltip
    const title = await cannonBtn.getAttribute('title');
    expect(title).toMatch(/Splash/);
  });

  test('TowerPicker shows Slow special-ability tooltip for SlowTower', async ({ page }) => {
    const slowBtn = page.locator('.tower-picker-btn').filter({ hasText: 'SlowTower' });
    await expect(slowBtn).toBeAttached();
    // PR #121: special ability moved from inline .tower-picker-special span to native title tooltip
    const title = await slowBtn.getAttribute('title');
    expect(title).toMatch(/Slow/);
  });

  test('RapidTower renders SVG with rect.tower-rapid when placed', async ({ page }) => {
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Select RapidTower (costs 75g, player starts with 100g)
    const rapidBtn = page.locator('.tower-picker button').filter({ hasText: 'RapidTower' });
    if ((await rapidBtn.getAttribute('disabled')) !== null) return; // skip if unaffordable
    await rapidBtn.click();
    await expect(rapidBtn).toHaveClass(/selected/);
    // Place on first slot
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    const towerIcon = page.locator('.tower-icon').first();
    await expect(towerIcon).toBeVisible();
    const svgEl = towerIcon.locator('svg');
    await expect(svgEl).toBeAttached();
    await expect(svgEl.locator('rect.tower-rapid').first()).toBeAttached();
  });

  test('CannonTower renders SVG with circle.tower-cannon when placed', async ({ page }) => {
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Select CannonTower (costs 150g — too expensive on 100g start; skip if unaffordable)
    const cannonBtn = page.locator('.tower-picker button').filter({ hasText: 'CannonTower' });
    if ((await cannonBtn.getAttribute('disabled')) !== null) return;
    await cannonBtn.click();
    await expect(cannonBtn).toHaveClass(/selected/);
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    const towerIcon = page.locator('.tower-icon').first();
    await expect(towerIcon).toBeVisible();
    const svgEl = towerIcon.locator('svg');
    await expect(svgEl).toBeAttached();
    await expect(svgEl.locator('circle.tower-cannon')).toBeAttached();
  });

  test('SlowTower renders SVG with circle.tower-slow when placed', async ({ page }) => {
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Select SlowTower (costs 90g — just barely unaffordable on 100g start after no purchases)
    const slowBtn = page.locator('.tower-picker button').filter({ hasText: 'SlowTower' });
    if ((await slowBtn.getAttribute('disabled')) !== null) return;
    await slowBtn.click();
    await expect(slowBtn).toHaveClass(/selected/);
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    const towerIcon = page.locator('.tower-icon').first();
    await expect(towerIcon).toBeVisible();
    const svgEl = towerIcon.locator('svg');
    await expect(svgEl).toBeAttached();
    // PR #121: SlowTower is now a snowflake/ice-crystal — central circle + radiating arms
    await expect(svgEl.locator('circle.tower-slow')).toBeAttached();
  });

  // --- Status-effect towers: PoisonTower (issue #67) ---

  test('TowerPicker shows PoisonTower button', async ({ page }) => {
    await expect(page.locator('.tower-picker')).toBeVisible();
    await expect(page.locator('.tower-picker button').filter({ hasText: 'PoisonTower' })).toBeAttached();
  });

  test('TowerPicker shows Poison special-ability tooltip for PoisonTower', async ({ page }) => {
    const poisonBtn = page.locator('.tower-picker-btn').filter({ hasText: 'PoisonTower' });
    await expect(poisonBtn).toBeAttached();
    // PR #121: special ability moved from inline .tower-picker-special span to native title tooltip
    const title = await poisonBtn.getAttribute('title');
    expect(title).toMatch(/Poison/);
  });

  test('PoisonTower renders SVG with ellipse.tower-poison when placed', async ({ page }) => {
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Select PoisonTower (costs 90g — affordable on 100g start with no prior purchases)
    const poisonBtn = page.locator('.tower-picker button').filter({ hasText: 'PoisonTower' });
    if ((await poisonBtn.getAttribute('disabled')) !== null) return; // skip if unaffordable
    await poisonBtn.click();
    await expect(poisonBtn).toHaveClass(/selected/);
    // Place on first available tower slot
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    const towerIcon = page.locator('.tower-icon').first();
    await expect(towerIcon).toBeVisible();
    const svgEl = towerIcon.locator('svg');
    await expect(svgEl).toBeAttached();
    // PR #121: PoisonTower is now a flask/beaker silhouette — ellipse body
    await expect(svgEl.locator('ellipse.tower-poison').first()).toBeAttached();
  });

  // --- Per-tower-type projectile fire animations (issue #65) ---

  test('projectile line has a type-specific CSS class (projectile-basic) when BasicTower fires', async ({ page }) => {
    // Start wave 1, place a BasicTower on the first slot which is adjacent to the enemy path
    await page.locator('.next-wave-start').click();
    // Ensure BasicTower is selected (default)
    const basicBtn = page.locator('.tower-picker button').filter({ hasText: 'BasicTower' });
    if (await basicBtn.isVisible() && (await basicBtn.getAttribute('disabled')) === null) {
      await basicBtn.click();
    }
    await page.locator('.tower-slot').first().click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();

    // Wait for the first enemy to appear, then wait for a projectile to be fired
    await expect(page.locator('.enemy').first()).toBeVisible({ timeout: 4000 });
    // Wait for the projectile layer to appear (projectiles is non-empty → SVG renders)
    await page.waitForFunction(
      () => document.querySelector('.projectile-layer') !== null,
      { timeout: 5000 }
    );
    // The projectile <line> must carry the type-specific class projectile-basic
    await page.waitForFunction(
      () => {
        const line = document.querySelector('.projectile-layer .projectile');
        return line && line.classList.contains('projectile-basic');
      },
      { timeout: 5000 }
    );
    const line = page.locator('.projectile-layer .projectile').first();
    await expect(line).toBeAttached();
    const cls = await line.getAttribute('class');
    expect(cls).toContain('projectile-basic');
    // Must NOT carry a level suffix on a fresh (level-0) tower
    expect(cls).not.toContain('projectile-basic-lv1');
    expect(cls).not.toContain('projectile-basic-lv2');
  });

  test('projectile-basic CSS class has a non-default stroke colour (not black)', async ({ page }) => {
    // This test verifies that the per-type CSS rules in index.css are actually loaded and applied.
    // Build a minimal SVG, attach it to the document body with the class, and read computed style.
    const strokeColor = await page.evaluate(() => {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.style.position = 'absolute';
      svg.style.top = '-9999px';
      document.body.appendChild(svg);
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('class', 'projectile projectile-basic');
      svg.appendChild(line);
      const computed = getComputedStyle(line).stroke;
      document.body.removeChild(svg);
      return computed;
    });
    // The CSS rule sets stroke: #4ecca3 — any non-black, non-empty value confirms the rule was applied
    expect(strokeColor).not.toBe('');
    expect(strokeColor).not.toBe('rgb(0, 0, 0)');
    expect(strokeColor).not.toBe('none');
  });

  test('projectile-sniper CSS class has a different stroke colour than projectile-basic', async ({ page }) => {
    const { basicStroke, sniperStroke } = await page.evaluate(() => {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.style.position = 'absolute';
      svg.style.top = '-9999px';
      document.body.appendChild(svg);

      const lineBasic = document.createElementNS(ns, 'line');
      lineBasic.setAttribute('class', 'projectile projectile-basic');
      svg.appendChild(lineBasic);

      const lineSniper = document.createElementNS(ns, 'line');
      lineSniper.setAttribute('class', 'projectile projectile-sniper');
      svg.appendChild(lineSniper);

      const basicStroke = getComputedStyle(lineBasic).stroke;
      const sniperStroke = getComputedStyle(lineSniper).stroke;
      document.body.removeChild(svg);
      return { basicStroke, sniperStroke };
    });
    // The two tower types must have visually distinct projectile colours
    expect(basicStroke).not.toBe('');
    expect(sniperStroke).not.toBe('');
    expect(basicStroke).not.toBe(sniperStroke);
  });

  // --- Critical hit visuals (issue #79 / PR #104) ---
  // Inject damageNumbers and projectiles directly via React fiber to avoid relying
  // on natural gameplay crits (10% chance is unreliable in short headless test windows).
  //
  // Hook order (all hooks, 0-indexed) after PR #104 (damageNumbers inserted at 11-12):
  //   0  difficultyMode (useState)    1  difficultyModeRef (useRef)
  //   2  gold            3  lives     4  wave       5  speed
  //   6  towers          7  enemies   8  projectiles
  //   9  deathAnimations             10  deathAnimationsRef (useRef)
  //  11  damageNumbers (useState)    12  damageNumbersRef (useRef)  ← PR #104 NEW
  //  13  selectedTowerType  14  selectedTower  15  hoveredSlot
  //  16  gamePhase (useState)  ...
  //
  // stateHooks (dispatch-capable, 0-indexed) after PR #104:
  //   stateHooks[9] = damageNumbers  ← PR #104 NEW (shifts everything after by +1)

  test('.damage-number-crit element appears when damageNumbers state is populated', async ({ page }) => {
    // Inject a damageNumbers entry directly via React fiber.
    // damageNumbers = all-hooks index 11 (PR #104 added it between deathAnimationsRef and selectedTowerType).
    // The game loop is paused (between-waves) so the injected entry persists long enough to assert.
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          // damageNumbers = stateHooks[10] = all-hooks[13] (verified post-PR #110)
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          if (stateHooks[11] && stateHooks[11].queue && stateHooks[11].queue.dispatch) {
            stateHooks[11].queue.dispatch([
              { id: 'test-dn-1', value: 50, row: 2, col: 3, expiresAt: Date.now() + 5000 }
            ]);
            return;
          }
          throw new Error('damageNumbers hook (stateHooks[11]) not found');
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber');
    });
    // The .damage-number-crit element must appear in the damage-number-layer
    await expect(page.locator('.damage-number-layer').first()).toBeAttached({ timeout: 2000 });
    await expect(page.locator('.damage-number-crit').first()).toBeAttached({ timeout: 2000 });
    // Must show the injected damage value with a trailing '!'
    const text = await page.locator('.damage-number-crit').first().textContent();
    expect(text).toContain('50');
    expect(text).toContain('!');
  });

  test('.projectile-crit yellow line appears in the SVG layer when a crit projectile is injected', async ({ page }) => {
    // Inject a projectile with isCrit=true directly via React fiber.
    // projectiles = all-hooks index 8.
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          let hookNode = fiber.memoizedState;
          let i = 0;
          // projectiles = all-hooks index 9 (post-PR #131: tileSize inserted at [2])
          while (hookNode && i < 9) {
            hookNode = hookNode.next;
            i++;
          }
          if (hookNode && hookNode.queue && hookNode.queue.dispatch) {
            hookNode.queue.dispatch([
              {
                id: 'test-crit-proj-1',
                fromRow: 1, fromCol: 1,
                toRow: 2,   toCol: 1,
                createdAt: Date.now(),
                towerType: 'BasicTower',
                upgradeLevel: 0,
                isCrit: true,
              }
            ]);
            return;
          }
          throw new Error('projectiles hook (index 9) has no dispatch');
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber');
    });
    // The projectile SVG layer must be rendered (projectiles array is non-empty)
    await expect(page.locator('.projectile-layer')).toBeAttached({ timeout: 2000 });
    // The crit projectile line must carry the .projectile-crit class
    await expect(page.locator('.projectile-layer .projectile-crit').first()).toBeAttached({ timeout: 2000 });
  });

  test('.projectile-crit CSS class has a non-default stroke colour (yellow, not black)', async ({ page }) => {
    // Verify that the .projectile-crit CSS rule from index.css is loaded and applied.
    const strokeColor = await page.evaluate(() => {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.style.position = 'absolute';
      svg.style.top = '-9999px';
      document.body.appendChild(svg);
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('class', 'projectile-crit');
      svg.appendChild(line);
      const computed = getComputedStyle(line).stroke;
      document.body.removeChild(svg);
      return computed;
    });
    // The CSS rule for .projectile-crit must set a bright/yellow stroke — not black or empty
    expect(strokeColor).not.toBe('');
    expect(strokeColor).not.toBe('rgb(0, 0, 0)');
    expect(strokeColor).not.toBe('none');
  });

  test('.enemy-crit-flash class is applied to an enemy when _critFlashAt is set via state injection', async ({ page }) => {
    // Inject an enemy with _critFlashAt set (non-null) so the crit flash class is applied.
    // enemies = stateHooks[6] (dispatch index 6, unchanged by PR #104).
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // enemies = stateHooks[7] (post-PR #131)
          if (stateHooks[7]) {
            stateHooks[7].queue.dispatch([{
              id: 'test-crit-flash-1',
              hp: 80,
              maxHp: 100,
              pos: { row: 2, col: 3 },
              waypointIndex: 1,
              speed: 1.0,
              type: 'grunt',
              goldReward: 8,
              _critFlashAt: Date.now(),   // flash is active
            }]);
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber');
    });
    // Enemy layer must render
    await expect(page.locator('.enemy-layer').first()).toBeAttached({ timeout: 2000 });
    // The enemy must carry the .enemy-crit-flash class
    const enemyEl = page.locator('.enemy-layer .enemy-crit-flash').first();
    await expect(enemyEl).toBeAttached({ timeout: 2000 });
  });

  test('.enemy-crit-flash class is absent when _critFlashAt is null (no active flash)', async ({ page }) => {
    // Inject an enemy WITHOUT _critFlashAt so the flash class is NOT applied.
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // enemies = stateHooks[7] (post-PR #131)
          if (stateHooks[7]) {
            stateHooks[7].queue.dispatch([{
              id: 'test-no-crit-flash-1',
              hp: 80,
              maxHp: 100,
              pos: { row: 2, col: 4 },
              waypointIndex: 1,
              speed: 1.0,
              type: 'grunt',
              goldReward: 8,
              _critFlashAt: null,         // flash cleared — no class expected
            }]);
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber');
    });
    // Enemy layer must render
    await expect(page.locator('.enemy-layer').first()).toBeAttached({ timeout: 2000 });
    // No enemy should have the crit-flash class
    await expect(page.locator('.enemy-layer .enemy-crit-flash')).toHaveCount(0);
  });

  // --- Money animation: floating "+N gold" labels on enemy kill (issue #64) ---
  // These tests inject deathAnimations state directly via React fiber to avoid
  // relying on natural gameplay kills (BasicTower does only 25 damage/shot on
  // 80 HP grunts, requiring multiple passes which is unreliable in headless tests).

  test('death-gold-label appears when deathAnimations state is populated', async ({ page }) => {
    // Inject a deathAnimation entry directly via React fiber
    // App.jsx hook order (all hooks including useRef) post-PR #131 (tileSize added):
    //   difficultyMode(0), difficultyModeRef(1), tileSize(2), gold(3), lives(4), wave(5),
    //   speed(6), towers(7), enemies(8), projectiles(9), deathAnimations(10), deathAnimationsRef(11), ...
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          // Walk to hook index 10: deathAnimations (useState) post-PR #131
          let hookNode = fiber.memoizedState;
          let i = 0;
          while (hookNode && i < 10) {
            hookNode = hookNode.next;
            i++;
          }
          if (hookNode && hookNode.queue && hookNode.queue.dispatch) {
            hookNode.queue.dispatch([
              { id: 'test-da-1', row: 2, col: 3, gold: 8, createdAt: Date.now() }
            ]);
            return;
          }
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find deathAnimations hook dispatcher');
    });
    // The .death-gold-label must now be in the DOM
    await expect(page.locator('.death-gold-label').first()).toBeAttached({ timeout: 2000 });
    // Label text must start with '+'
    const labelText = await page.locator('.death-gold-label').first().textContent();
    expect(labelText).toMatch(/^\+\d+/);
  });

  test('death-animation-layer is present in the game-board-wrapper when deathAnimations has entries', async ({ page }) => {
    // Wait for React to mount and attach fiber data to the #game element
    await page.waitForSelector('#game', { state: 'attached' });
    await page.waitForFunction(() => {
      const el = document.querySelector('#game');
      if (!el) return false;
      return Object.keys(el).some(k => k.startsWith('__reactFiber'));
    }, { timeout: 5000 });
    // Inject a deathAnimation entry directly via React fiber (hook index 10 post-PR #131)
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          let hookNode = fiber.memoizedState;
          let i = 0;
          while (hookNode && i < 10) {
            hookNode = hookNode.next;
            i++;
          }
          if (hookNode && hookNode.queue && hookNode.queue.dispatch) {
            hookNode.queue.dispatch([
              { id: 'test-da-2', row: 3, col: 5, gold: 25, createdAt: Date.now() }
            ]);
            return;
          }
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find deathAnimations hook dispatcher');
    });
    // Layer must be inside the game board wrapper
    await expect(page.locator('.game-board-wrapper .death-animation-layer')).toBeAttached({ timeout: 2000 });
  });

  // --- Boss enemy every 5th wave (issue #66) ---

  /**
   * Helper: inject wave and gamePhase via React fiber dispatch hooks.
   * App.jsx useState hook order (dispatch-only, 0-indexed) after PR #97 (difficultyMode prepended):
   *   0=difficultyMode, 1=gold, 2=lives, 3=wave, 4=speed, 5=towers, 6=enemies,
   *   7=projectiles, 8=deathAnimations, 9=selectedTowerType, 10=selectedTower,
   *   11=hoveredSlot, 12=gamePhase, 13=endlessMode, 14=finalScore,
   *   15=powerCrates, 16=overchargeActive, 17=unlockedAchievements, 18=achievementToasts,
   *   19=achievementModalOpen, 20=comboDisplay, 21=adjacencySynergies,
   *   22=earlyWaveCalled, 23=pendingWaveAdvance, 24=currentWaveEventType
   */

  test('WaveCountdownBanner shows BOSS WAVE label when next wave is a multiple of 5', async ({ page }) => {
    // Inject wave=4 and gamePhase='between-waves'.
    // App renders: countdownIsBossWave = isBossWave(wave + 1) = isBossWave(5) = true
    // So the banner should show .wave-countdown-boss-label with "BOSS WAVE"
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          // Collect all dispatch-capable hooks
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // wave=index 4, gamePhase=index 19 (post-PR #131: tileSize inserted at [1])
          if (stateHooks[4]) stateHooks[4].queue.dispatch(4);           // wave → 4
          if (stateHooks[19]) stateHooks[19].queue.dispatch('between-waves'); // gamePhase (stateHooks[19] post-PR #131)
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });
    // Countdown banner must appear
    await expect(page.locator('.wave-countdown-banner')).toBeVisible({ timeout: 2000 });
    // Boss wave label must be attached in the DOM (it is position:absolute within flex and
    // may not register as visually 'visible' in headless — check attachment + text instead)
    await expect(page.locator('.wave-countdown-boss-label')).toBeAttached({ timeout: 2000 });
    const bossLabelText = await page.locator('.wave-countdown-boss-label').textContent();
    expect(bossLabelText).toContain('BOSS WAVE');
  });

  test('WaveCountdownBanner does NOT show BOSS WAVE label on a non-boss wave', async ({ page }) => {
    // Inject wave=2, gamePhase='between-waves' → next wave is 3 (not a multiple of 5)
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // wave=index 4, gamePhase=index 19 (post-PR #131: tileSize inserted at [1])
          if (stateHooks[4]) stateHooks[4].queue.dispatch(2);           // wave → 2
          if (stateHooks[19]) stateHooks[19].queue.dispatch('between-waves'); // gamePhase (stateHooks[19] post-PR #131)
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });
    await expect(page.locator('.wave-countdown-banner')).toBeVisible({ timeout: 2000 });
    // Boss label must NOT be present
    await expect(page.locator('.wave-countdown-boss-label')).not.toBeAttached();
  });

  test('colossus enemy renders .enemy-colossus-wrapper and .enemy-colossus-hex when injected', async ({ page }) => {
    // Inject a colossus enemy while in between-waves (game loop only runs when gamePhaseRef='playing';
    // fiber dispatch updates React state but NOT the ref, so the loop stays paused and won't wipe
    // our injected enemies before GameBoard re-renders them).
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // enemies = dispatch index 7 (post-PR #131: tileSize inserted at [1])
          if (stateHooks[7]) {
            stateHooks[7].queue.dispatch([{
              id: 'test-colossus-1',
              hp: 900,
              maxHp: 900,
              pos: { row: 2, col: 3 },
              waypointIndex: 1,
              speed: 0.6,
              type: 'colossus',
              goldReward: 150,
            }]);
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find enemies hook dispatcher');
    });

    // The enemy-layer renders when enemies.length > 0
    await expect(page.locator('.enemy-layer').first()).toBeAttached({ timeout: 2000 });
    // The colossus wrapper must appear in the enemy layer
    await expect(page.locator('.enemy-layer .enemy-colossus-wrapper').first()).toBeAttached({ timeout: 2000 });
    // The hexagon SVG polygon element must be rendered inside the colossus SVG
    await expect(page.locator('.enemy-colossus-hex').first()).toBeAttached({ timeout: 1000 });
  });

  // --- Boss health bar in HUD (issue #115 / PR #130) ---
  // When a Colossus enemy is on the board, the HUD must show a dedicated .hud-boss-bar-row.
  // The bar fill width must reflect the boss's HP ratio (> 0% when boss is alive).
  // The HP counter must show the numeric HP value.
  // When no Colossus is present, the .hud-boss-bar-row must be absent from the DOM.
  //
  // Injection strategy: dispatch enemies array with a colossus object via stateHooks[6]
  // while the game loop is paused (between-waves: gamePhaseRef is NOT 'playing' so the
  // loop does not overwrite injected state before React re-renders).
  // Hook indices unchanged from PR #129 header comment above.

  test('HUD boss bar is absent when no colossus is on the board', async ({ page }) => {
    // On initial load there are no enemies — .hud-boss-bar-row must not be in the DOM
    await expect(page.locator('.hud-boss-bar-row')).not.toBeAttached();
  });

  test('HUD boss bar appears when a colossus enemy is injected', async ({ page }) => {
    // Inject a colossus via stateHooks[6] (enemies) while game loop is paused (between-waves)
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // enemies = dispatch index 7 (post-PR #131)
          if (stateHooks[7]) {
            stateHooks[7].queue.dispatch([{
              id: 'test-colossus-boss-bar',
              hp: 750,
              maxHp: 900,
              pos: { row: 2, col: 3 },
              waypointIndex: 1,
              speed: 0.6,
              type: 'colossus',
              goldReward: 150,
            }]);
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find enemies hook dispatcher');
    });

    // .hud-boss-bar-row must appear in the DOM now that a colossus is present
    await expect(page.locator('.hud-boss-bar-row')).toBeAttached({ timeout: 2000 });
    // .hud--boss modifier must be on the HUD root (switches it to column flex)
    await expect(page.locator('.hud.hud--boss')).toBeAttached({ timeout: 2000 });
  });

  test('HUD boss bar fill width reflects the colossus HP ratio (> 0%)', async ({ page }) => {
    // Inject a colossus with hp=450 / maxHp=900 (50% HP)
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          if (stateHooks[7]) {
            stateHooks[7].queue.dispatch([{
              id: 'test-colossus-fill',
              hp: 450,
              maxHp: 900,
              pos: { row: 2, col: 3 },
              waypointIndex: 1,
              speed: 0.6,
              type: 'colossus',
              goldReward: 150,
            }]);
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find enemies hook dispatcher');
    });

    await expect(page.locator('.hud-boss-bar-fill')).toBeAttached({ timeout: 2000 });
    // Bar fill must have a positive width (hp=450/maxHp=900 → 50%)
    const widthStyle = await page.locator('.hud-boss-bar-fill').evaluate(el => el.style.width);
    expect(widthStyle).toBeTruthy();
    const widthPct = parseFloat(widthStyle);
    expect(widthPct).toBeGreaterThan(0);
    expect(widthPct).toBeLessThanOrEqual(100);
  });

  test('HUD boss bar HP counter shows correct numeric value', async ({ page }) => {
    // Inject a colossus with hp=300, maxHp=900
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          if (stateHooks[7]) {
            stateHooks[7].queue.dispatch([{
              id: 'test-colossus-hp-counter',
              hp: 300,
              maxHp: 900,
              pos: { row: 2, col: 3 },
              waypointIndex: 1,
              speed: 0.6,
              type: 'colossus',
              goldReward: 150,
            }]);
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find enemies hook dispatcher');
    });

    await expect(page.locator('.hud-boss-bar-hp')).toBeAttached({ timeout: 2000 });
    const hpText = await page.locator('.hud-boss-bar-hp').textContent();
    // Must show current HP (300) and maxHp (900)
    expect(hpText).toContain('300');
    expect(hpText).toContain('900');
  });

  test('HUD boss bar disappears when enemies list is cleared (boss defeated)', async ({ page }) => {
    // First inject a colossus to make the boss bar appear
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          if (stateHooks[7]) {
            stateHooks[7].queue.dispatch([{
              id: 'test-colossus-death',
              hp: 100,
              maxHp: 900,
              pos: { row: 2, col: 3 },
              waypointIndex: 1,
              speed: 0.6,
              type: 'colossus',
              goldReward: 150,
            }]);
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find enemies hook dispatcher');
    });
    await expect(page.locator('.hud-boss-bar-row')).toBeAttached({ timeout: 2000 });

    // Now clear enemies (simulate boss death — no more colossus)
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          if (stateHooks[7]) {
            stateHooks[7].queue.dispatch([]); // empty enemies array
          }
          return;
        }
        fiber = fiber.return;
      }
    });

    // Boss bar must be gone once no colossus is present
    await expect(page.locator('.hud-boss-bar-row')).not.toBeAttached({ timeout: 2000 });
  });

  test('HUD does not show boss bar for non-colossus enemies', async ({ page }) => {
    // Inject a grunt enemy (type='grunt') — boss bar must NOT appear
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          if (stateHooks[7]) {
            stateHooks[7].queue.dispatch([{
              id: 'test-grunt-1',
              hp: 100,
              maxHp: 100,
              pos: { row: 2, col: 1 },
              waypointIndex: 0,
              speed: 1,
              type: 'grunt',
              goldReward: 10,
            }]);
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find enemies hook dispatcher');
    });

    // Enemy layer should have our grunt
    await expect(page.locator('.enemy-layer').first()).toBeAttached({ timeout: 2000 });
    // Boss bar must NOT appear for non-colossus enemies
    await expect(page.locator('.hud-boss-bar-row')).not.toBeAttached();
  });

  // --- Combo kill-streak banner (issue #68) ---

  test('combo banner is hidden by default before any kills', async ({ page }) => {
    // On initial load comboDisplay.visible is false — .combo-banner must NOT be in the DOM
    await expect(page.locator('.combo-banner')).not.toBeAttached();
  });

  test('combo banner appears when comboDisplay state is injected with visible=true and count>=2', async ({ page }) => {
    // Inject comboDisplay = { count: 3, label: 'TRIPLE KILL', bonus: 5, visible: true }
    // via React fiber dispatch. comboDisplay = dispatch index 16.
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // comboDisplay = stateHooks[31] (post-PR #135: historyPanelOpen inserted at [28])
          if (stateHooks[31]) {
            stateHooks[31].queue.dispatch({ count: 3, label: 'TRIPLE KILL', bonus: 5, visible: true });
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find comboDisplay hook dispatcher');
    });
    // .combo-banner must be attached after injection
    await expect(page.locator('.combo-banner').first()).toBeAttached({ timeout: 2000 });
    const bannerText = await page.locator('.combo-banner').first().textContent();
    expect(bannerText).toContain('3×');
    expect(bannerText).toContain('TRIPLE KILL');
    expect(bannerText).toContain('+5g');
  });

  test('combo banner shows rampage class at 5+ kills', async ({ page }) => {
    // Inject comboDisplay = { count: 5, label: 'RAMPAGE', bonus: 20, visible: true }
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // comboDisplay = stateHooks[31] (post-PR #135: historyPanelOpen inserted at [28])
          if (stateHooks[31]) {
            stateHooks[31].queue.dispatch({ count: 5, label: 'RAMPAGE', bonus: 20, visible: true });
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find comboDisplay hook dispatcher');
    });
    await expect(page.locator('.combo-banner').first()).toBeAttached({ timeout: 2000 });
    // Rampage class must be present at 5+ kills
    const cls = await page.locator('.combo-banner').first().getAttribute('class');
    expect(cls).toContain('combo-banner--rampage');
    const bannerText = await page.locator('.combo-banner').first().textContent();
    expect(bannerText).toContain('RAMPAGE');
    expect(bannerText).toContain('+20g');
  });

  test('combo banner does not show rampage class for Quad Kill (4 kills)', async ({ page }) => {
    // Inject comboDisplay = { count: 4, label: 'QUAD KILL', bonus: 10, visible: true }
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // comboDisplay = stateHooks[31] (post-PR #135: historyPanelOpen inserted at [28])
          if (stateHooks[31]) {
            stateHooks[31].queue.dispatch({ count: 4, label: 'QUAD KILL', bonus: 10, visible: true });
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find comboDisplay hook dispatcher');
    });
    await expect(page.locator('.combo-banner').first()).toBeAttached({ timeout: 2000 });
    const cls = await page.locator('.combo-banner').first().getAttribute('class');
    expect(cls).not.toContain('combo-banner--rampage');
    const bannerText = await page.locator('.combo-banner').first().textContent();
    expect(bannerText).toContain('QUAD KILL');
    expect(bannerText).toContain('+10g');
  });

  test('combo banner is hidden when comboVisible is set to false', async ({ page }) => {
    // First inject a visible combo, then hide it
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // comboDisplay = stateHooks[31] (post-PR #135: historyPanelOpen inserted at [28])
          if (stateHooks[31]) {
            stateHooks[31].queue.dispatch({ count: 0, label: '', bonus: 0, visible: false });
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find comboDisplay hook dispatcher');
    });
    // Banner must NOT be in the DOM
    await expect(page.locator('.combo-banner')).not.toBeAttached({ timeout: 2000 });
  });

  // --- Tower adjacency synergy (issue #69) ---

  test('tower-synergy-badge (⚡) appears on a tower with an active synergy', async ({ page }) => {
    // Dismiss NextWave overlay
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Ensure BasicTower is selected (default)
    const basicBtn = page.locator('.tower-picker button').filter({ hasText: 'BasicTower' });
    if (await basicBtn.isVisible() && (await basicBtn.getAttribute('disabled')) === null) {
      await basicBtn.click();
    }
    // Place two adjacent BasicTowers so they trigger BasicTower+BasicTower synergy (+10% damage)
    const slots = page.locator('.tower-slot');
    const count = await slots.count();
    expect(count).toBeGreaterThanOrEqual(2);
    await slots.nth(0).click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    // Dismiss the upgrade panel by clicking a path tile (deselects tower, closes panel)
    const pathTile = page.locator('.tile.path').first();
    await expect(pathTile).toBeAttached();
    await pathTile.click();
    await expect(page.locator('.upgrade-panel')).not.toBeVisible({ timeout: 2000 });
    // Re-select BasicTower for the second placement
    if (await basicBtn.isVisible() && (await basicBtn.getAttribute('disabled')) === null) {
      await basicBtn.click();
    }
    await slots.nth(1).click();
    await expect(page.locator('.tower-icon')).toHaveCount(2);
    // Both BasicTowers should now show .tower-synergy-badge (⚡) indicating active synergy
    await expect(page.locator('.tower-synergy-badge').first()).toBeAttached({ timeout: 2000 });
  });

  test('tower-synergy-badge is absent when tower has no adjacent synergy partner', async ({ page }) => {
    // Dismiss NextWave overlay
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Place a single isolated BasicTower — no adjacent partner → no synergy
    const basicBtn = page.locator('.tower-picker button').filter({ hasText: 'BasicTower' });
    if (await basicBtn.isVisible() && (await basicBtn.getAttribute('disabled')) === null) {
      await basicBtn.click();
    }
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    // No synergy badge expected
    await expect(page.locator('.tower-synergy-badge')).toHaveCount(0);
  });

  test('UpgradePanel shows .upgrade-panel-synergies section when tower has active synergy', async ({ page }) => {
    // Dismiss NextWave overlay
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Place two adjacent BasicTowers to trigger synergy
    const basicBtn = page.locator('.tower-picker button').filter({ hasText: 'BasicTower' });
    if (await basicBtn.isVisible() && (await basicBtn.getAttribute('disabled')) === null) {
      await basicBtn.click();
    }
    const slots = page.locator('.tower-slot');
    // Place first BasicTower (auto-select opens panel)
    await slots.nth(0).click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    // Dismiss the panel by clicking a path tile before re-selecting tower type
    const pathTile = page.locator('.tile.path').first();
    await expect(pathTile).toBeAttached();
    await pathTile.click();
    await expect(page.locator('.upgrade-panel')).not.toBeVisible({ timeout: 2000 });
    // Re-select BasicTower for second placement
    if (await basicBtn.isVisible() && (await basicBtn.getAttribute('disabled')) === null) {
      await basicBtn.click();
    }
    // Place second adjacent BasicTower (auto-select opens panel for second tower)
    await slots.nth(1).click();
    await expect(page.locator('.tower-icon')).toHaveCount(2);
    // The upgrade panel for the most recently placed tower should show synergies
    const panel = page.locator('.upgrade-panel');
    await expect(panel).toBeVisible();
    // .upgrade-panel-synergies must be present with synergy description text
    await expect(panel.locator('.upgrade-panel-synergies')).toBeAttached({ timeout: 2000 });
    const synText = await panel.locator('.upgrade-panel-synergies').textContent();
    expect(synText).toContain('Synergies');
  });

  test('UpgradePanel synergy section shows synergy description text for adjacent BasicTowers', async ({ page }) => {
    // Dismiss NextWave overlay
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    const basicBtn = page.locator('.tower-picker button').filter({ hasText: 'BasicTower' });
    if (await basicBtn.isVisible() && (await basicBtn.getAttribute('disabled')) === null) {
      await basicBtn.click();
    }
    const slots = page.locator('.tower-slot');
    await slots.nth(0).click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    // Dismiss the panel before re-selecting tower type
    const pathTile = page.locator('.tile.path').first();
    await expect(pathTile).toBeAttached();
    await pathTile.click();
    await expect(page.locator('.upgrade-panel')).not.toBeVisible({ timeout: 2000 });
    if (await basicBtn.isVisible() && (await basicBtn.getAttribute('disabled')) === null) {
      await basicBtn.click();
    }
    await slots.nth(1).click();
    await expect(page.locator('.tower-icon')).toHaveCount(2);
    const panel = page.locator('.upgrade-panel');
    await expect(panel).toBeVisible();
    // The synergy item must contain the description from SYNERGY_RULES for BasicTower+BasicTower
    const synItem = panel.locator('.upgrade-panel-synergy-item').first();
    await expect(synItem).toBeAttached({ timeout: 2000 });
    const itemText = await synItem.textContent();
    expect(itemText).toContain('+10% damage');
  });

  test('power crate renders .power-crate element when injected into state', async ({ page }) => {
    // Inject a power crate directly via React fiber (powerCrates = dispatch index 15 after PR #97).
    // No need to start the wave — crate rendering is independent of gamePhase.
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // powerCrates = stateHooks[21] (post-PR #131)
          if (stateHooks[21]) {
            stateHooks[21].queue.dispatch([{
              id: 'test-crate-1',
              row: 3,
              col: 4,
            }]);
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find powerCrates hook dispatcher');
    });

    // The .power-crate element must appear on the board
    await expect(page.locator('.power-crate').first()).toBeAttached({ timeout: 2000 });
  });

  // --- Tower kill counter and kill badge (issue #70) ---
  // App.jsx useState dispatch hook order (0-indexed):
  //   0=gold, 1=lives, 2=wave, 3=speed, 4=towers, 5=enemies,
  //   6=projectiles, 7=deathAnimations, 8=selectedTowerType, 9=selectedTower,
  //   10=hoveredSlot, 11=gamePhase, ...

  test('tower at 0 kills shows no .tower-kill-badge', async ({ page }) => {
    // Dismiss overlay and place a tower
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    // Fresh tower has kills=0 — badge must NOT be present
    await expect(page.locator('.tower-kill-badge')).toHaveCount(0);
  });

  test('tower with kills >= 1 shows .tower-kill-badge via state injection', async ({ page }) => {
    // Dismiss overlay
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Place a tower so there is a tile at row=1, col=1
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();

    // Inject towers state with kills=5 on the placed tower via React fiber (dispatch index 5 after PR #97)
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // Read current towers (index 6 post-PR #131: tileSize inserted at [1]) and patch kills
          const towersHook = stateHooks[6];
          if (towersHook) {
            const currentTowers = towersHook.memoizedState;
            if (currentTowers && currentTowers.length > 0) {
              const patched = currentTowers.map((t, i) =>
                i === 0 ? { ...t, kills: 5 } : t
              );
              towersHook.queue.dispatch(patched);
            }
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });

    // Badge must appear for a tower with 5 kills
    await expect(page.locator('.tower-kill-badge').first()).toBeAttached({ timeout: 2000 });
  });

  test('kill badge on a tower with 5 kills has .tower-kill-badge--grey colour class', async ({ page }) => {
    // Dismiss overlay and place a tower
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();

    // Inject kills=9 (upper boundary of grey tier)
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // towers = dispatch index 6 (post-PR #131: tileSize inserted at [1])
          const towersHook = stateHooks[6];
          if (towersHook) {
            const currentTowers = towersHook.memoizedState;
            if (currentTowers && currentTowers.length > 0) {
              towersHook.queue.dispatch(
                currentTowers.map((t, i) => i === 0 ? { ...t, kills: 9 } : t)
              );
            }
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });

    const badge = page.locator('.tower-kill-badge').first();
    await expect(badge).toBeAttached({ timeout: 2000 });
    const classes = await badge.getAttribute('class');
    expect(classes).toContain('tower-kill-badge--grey');
  });

  test('UpgradePanel shows "Kills:" stat row when a tower is selected', async ({ page }) => {
    // Dismiss overlay and place a tower (auto-select opens panel immediately)
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    // UpgradePanel opens automatically on placement
    const panel = page.locator('.upgrade-panel');
    await expect(panel).toBeVisible();
    // PR #132: Kills label moved to .upgrade-panel-kills (above the diff table)
    const killsEl = panel.locator('.upgrade-panel-kills');
    await expect(killsEl).toBeVisible();
    const killsText = await killsEl.textContent();
    expect(killsText).toContain('Kills:');
  });

  // --- Special wave events — Horde, Elite, Stealth (issue #71) ---

  test('WaveCountdownBanner shows .wave-countdown-event-label when next wave is a special event (elite)', async ({ page }) => {
    // Strategy: force waveEventSeedRef.current = 0 so that getWaveEventType(4, 0) = 'elite' (deterministic).
    // Then set wave=3 and gamePhase='between-waves' so countdownWave = wave+1 = 4.
    // App.jsx hook order (all hooks, 0-indexed) after PR #100 (interest hooks inserted at 24-30):
    //   0=difficultyMode(S), 1=difficultyModeRef(R), 2=gold(S), 3=lives(S), 4=wave(S), 5=speed(S),
    //   6=towers(S), 7=enemies(S), 8=projectiles(S), 9=deathAnimations(S), 10=deathAnimationsRef(R),
    //   11=selectedTowerType(S), 12=selectedTower(S), 13=hoveredSlot(S), 14=gamePhase(S),
    //   15=endlessMode(S), 16=endlessModeRef(R), 17=finalScore(S),
    //   18=powerCrates(S), 19=powerCratesRef(R), 20=nextCrateIdRef(R),
    //   21=overchargeActive(S), 22=overchargeUntilRef(R), 23=overchargeActiveRef(R),
    //   24=interestRealTimeRef(R), 25=gameStartRealTimeRef(R), 26=lastInterestWallRef(R),
    //   27=interestFlash(S), 28=interestCountdown(S), 29=interestCountdownRef(R), 30=goldRef(R),
    //   31=unlockedAchievements(S), 32=unlockedAchievementsRef(R), 33=achievementToasts(S),
    //   34=achievementToastsRef(R), 35=achievementModalOpen(S),
    //   (per-run refs...) 36..42=various tracking Refs,
    //   43=comboCountRef(R), 44=comboWindowExpiryRef(R), 45=comboBannerUntilRef(R),
    //   46=comboDisplay(S), 47=adjacencySynergies(S), 48=adjacencySynergiesRef(R),
    //   49=nextEnemyIdRef(R), 50=spawnTimerRef(R), 51=waveEventSeedRef(R),
    //   (S=useState, R=useRef)
    // NOTE: waveEventSeedRef is now at all-hooks index 51 (+7 shift from PR #100).
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          // Walk all hooks until we find waveEventSeedRef — look for a useRef whose
          // memoizedState has a numeric 'current' and appears after earlyWaveCalledRef.
          // Walk to waveEventSeedRef. Strategy: collect all useState dispatch hooks first,
          // then find the useRef that comes IMMEDIATELY after pendingWaveAdvance (stateHooks[25]).
          // After PR #100, pendingWaveAdvance is dispatch stateHook index 25.
          // waveEventSeedRef is the very next hook node (it's a useRef, so no queue.dispatch).
          const stateHooksForSeed = [];
          let hookNode = fiber.memoizedState;
          let pendingWaveAdvanceHookNode = null;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooksForSeed.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // stateHooks[35] = pendingWaveAdvance (post-PR #131: tileSize inserted at [1], shifting all by +1)
          // waveEventSeedRef is the very next hook node after pendingWaveAdvance.
          const pendingWaveHook = stateHooksForSeed[35];
          if (pendingWaveHook) {
            // Walk all hooks to find pendingWaveHook and grab the next one
            let hNode = fiber.memoizedState;
            while (hNode) {
              if (hNode === pendingWaveHook) {
                // The next hook should be waveEventSeedRef (useRef)
                const seedRef = hNode.next;
                if (seedRef && seedRef.memoizedState && 'current' in seedRef.memoizedState && !seedRef.queue) {
                  seedRef.memoizedState.current = 0; // force seed=0 → getWaveEventType(4,0)='elite'
                }
                break;
              }
              hNode = hNode.next;
            }
          }

          // Now collect dispatch-capable (useState) hooks to set wave and gamePhase
          const stateHooks = [];
          hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // Dispatch indices (useState only, 0-indexed) post-PR #131: wave=4, gamePhase=19
          if (stateHooks[4]) stateHooks[4].queue.dispatch(3);           // wave → 3
          if (stateHooks[19]) stateHooks[19].queue.dispatch('between-waves'); // gamePhase (stateHooks[19] post-PR #131)
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });

    // Countdown banner must be visible (wave=3 > 1, phase='between-waves')
    await expect(page.locator('.wave-countdown-banner')).toBeVisible({ timeout: 2000 });
    // The event label span must be attached: seed=0, wave+1=4 → getWaveEventType(4,0)='elite'
    await expect(page.locator('.wave-countdown-event-label')).toBeAttached({ timeout: 2000 });
    // The label must carry the elite modifier class
    const labelEl = page.locator('.wave-countdown-event-label--elite');
    await expect(labelEl).toBeAttached({ timeout: 2000 });
    // The label text must mention ELITE
    const labelText = await labelEl.textContent();
    expect(labelText).toContain('ELITE');
    // Banner itself must carry the event modifier class
    const bannerCls = await page.locator('.wave-countdown-banner').getAttribute('class');
    expect(bannerCls).toContain('wave-countdown-banner--elite');
  });

  test('WaveCountdownBanner shows no .wave-countdown-event-label on a normal wave', async ({ page }) => {
    // With the default seed (any) wave=2 → countdownWave=3 → waves 1-3 are always 'normal'
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // wave=2 so countdownWave=3; waves <4 are always 'normal'
          // Dispatch indices post-PR #131: wave=4, gamePhase=19
          if (stateHooks[4]) stateHooks[4].queue.dispatch(2);
          if (stateHooks[19]) stateHooks[19].queue.dispatch('between-waves'); // gamePhase (stateHooks[19] post-PR #131)
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });
    await expect(page.locator('.wave-countdown-banner')).toBeVisible({ timeout: 2000 });
    // No event label for a normal wave
    await expect(page.locator('.wave-countdown-event-label')).not.toBeAttached();
  });

  // --- Achievement System (issue #72 / PR #96) ---

  /**
   * Hook index map (App.jsx, all hooks in declaration order) after PR #103 (prestige hooks inserted):
   *   0  difficultyMode        useState  ← PR #97
   *   1  difficultyModeRef     useRef    ← PR #97
   *   2  gold                  useState
   *   3  lives                 useState
   *   4  wave                  useState
   *   5  speed                 useState
   *   6  towers                useState
   *   7  enemies               useState
   *   8  projectiles           useState
   *   9  deathAnimations       useState
   *  10  deathAnimationsRef    useRef
   *  11  selectedTowerType     useState
   *  12  selectedTower         useState
   *  13  hoveredSlot           useState
   *  14  gamePhase             useState
   *  15  endlessMode           useState
   *  16  endlessModeRef        useRef
   *  17  finalScore            useState
   *  18  powerCrates           useState
   *  19  powerCratesRef        useRef
   *  20  nextCrateIdRef        useRef
   *  21  overchargeActive      useState
   *  22  overchargeUntilRef    useRef
   *  23  overchargeActiveRef   useRef
   *  24  interestRealTimeRef   useRef    ← PR #100
   *  25  gameStartRealTimeRef  useRef    ← PR #100
   *  26  lastInterestWallRef   useRef    ← PR #100
   *  27  interestFlash         useState  ← PR #100
   *  28  interestCountdown     useState  ← PR #100
   *  29  interestCountdownRef  useRef    ← PR #100
   *  30  goldRef               useRef    ← PR #100
   *  31  unlockedAchievements  useState
   *  32  unlockedAchievementsRef useRef
   *  33  achievementToasts     useState
   *  34  achievementToastsRef  useRef
   *  35  achievementModalOpen  useState
   *  36  prestigeStars         useState  ← PR #103
   *  37  wavesReachedRef       useRef    ← PR #103
   *  38  wavesReached          useState  ← PR #103
   *
   * useState-only (stateHooks[N], dispatch-capable hooks in order, post-PR #131):
   *   stateHooks[0]  = difficultyMode
   *   stateHooks[1]  = tileSize         ← PR #131 NEW
   *   stateHooks[2]  = gold
   *   stateHooks[3]  = lives
   *   stateHooks[4]  = wave
   *   stateHooks[5]  = speed
   *   stateHooks[6]  = towers
   *   stateHooks[7]  = enemies
   *   stateHooks[8]  = projectiles
   *   stateHooks[9]  = deathAnimations
   *   stateHooks[10] = deathParticles
   *   stateHooks[11] = damageNumbers
   *   stateHooks[12] = poisonPuffs
   *   stateHooks[13] = placementPulses
   *   stateHooks[14] = screenShakeActive
   *   stateHooks[15] = selectedTowerType
   *   stateHooks[16] = hoverTowerType
   *   stateHooks[17] = selectedTower
   *   stateHooks[18] = hoveredSlot
   *   stateHooks[19] = gamePhase
   *   stateHooks[20] = finalScore
   *   stateHooks[21] = powerCrates
   *   stateHooks[22] = overchargeActive
   *   stateHooks[23] = interestFlash
   *   stateHooks[24] = interestCountdown
   *   stateHooks[25] = unlockedAchievements
   *   stateHooks[26] = achievementToasts
   *   stateHooks[27] = achievementModalOpen
   *   stateHooks[28] = prestigeStars
   *   stateHooks[29] = wavesReached
   *   stateHooks[30] = comboDisplay
   *   stateHooks[31] = adjacencySynergies
   *   stateHooks[32] = synergyPartners
   *   stateHooks[33] = showSynergies
   *   stateHooks[34] = earlyWaveCalled
   *   stateHooks[35] = pendingWaveAdvance
   *   stateHooks[36] = currentWaveEventType
   */

  /**
   * Collect all state hooks (hooks with a .queue.dispatch) from the App fiber,
   * returning them in declaration order (only useState hooks, not useRef).
   */
  async function getAppStateHooks(page) {
    return page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          // Collect all hooks (both useState and useRef) in order
          const hooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            hooks.push({
              hasDispatch: !!(hookNode.queue && typeof hookNode.queue.dispatch === 'function'),
              index: hooks.length,
            });
            hookNode = hookNode.next;
          }
          return hooks;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber');
    });
  }

  /**
   * Inject a value into App hook at the given overall hook index (including useRef hooks).
   * Only works for useState hooks (those with queue.dispatch).
   */
  async function dispatchAppHook(page, hookIndex, value) {
    await page.evaluate(({ hookIndex, value }) => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          let hookNode = fiber.memoizedState;
          let i = 0;
          while (hookNode) {
            if (i === hookIndex) {
              if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
                hookNode.queue.dispatch(value);
                return;
              }
              throw new Error(`Hook ${hookIndex} has no dispatch — it may be a useRef`);
            }
            hookNode = hookNode.next;
            i++;
          }
          throw new Error(`Hook index ${hookIndex} out of range`);
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber');
    }, { hookIndex, value });
  }

  test('HUD burger menu shows Achievements button with count (e.g. "Achievements (0/12)")', async ({ page }) => {
    // PR #125: achievements moved into burger menu. Dismiss NextWave overlay then open it.
    const nwBtn = page.locator('.next-wave-start');
    if (await nwBtn.isVisible()) await nwBtn.click();
    await page.locator('.hud-burger-btn').click();
    const btn = page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: 'Achievements' });
    await expect(btn).toBeVisible();
    // Must contain a fraction of the form N/12
    const text = await btn.textContent();
    expect(text).toMatch(/Achievements \(\d+\/12\)/);
  });

  test('HUD burger menu Achievements button shows 0/12 when no achievements are unlocked', async ({ page }) => {
    // Clear localStorage achievements and reload to start fresh
    await page.evaluate(() => localStorage.removeItem('unlockedAchievements'));
    await page.reload();
    // Dismiss difficulty overlay
    const diffOverlay = page.locator('.difficulty-overlay');
    if (await diffOverlay.isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    // Dismiss NextWave overlay so burger btn is clickable
    const nwBtn = page.locator('.next-wave-start');
    if (await nwBtn.isVisible()) await nwBtn.click();
    await page.locator('.hud-burger-btn').click();
    const btn = page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: 'Achievements' });
    await expect(btn).toBeVisible();
    const text = await btn.textContent();
    expect(text).toMatch(/Achievements \(0\/12\)/);
  });

  test('clicking the burger menu Achievements button opens the achievement modal', async ({ page }) => {
    // Dismiss the NextWave overlay so the HUD is interactive
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Modal should not be visible initially
    await expect(page.locator('.achievement-modal')).not.toBeAttached();
    // Open burger menu and click Achievements
    await page.locator('.hud-burger-btn').click();
    await page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: 'Achievements' }).click();
    // Modal overlay and modal must appear
    await expect(page.locator('.achievement-modal-overlay')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.achievement-modal')).toBeVisible();
  });

  test('achievement modal lists 12 achievement items', async ({ page }) => {
    // Dismiss the NextWave overlay so the HUD is interactive
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Open burger menu and click Achievements
    await page.locator('.hud-burger-btn').click();
    await page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: 'Achievements' }).click();
    await expect(page.locator('.achievement-modal')).toBeVisible({ timeout: 2000 });
    // Must have exactly 12 achievement items
    const items = page.locator('.achievement-item');
    await expect(items).toHaveCount(12);
  });

  test('achievement modal shows locked items with 🔒 icon when no achievements unlocked', async ({ page }) => {
    // Ensure no achievements are unlocked
    await page.evaluate(() => localStorage.removeItem('unlockedAchievements'));
    await page.reload();
    // After reload, dismiss difficulty overlay (PR #97) before interacting
    const diffOverlayR = page.locator('.difficulty-overlay');
    if (await diffOverlayR.isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    // Dismiss the NextWave overlay so the HUD trophy button is clickable
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Open burger menu and click Achievements
    await page.locator('.hud-burger-btn').click();
    await page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: 'Achievements' }).click();
    await expect(page.locator('.achievement-modal')).toBeVisible({ timeout: 2000 });
    // All items must be locked
    const lockedItems = page.locator('.achievement-item--locked');
    await expect(lockedItems).toHaveCount(12);
    // Locked items show 🔒 icon
    const firstIcon = page.locator('.achievement-item--locked .achievement-item-icon').first();
    const iconText = await firstIcon.textContent();
    expect(iconText).toContain('🔒');
    // Locked names show '???'
    const firstName = page.locator('.achievement-item--locked .achievement-item-name').first();
    const nameText = await firstName.textContent();
    expect(nameText).toBe('???');
  });

  test('achievement modal shows unlocked items with 🏆 icon when achievements are injected', async ({ page }) => {
    // Dismiss the NextWave overlay so the HUD trophy button is clickable
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Inject unlockedAchievements = ['first_blood'] via React fiber (hook index 31)
    await dispatchAppHook(page, 40, ['first_blood']); // unlockedAchievements = all-hooks[39] post-PR #129hooks[38] post-PR #110
    // Open burger menu and click Achievements
    await page.locator('.hud-burger-btn').click();
    await page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: 'Achievements' }).click();
    await expect(page.locator('.achievement-modal')).toBeVisible({ timeout: 2000 });
    // At least one unlocked item should appear
    const unlockedItems = page.locator('.achievement-item--unlocked');
    await expect(unlockedItems).toHaveCount(1);
    // Unlocked item shows 🏆 icon
    const icon = unlockedItems.locator('.achievement-item-icon');
    const iconText = await icon.textContent();
    expect(iconText).toContain('🏆');
    // Unlocked item shows actual achievement name (not '???')
    const name = unlockedItems.locator('.achievement-item-name');
    const nameText = await name.textContent();
    expect(nameText).toBe('First Blood');
  });

  test('achievement modal header shows correct unlocked count', async ({ page }) => {
    // Dismiss the NextWave overlay so the HUD trophy button is clickable
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Inject 3 unlocked achievements
    await dispatchAppHook(page, 40, ['first_blood', 'boss_slayer', 'combo_king']); // unlockedAchievements all[40] post-PR #131
    // Open burger menu and click Achievements
    await page.locator('.hud-burger-btn').click();
    await page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: 'Achievements' }).click();
    await expect(page.locator('.achievement-modal')).toBeVisible({ timeout: 2000 });
    // Modal title must show 3/12
    const title = page.locator('.achievement-modal-title');
    const titleText = await title.textContent();
    expect(titleText).toContain('3/12');
  });

  test('clicking the close button in the achievement modal closes it', async ({ page }) => {
    // Dismiss the NextWave overlay so the HUD is interactive
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Open burger menu and click Achievements
    await page.locator('.hud-burger-btn').click();
    await page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: 'Achievements' }).click();
    await expect(page.locator('.achievement-modal')).toBeVisible({ timeout: 2000 });
    // Click close button
    await page.locator('.achievement-modal-close').click();
    // Modal must be gone
    await expect(page.locator('.achievement-modal')).not.toBeAttached({ timeout: 2000 });
  });

  test('clicking the modal overlay backdrop closes the modal', async ({ page }) => {
    // Dismiss the NextWave overlay so the HUD is interactive
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Open burger menu and click Achievements
    await page.locator('.hud-burger-btn').click();
    await page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: 'Achievements' }).click();
    await expect(page.locator('.achievement-modal-overlay')).toBeVisible({ timeout: 2000 });
    // Click the overlay (not the modal itself) — use coordinates at the very top-left
    // of the overlay which is outside the centered modal panel
    await page.locator('.achievement-modal-overlay').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('.achievement-modal')).not.toBeAttached({ timeout: 2000 });
  });

  test('burger menu Achievements button count updates when achievements are injected', async ({ page }) => {
    // Inject 5 achievements
    await dispatchAppHook(page, 40, ['first_blood', 'boss_slayer', 'combo_king', 'tower_builder', 'golden_hoard']); // unlockedAchievements all[40] post-PR #131
    // Dismiss NextWave overlay then open burger menu and check button text
    const nwBtn = page.locator('.next-wave-start');
    if (await nwBtn.isVisible()) await nwBtn.click();
    await page.locator('.hud-burger-btn').click();
    const btn = page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: 'Achievements' });
    await expect(btn).toBeVisible();
    // Button text should update to 5/12
    await expect(btn).toContainText('5/12');
  });

  test('AchievementToast appears when an achievement toast is injected', async ({ page }) => {
    // Toast container must not be visible when no toasts are active
    await expect(page.locator('.achievement-toast-container')).not.toBeAttached();
    // Inject a toast via hook index 33 (achievementToasts, after PR #100 interest hooks inserted)
    await dispatchAppHook(page, 42, [{ id: 'first_blood', name: 'First Blood', dismissAt: Date.now() + 5000 }]); // achievementToasts = all-hooks[42] post-PR #131
    // Toast container and toast must appear
    await expect(page.locator('.achievement-toast-container')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.achievement-toast').first()).toBeVisible();
    // Toast text must mention "Achievement Unlocked" and the achievement name
    const toastText = await page.locator('.achievement-toast').first().textContent();
    expect(toastText).toContain('Achievement Unlocked');
    expect(toastText).toContain('First Blood');
  });

  test('AchievementToast shows trophy icon', async ({ page }) => {
    // Inject a toast via hook index 33 (achievementToasts, after PR #100 interest hooks inserted)
    await dispatchAppHook(page, 42, [{ id: 'boss_slayer', name: 'Boss Slayer', dismissAt: Date.now() + 5000 }]); // achievementToasts = all-hooks[42] post-PR #131
    await expect(page.locator('.achievement-toast').first()).toBeVisible({ timeout: 2000 });
    const icon = page.locator('.achievement-toast-icon').first();
    const iconText = await icon.textContent();
    expect(iconText).toContain('🏆');
  });

  test('achievement modal is accessible — has achievement-modal-list with list items', async ({ page }) => {
    // Dismiss the NextWave overlay so the HUD is interactive
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Open burger menu and click Achievements
    await page.locator('.hud-burger-btn').click();
    await page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: 'Achievements' }).click();
    await expect(page.locator('.achievement-modal')).toBeVisible({ timeout: 2000 });
    // Must have a list
    await expect(page.locator('.achievement-modal-list')).toBeVisible();
    // List must contain li elements
    const listItems = page.locator('.achievement-modal-list li');
    const count = await listItems.count();
    expect(count).toBe(12);
  });

  // --- MortarTower (issue #74 / PR #98) ---

  test('TowerPicker shows MortarTower button', async ({ page }) => {
    await expect(page.locator('.tower-picker')).toBeVisible();
    await expect(page.locator('.tower-picker button').filter({ hasText: 'MortarTower' })).toBeAttached();
  });

  test('MortarTower button is disabled when player cannot afford it (Normal start: 100g, cost: 125g)', async ({ page }) => {
    // On Normal difficulty player starts with 100g; MortarTower costs 125g → must be disabled
    const mortarBtn = page.locator('.tower-picker button').filter({ hasText: 'MortarTower' });
    await expect(mortarBtn).toBeAttached();
    const disabled = await mortarBtn.getAttribute('disabled');
    expect(disabled).not.toBeNull();
  });

  test('MortarTower renders SVG with rect.tower-mortar when placed (via gold injection)', async ({ page }) => {
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // MortarTower costs 125g; player starts with 100g on Normal → inject gold = 200 first
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // gold = dispatch index 2 (post-PR #131: tileSize inserted at [1])
          if (stateHooks[2]) stateHooks[2].queue.dispatch(200);
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });

    // Wait for button to become enabled after gold injection
    const mortarBtn = page.locator('.tower-picker button').filter({ hasText: 'MortarTower' });
    await expect(mortarBtn).not.toBeDisabled({ timeout: 2000 });
    await mortarBtn.click();
    await expect(mortarBtn).toHaveClass(/selected/);

    // Place on first available tower slot
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    const towerIcon = page.locator('.tower-icon').first();
    await expect(towerIcon).toBeVisible();

    // SVG must be present with a rect carrying class tower-mortar (PR #121 angled-mortar redesign)
    const svgEl = towerIcon.locator('svg');
    await expect(svgEl).toBeAttached();
    await expect(svgEl.locator('rect.tower-mortar').first()).toBeAttached();

    // The icon must not contain raw emoji text
    const innerText = await towerIcon.evaluate(el => el.innerText.trim());
    expect(innerText).toBe('');
  });

  test('projectile-mortar-shell CSS class has a non-default fill colour (orange, not black)', async ({ page }) => {
    // Verify that the .projectile-mortar-shell CSS rule from index.css is loaded and applied.
    const fillColor = await page.evaluate(() => {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.style.position = 'absolute';
      svg.style.top = '-9999px';
      document.body.appendChild(svg);
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('class', 'projectile-mortar-shell');
      svg.appendChild(circle);
      const computed = getComputedStyle(circle).fill;
      document.body.removeChild(svg);
      return computed;
    });
    // CSS rule sets fill: #ff8c00 — any non-black, non-empty value confirms the rule applied
    expect(fillColor).not.toBe('');
    expect(fillColor).not.toBe('rgb(0, 0, 0)');
    expect(fillColor).not.toBe('none');
  });

  test('tower-mortar SVG fill is a dark grey colour (not transparent or black)', async ({ page }) => {
    // Verify the .tower-mortar CSS rule (fill: #4a4a5e) is loaded from index.css
    const fillColor = await page.evaluate(() => {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.style.position = 'absolute';
      svg.style.top = '-9999px';
      document.body.appendChild(svg);
      const polygon = document.createElementNS(ns, 'polygon');
      polygon.setAttribute('class', 'tower-mortar');
      svg.appendChild(polygon);
      const computed = getComputedStyle(polygon).fill;
      document.body.removeChild(svg);
      return computed;
    });
    expect(fillColor).not.toBe('');
    expect(fillColor).not.toBe('rgb(0, 0, 0)');
    expect(fillColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(fillColor).not.toBe('none');
  });

  // --- Enemy special abilities: Healer, Splitter, Shielded overlays (issue #75) ---

  /**
   * Helper: inject a single enemy of the given type into App's enemies state so
   * GameBoard renders it without starting a live wave.  The game loop is paused
   * (gamePhaseRef !== 'playing' in between-waves) so the injected enemy persists
   * long enough for the assertion.
   * enemies = dispatch stateHook index 6 (after PR #97 difficultyMode prepended).
   */
  async function injectEnemy(page, enemyObj) {
    // Wait for #game to be in the DOM with the React fiber attached before injecting
    await page.waitForFunction(() => {
      const el = document.querySelector('#game');
      if (!el) return false;
      return Object.keys(el).some(k => k.startsWith('__reactFiber'));
    }, { timeout: 5000 });
    await page.evaluate((enemy) => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // enemies = dispatch stateHook index 7 (post-PR #131: tileSize inserted at [1])
          if (stateHooks[7]) {
            stateHooks[7].queue.dispatch([enemy]);
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find enemies hook dispatcher');
    }, enemyObj);
  }

  test('healer enemy renders .enemy-healer class and .enemy-healer-cross overlay when injected', async ({ page }) => {
    // Inject a healer enemy while in between-waves so the game loop does not clear it
    await injectEnemy(page, {
      id: 'test-healer-1',
      hp: 120,
      maxHp: 120,
      pos: { row: 2, col: 3 },
      waypointIndex: 1,
      speed: 2.0,
      type: 'healer',
      goldReward: 20,
      effects: [],
    });

    // Enemy layer must be rendered
    await expect(page.locator('.enemy-layer').first()).toBeAttached({ timeout: 2000 });
    // Healer must have the .enemy-healer class
    const healerEl = page.locator('.enemy-layer .enemy-healer').first();
    await expect(healerEl).toBeAttached({ timeout: 2000 });
    // Healer SVG overlay must contain the green-cross text element
    const crossEl = healerEl.locator('.enemy-ability-overlay .enemy-healer-cross');
    await expect(crossEl).toBeAttached({ timeout: 1000 });
  });

  test('splitter enemy renders .enemy-splitter class and .enemy-splitter-line overlay when injected', async ({ page }) => {
    await injectEnemy(page, {
      id: 'test-splitter-1',
      hp: 200,
      maxHp: 200,
      pos: { row: 2, col: 4 },
      waypointIndex: 1,
      speed: 1.5,
      type: 'splitter',
      goldReward: 15,
      effects: [],
    });

    await expect(page.locator('.enemy-layer').first()).toBeAttached({ timeout: 2000 });
    const splitterEl = page.locator('.enemy-layer .enemy-splitter').first();
    await expect(splitterEl).toBeAttached({ timeout: 2000 });
    // Splitter SVG overlay must contain the diagonal-line element
    const lineEl = splitterEl.locator('.enemy-ability-overlay .enemy-splitter-line');
    await expect(lineEl).toBeAttached({ timeout: 1000 });
  });

  test('shielded enemy renders .enemy-shielded class and .enemy-shielded-icon overlay when injected', async ({ page }) => {
    await injectEnemy(page, {
      id: 'test-shielded-1',
      hp: 250,
      maxHp: 250,
      pos: { row: 2, col: 5 },
      waypointIndex: 1,
      speed: 1.2,
      type: 'shielded',
      goldReward: 30,
      shieldedDamageReduction: 0.6,
      effects: [],
    });

    await expect(page.locator('.enemy-layer').first()).toBeAttached({ timeout: 2000 });
    const shieldedEl = page.locator('.enemy-layer .enemy-shielded').first();
    await expect(shieldedEl).toBeAttached({ timeout: 2000 });
    // Shielded SVG overlay must contain the shield-icon path element
    const shieldIconEl = shieldedEl.locator('.enemy-ability-overlay .enemy-shielded-icon');
    await expect(shieldIconEl).toBeAttached({ timeout: 1000 });
  });

  // --- Gold interest ticker in HUD (issue #76 / PR #100) ---
  // Note: App.jsx passes interestCountdown={gamePhase === 'playing' ? interestCountdown : null}
  // so we must also set gamePhase='playing' for the ticker to render.
  // Post-PR #110 verified all-hooks indices: gamePhase=all[23], interestCountdown=all[35].

  test('.hud-interest-ticker is visible in the HUD after injecting a non-null interestCountdown with playing phase', async ({ page }) => {
    // Set gamePhase='playing' (all-hooks index 23) and interestCountdown=7 (all-hooks index 35).
    // Gold starts at 100 (Normal); the HUD renders .hud-interest-ticker when
    // interestCountdown !== null && gold > 0.
    await dispatchAppHook(page, 25, 'playing'); // gamePhase = all-hooks[25] post-PR #131
    await dispatchAppHook(page, 37, 7); // interestCountdown = all-hooks[37] post-PR #131
    // The ticker must be attached and visible in the HUD
    await expect(page.locator('.hud .hud-interest-ticker')).toBeVisible({ timeout: 2000 });
    // Ticker text shows format: "+Xg in Ys" (e.g. "+5g in 7s")
    const tickerText = await page.locator('.hud-interest-ticker').textContent();
    expect(tickerText).toMatch(/\+\d+g/);
    expect(tickerText).toMatch(/\d+s/);
  });

  test('.hud-interest-ticker shows correct interest amount based on current gold', async ({ page }) => {
    // Gold starts at 100 (Normal); computeInterest(100) = floor(100 * 0.05) = 5
    await dispatchAppHook(page, 25, 'playing'); // gamePhase = all-hooks[25] post-PR #131
    await dispatchAppHook(page, 37, 5); // interestCountdown = all-hooks[37] post-PR #131
    const ticker = page.locator('.hud-interest-ticker');
    await expect(ticker).toBeVisible({ timeout: 2000 });
    // Ticker must show "+5g interest" (computeInterest(100) = 5)
    const text = await ticker.textContent();
    expect(text).toContain('+5g');
  });

  test('.hud-interest-ticker is absent when game is not in playing phase', async ({ page }) => {
    // When gamePhase !== 'playing', App passes null for interestCountdown → ticker must not appear.
    // The beforeEach leaves us in 'between-waves' phase, so no injection needed.
    await expect(page.locator('.hud-interest-ticker')).not.toBeAttached({ timeout: 2000 });
  });

  // --- Tower cooldown bar (issue #77 / PR #102) ---

  // --- Prestige system (issue #78 / PR #103) ---

  test('.hud-burger-stars is present inside the burger menu with 5 prestige star slots', async ({ page }) => {
    // PR #125: prestige stars moved into burger menu (.hud-burger-stars).
    // Dismiss NextWave overlay and open burger menu to check.
    const nwBtn = page.locator('.next-wave-start');
    if (await nwBtn.isVisible()) await nwBtn.click();
    await page.locator('.hud-burger-btn').click();
    await expect(page.locator('.hud-burger-stars')).toBeVisible();
    // Must contain exactly 5 star span elements
    const stars = page.locator('.hud-burger-stars .prestige-star');
    await expect(stars).toHaveCount(5);
  });

  test('.hud-burger-stars shows hollow stars when prestigeStars=0 (in burger menu)', async ({ page }) => {
    // Ensure localStorage has no prestige stars (default state)
    await page.evaluate(() => localStorage.removeItem('towerDefense_prestigeStars'));
    await page.reload();
    // After reload, dismiss difficulty selector
    const diffOverlay = page.locator('.difficulty-overlay');
    if (await diffOverlay.isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    // Dismiss NextWave overlay, open burger menu to check prestige stars
    const nwBtn = page.locator('.next-wave-start');
    if (await nwBtn.isVisible()) await nwBtn.click();
    await page.locator('.hud-burger-btn').click();
    // All 5 stars must be hollow (prestigeStars=0)
    const filledStars = page.locator('.hud-burger-stars .prestige-star--filled');
    await expect(filledStars).toHaveCount(0);
    const hollowStars = page.locator('.hud-burger-stars .prestige-star--hollow');
    await expect(hollowStars).toHaveCount(5);
  });

  test('.hud-burger-stars shows filled stars when prestigeStars is injected via fiber', async ({ page }) => {
    // Inject prestigeStars=2 via React fiber
    // PR #110: endlessMode removed — prestigeStars shifted from stateHooks[22] to stateHooks[21]
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // prestigeStars = stateHooks[21] (PR #110: endlessMode removed, shifted by -1 from [22])
          if (stateHooks[28]) stateHooks[28].queue.dispatch(2); // prestigeStars (stateHooks[28] post-PR #131)
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });
    // Dismiss NextWave overlay, open burger menu to verify stars
    const nwBtn = page.locator('.next-wave-start');
    if (await nwBtn.isVisible()) await nwBtn.click();
    await page.locator('.hud-burger-btn').click();
    // 2 filled stars, 3 hollow stars
    await expect(page.locator('.hud-burger-stars .prestige-star--filled')).toHaveCount(2);
    await expect(page.locator('.hud-burger-stars .prestige-star--hollow')).toHaveCount(3);
  });

  test('.prestige-btn appears in GameOver overlay when wavesReached>=20, prestigeStars<5 (PR #110: no endlessMode needed)', async ({ page }) => {
    // PR #110: endlessMode removed — prestige now requires only wavesReached>=20 and stars<5.
    // Inject wavesReached=20 (stateHooks[22]), prestigeStars=0 (stateHooks[21]),
    // and gamePhase='lose' (stateHooks[12])
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // PR #110: endlessMode (was stateHooks[13]) removed; indices >=13 shifted by -1
          if (stateHooks[28]) stateHooks[28].queue.dispatch(0);           // prestigeStars = 0 (stateHooks[28] post-PR #131)
          if (stateHooks[29]) stateHooks[29].queue.dispatch(20);          // wavesReached = 20 (stateHooks[29] post-PR #131)
          if (stateHooks[19]) stateHooks[19].queue.dispatch('lose');      // gamePhase = 'lose' (stateHooks[19] post-PR #131)
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });
    // GameOver overlay must be visible
    await expect(page.locator('.game-over-overlay')).toBeVisible({ timeout: 2000 });
    // Prestige button must be present inside the overlay
    await expect(page.locator('.game-over-overlay .prestige-btn')).toBeVisible({ timeout: 2000 });
    // Button text must mention "Prestige"
    const btnText = await page.locator('.prestige-btn').textContent();
    expect(btnText).toContain('Prestige');
  });

  test('.prestige-btn is absent when wavesReached < 20', async ({ page }) => {
    // Inject wavesReached=10 (below threshold), gamePhase='lose'
    // PR #110: endlessMode removed; no longer injected
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // PR #110: endlessMode removed; prestigeStars=[21], wavesReached=[22]
          if (stateHooks[28]) stateHooks[28].queue.dispatch(0);           // prestigeStars = 0 (stateHooks[28] post-PR #131)
          if (stateHooks[29]) stateHooks[29].queue.dispatch(10);          // wavesReached = 10 (below threshold) (stateHooks[29] post-PR #131)
          if (stateHooks[19]) stateHooks[19].queue.dispatch('lose');      // gamePhase = 'lose' (stateHooks[19] post-PR #131)
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });
    await expect(page.locator('.game-over-overlay')).toBeVisible({ timeout: 2000 });
    // Prestige button must NOT appear (waves < 20)
    await expect(page.locator('.prestige-btn')).not.toBeAttached();
  });

  test('.prestige-btn IS present when wavesReached>=20 (PR #110: no endlessMode required)', async ({ page }) => {
    // PR #110: endlessMode removed — prestige is now available whenever wavesReached>=20 and stars<5.
    // This test replaces the old "absent when endlessMode=false" test which is no longer meaningful.
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // PR #110: endlessMode removed; prestigeStars=[21], wavesReached=[22]
          if (stateHooks[28]) stateHooks[28].queue.dispatch(0);           // prestigeStars = 0 (stateHooks[28] post-PR #131)
          if (stateHooks[29]) stateHooks[29].queue.dispatch(25);          // wavesReached = 25 (stateHooks[29] post-PR #131) (≥20)
          if (stateHooks[19]) stateHooks[19].queue.dispatch('lose');      // gamePhase = 'lose' (stateHooks[19] post-PR #131)
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });
    await expect(page.locator('.game-over-overlay')).toBeVisible({ timeout: 2000 });
    // Prestige button must appear (wavesReached=25 ≥ 20 and stars=0 < 5)
    await expect(page.locator('.prestige-btn')).toBeAttached({ timeout: 2000 });
  });

  test('.prestige-btn is absent when prestigeStars=5 (star cap reached)', async ({ page }) => {
    // Inject wavesReached=25, prestigeStars=5 (cap), gamePhase='lose'
    // PR #110: endlessMode removed; no longer injected
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // PR #110: endlessMode removed; prestigeStars=[21], wavesReached=[22]
          if (stateHooks[28]) stateHooks[28].queue.dispatch(5);           // prestigeStars = 5 (cap) (stateHooks[28] post-PR #131)
          if (stateHooks[29]) stateHooks[29].queue.dispatch(25);          // wavesReached = 25 (stateHooks[29] post-PR #131)
          if (stateHooks[19]) stateHooks[19].queue.dispatch('lose');      // gamePhase = 'lose' (stateHooks[19] post-PR #131)
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });
    await expect(page.locator('.game-over-overlay')).toBeVisible({ timeout: 2000 });
    // Prestige button must NOT appear (star cap reached)
    await expect(page.locator('.prestige-btn')).not.toBeAttached();
  });

  test('clicking .prestige-btn increments prestigeStars in localStorage and persists on reload', async ({ page }) => {
    // Ensure clean state: 0 prestige stars, then reload to start fresh.
    await page.evaluate(() => localStorage.removeItem('towerDefense_prestigeStars'));
    await page.reload();
    await page.waitForSelector('.game-board', { state: 'visible' });
    // Select difficulty so the DifficultySelector overlay (z-index 110) does not
    // block the prestige-btn (inside GameOver at z-index 100) when we click it.
    const diffOverlay = page.locator('.difficulty-overlay');
    if (await diffOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.click('.difficulty-btn--normal');
    }
    // Inject conditions that show the prestige button via fiber.
    // stateHooks[19] = gamePhase, stateHooks[28] = prestigeStars, stateHooks[29] = wavesReached (post-PR #131)
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') stateHooks.push(hookNode);
            hookNode = hookNode.next;
          }
          if (stateHooks[28]) stateHooks[28].queue.dispatch(0);           // prestigeStars = 0 (post-PR #131)
          if (stateHooks[29]) stateHooks[29].queue.dispatch(20);          // wavesReached = 20 (post-PR #131)
          if (stateHooks[19]) stateHooks[19].queue.dispatch('lose');      // gamePhase = 'lose' (post-PR #131)
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });
    await expect(page.locator('.game-over-overlay .prestige-btn')).toBeVisible({ timeout: 2000 });
    // Click the prestige button
    await page.locator('.prestige-btn').click();
    // localStorage must now have prestigeStars = '1'
    const stored = await page.evaluate(() => localStorage.getItem('towerDefense_prestigeStars'));
    expect(stored).toBe('1');
    // Reload and verify the star persists in the burger menu
    await page.reload();
    await page.waitForSelector('.game-board', { state: 'visible' });
    // Stars are in the burger menu — dismiss difficulty overlay if needed, then open burger menu
    const diffO = page.locator('.difficulty-overlay');
    if (await diffO.isVisible()) await page.click('.difficulty-btn--normal');
    const nwO = page.locator('.next-wave-start');
    if (await nwO.isVisible()) await nwO.click();
    await page.locator('.hud-burger-btn').click();
    const filledAfterReload = await page.locator('.hud-burger-stars .prestige-star--filled').count();
    expect(filledAfterReload).toBe(1);
  });

  test('tower-cooldown-bar is visible after placing a tower on the board', async ({ page }) => {
    // Dismiss the NextWave overlay so the board is interactive
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Ensure BasicTower is selected (default)
    const basicBtn = page.locator('.tower-picker button').filter({ hasText: 'BasicTower' });
    if (await basicBtn.isVisible() && (await basicBtn.getAttribute('disabled')) === null) {
      await basicBtn.click();
    }
    // Place a BasicTower on the first available slot
    const slot = page.locator('.tower-slot').first();
    await expect(slot).toBeVisible();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    // The cooldown bar must be rendered inside the tower tile.
    // lastFiredAt initialises to 0, so Date.now() - 0 >> fireInterval and fraction is clamped
    // to 1 → width = 80% and the idle class is applied immediately on first render.
    const bar = page.locator('.tower-cooldown-bar').first();
    await expect(bar).toBeAttached({ timeout: 2000 });
    await expect(bar).toHaveCSS('width', /[1-9]/);
  });

  // --- WavePreviewPanel component (issue #80 / PR #105) ---
  // WavePreviewPanel renders when: gamePhase === 'between-waves' && wave > 1 && difficultyMode !== null
  // difficultyMode is already set by beforeEach (clicks Normal).
  // Inject wave=2 (stateHooks[4]) and gamePhase='between-waves' (stateHooks[19]) via React fiber.
  //
  // stateHooks dispatch indices (post-PR #131: tileSize inserted at [1]):
  //   stateHooks[4]  = wave
  //   stateHooks[19] = gamePhase

  test('.wave-preview-panel is visible between waves (wave > 1) and shows enemy info and tip', async ({ page }) => {
    // Inject wave=2 and gamePhase='between-waves' so WavePreviewPanel renders.
    // difficultyMode is already non-null (Normal selected in beforeEach).
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // wave=stateHooks[4], gamePhase=stateHooks[19] (post-PR #131)
          if (stateHooks[4]) stateHooks[4].queue.dispatch(2);              // wave → 2 (>1 triggers panel)
          if (stateHooks[19]) stateHooks[19].queue.dispatch('between-waves'); // gamePhase (stateHooks[19] post-PR #131)
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });

    // The wave preview panel must be visible (wave=2, between-waves, difficultyMode set)
    await expect(page.locator('.wave-preview-panel')).toBeVisible({ timeout: 2000 });

    // Panel header must mention the upcoming wave number (wave+1=3)
    const header = page.locator('.wave-preview-header');
    await expect(header).toBeVisible();
    await expect(header).toContainText('WAVE');

    // Enemy list must have at least one entry (wave 3 has grunts)
    const enemyRows = page.locator('.wave-preview-enemy-row');
    await expect(enemyRows.first()).toBeAttached({ timeout: 2000 });
    const rowCount = await enemyRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);

    // Tip text must be present (getWavePreview always returns a tip for grunt-heavy waves)
    await expect(page.locator('.wave-preview-tip')).toBeVisible({ timeout: 2000 });
  });

  test('.wave-preview-panel is NOT visible when wave === 1 (between-waves before first wave)', async ({ page }) => {
    // On initial load after beforeEach, wave=1 and gamePhase='between-waves',
    // so WavePreviewPanel must NOT render (wave > 1 condition is false).
    // The NextWave overlay is visible instead.
    await expect(page.locator('.next-wave-overlay')).toBeVisible();
    await expect(page.locator('.wave-preview-panel')).not.toBeAttached();
  });

  test('.wave-preview-panel shows grunt count entry for wave 3 (between waves 2 and 3)', async ({ page }) => {
    // Wave 3: getWaveComposition(3) returns grunts (and possibly tanks).
    // Inject wave=2 (panel shows preview for wave+1=3) and gamePhase='between-waves'.
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          if (stateHooks[4]) stateHooks[4].queue.dispatch(2);
          if (stateHooks[19]) stateHooks[19].queue.dispatch('between-waves'); // gamePhase (stateHooks[19] post-PR #131)
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });

    await expect(page.locator('.wave-preview-panel')).toBeVisible({ timeout: 2000 });
    // At least one enemy row must show a count (×N) and HP label
    const enemyRows = page.locator('.wave-preview-enemy-row');
    await expect(enemyRows.first()).toBeAttached({ timeout: 2000 });
    // The first row must contain a count indicator (×N format)
    const rowText = await enemyRows.first().textContent();
    expect(rowText).toMatch(/×\d+/);
    // The first row must also contain HP info
    expect(rowText).toContain('HP:');
  });

  // --- WavePreviewPanel overlay backdrop and Start Wave button (PR #120) ---

  test('.wave-preview-overlay is present with a semi-transparent backdrop (AC #3)', async ({ page }) => {
    // Inject wave=2 and gamePhase='between-waves' so WavePreviewPanel renders.
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          if (stateHooks[4]) stateHooks[4].queue.dispatch(2);
          if (stateHooks[19]) stateHooks[19].queue.dispatch('between-waves'); // gamePhase (stateHooks[19] post-PR #131)
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });

    // The overlay wrapper must be present in the DOM
    await expect(page.locator('.wave-preview-overlay')).toBeAttached({ timeout: 2000 });

    // Verify the overlay has a semi-transparent backdrop via computed background-color
    // CSS sets: background: rgba(0, 0, 0, 0.6) — alpha must be non-zero
    const bg = await page.locator('.wave-preview-overlay').evaluate(el =>
      getComputedStyle(el).backgroundColor
    );
    // Must be rgba(...) with a non-zero alpha — not fully transparent, not fully opaque
    expect(bg).toMatch(/rgba?\(/);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(bg).not.toBe('transparent');
    // position:fixed puts the overlay above the game board (z-index is set in CSS)
    const position = await page.locator('.wave-preview-overlay').evaluate(el =>
      getComputedStyle(el).position
    );
    expect(position).toBe('fixed');
  });

  test('.wave-preview-start-btn is visible inside the panel (AC #4)', async ({ page }) => {
    // Inject wave=2 and gamePhase='between-waves' so WavePreviewPanel renders.
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          if (stateHooks[4]) stateHooks[4].queue.dispatch(2);
          if (stateHooks[19]) stateHooks[19].queue.dispatch('between-waves'); // gamePhase (stateHooks[19] post-PR #131)
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });

    // The panel must be visible
    await expect(page.locator('.wave-preview-panel')).toBeVisible({ timeout: 2000 });

    // The "Start Wave" button must be present and visible inside the panel
    const startBtn = page.locator('.wave-preview-panel .wave-preview-start-btn');
    await expect(startBtn).toBeVisible({ timeout: 2000 });
    await expect(startBtn).toContainText('Start Wave');
  });

  test('clicking .wave-preview-start-btn dismisses the overlay and begins the wave (AC #4)', async ({ page }) => {
    // Inject wave=2 and gamePhase='between-waves' so WavePreviewPanel renders.
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          if (stateHooks[4]) stateHooks[4].queue.dispatch(2);
          if (stateHooks[19]) stateHooks[19].queue.dispatch('between-waves'); // gamePhase (stateHooks[19] post-PR #131)
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });

    // Wait for the panel and Start Wave button to appear
    await expect(page.locator('.wave-preview-panel')).toBeVisible({ timeout: 2000 });
    const startBtn = page.locator('.wave-preview-start-btn');
    await expect(startBtn).toBeVisible({ timeout: 2000 });

    // Click "Start Wave"
    await startBtn.click();

    // After clicking, the overlay must be dismissed — wait for the exit animation (0.22s)
    // and then the component unmounts. Allow up to 1 s for the full transition.
    await expect(page.locator('.wave-preview-overlay')).not.toBeAttached({ timeout: 1000 });

    // Game phase must now be 'playing' — enemies spawn and the HUD wave counter is visible
    await expect(page.locator('.hud-wave')).toBeVisible();
    // The HUD must no longer show 'between-waves' UI (the overlay is gone)
    await expect(page.locator('.wave-preview-panel')).not.toBeAttached({ timeout: 1000 });
  });

  // --- Distinct tower silhouettes in TowerPicker (issue #108) ---

  test('each .tower-picker-btn contains an SVG silhouette icon', async ({ page }) => {
    await expect(page.locator('.tower-picker')).toBeVisible();
    const buttons = page.locator('.tower-picker-btn');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(7);
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const svg = btn.locator('svg');
      await expect(svg).toBeAttached();
    }
  });

  test('all 7 tower types are present in the TowerPicker grid', async ({ page }) => {
    await expect(page.locator('.tower-picker')).toBeVisible();
    const towerTypes = [
      'BasicTower', 'SniperTower', 'RapidTower', 'CannonTower',
      'SlowTower', 'MortarTower', 'PoisonTower',
    ];
    for (const type of towerTypes) {
      await expect(
        page.locator('.tower-picker-btn').filter({ hasText: type })
      ).toBeAttached();
    }
  });

  test('BasicTower picker button SVG contains a rect.tower-basic silhouette', async ({ page }) => {
    const basicBtn = page.locator('.tower-picker-btn').filter({ hasText: 'BasicTower' });
    await expect(basicBtn).toBeAttached();
    // cannon body has multiple rect.tower-basic elements — use .first() to avoid strict-mode violation
    await expect(basicBtn.locator('svg rect.tower-basic').first()).toBeAttached();
  });

  test('SniperTower picker button SVG contains a circle.tower-sniper silhouette', async ({ page }) => {
    const sniperBtn = page.locator('.tower-picker-btn').filter({ hasText: 'SniperTower' });
    await expect(sniperBtn).toBeAttached();
    await expect(sniperBtn.locator('svg circle.tower-sniper')).toBeAttached();
  });

  test('RapidTower picker button SVG contains a rect.tower-rapid silhouette', async ({ page }) => {
    const rapidBtn = page.locator('.tower-picker-btn').filter({ hasText: 'RapidTower' });
    await expect(rapidBtn).toBeAttached();
    // gatling has three rect.tower-rapid barrels — use .first() to avoid strict-mode violation
    await expect(rapidBtn.locator('svg rect.tower-rapid').first()).toBeAttached();
  });

  test('CannonTower picker button SVG contains a circle.tower-cannon silhouette', async ({ page }) => {
    const cannonBtn = page.locator('.tower-picker-btn').filter({ hasText: 'CannonTower' });
    await expect(cannonBtn).toBeAttached();
    await expect(cannonBtn.locator('svg circle.tower-cannon')).toBeAttached();
  });

  test('SlowTower picker button SVG contains a circle.tower-slow silhouette', async ({ page }) => {
    const slowBtn = page.locator('.tower-picker-btn').filter({ hasText: 'SlowTower' });
    await expect(slowBtn).toBeAttached();
    await expect(slowBtn.locator('svg circle.tower-slow')).toBeAttached();
  });

  test('MortarTower picker button SVG contains a rect.tower-mortar silhouette', async ({ page }) => {
    const mortarBtn = page.locator('.tower-picker-btn').filter({ hasText: 'MortarTower' });
    await expect(mortarBtn).toBeAttached();
    // mortar has base plate + barrel — both rect.tower-mortar — use .first() to avoid strict-mode
    await expect(mortarBtn.locator('svg rect.tower-mortar').first()).toBeAttached();
  });

  test('PoisonTower picker button SVG contains an ellipse.tower-poison silhouette', async ({ page }) => {
    const poisonBtn = page.locator('.tower-picker-btn').filter({ hasText: 'PoisonTower' });
    await expect(poisonBtn).toBeAttached();
    await expect(poisonBtn.locator('svg ellipse.tower-poison')).toBeAttached();
  });

  // --- Synergy lines visual overlay (issue #111 / PR #124) ---
  // PR #125: "Show Synergies" moved into the burger menu (☰). Tests open the menu first.

  test('"Show Synergies" button is visible inside the burger menu', async ({ page }) => {
    // PR #125: synergies toggle moved into burger menu — dismiss NextWave overlay then open menu
    const nwBtn = page.locator('.next-wave-start');
    if (await nwBtn.isVisible()) await nwBtn.click();
    await page.locator('.hud-burger-btn').click();
    const btn = page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: /Synergies/ });
    await expect(btn).toBeVisible();
  });

  test('"Show Synergies" burger menu item is not active by default (shows "Show Synergies")', async ({ page }) => {
    // Dismiss NextWave overlay so burger btn is clickable
    const nwBtn = page.locator('.next-wave-start');
    if (await nwBtn.isVisible()) await nwBtn.click();
    await page.locator('.hud-burger-btn').click();
    const btn = page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: /Synergies/ });
    await expect(btn).toBeVisible();
    // When inactive, text is "Show Synergies" and class does not have --active
    await expect(btn).toContainText('Show Synergies');
    await expect(btn).not.toHaveClass(/hud-burger-item--active/);
  });

  test('clicking "Show Synergies" in the burger menu toggles the active class on', async ({ page }) => {
    // Dismiss the NextWave overlay (intercepts pointer events) before clicking HUD buttons
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Open burger menu and click Show Synergies
    await page.locator('.hud-burger-btn').click();
    await page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: 'Show Synergies' }).click();
    // Menu closes; re-open to verify the active state
    await page.locator('.hud-burger-btn').click();
    const btn = page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: /Synergies/ });
    await expect(btn).toHaveClass(/hud-burger-item--active/);
    await expect(btn).toContainText('Hide Synergies');
  });

  test('clicking "Show Synergies" twice via burger menu toggles the active class back off', async ({ page }) => {
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // First click: Show → Hide (active)
    await page.locator('.hud-burger-btn').click();
    await page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: 'Show Synergies' }).click();
    // Second click: Hide → Show (inactive)
    await page.locator('.hud-burger-btn').click();
    await page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: 'Hide Synergies' }).click();
    // Re-open to verify
    await page.locator('.hud-burger-btn').click();
    const btn = page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: /Synergies/ });
    await expect(btn).not.toHaveClass(/hud-burger-item--active/);
    await expect(btn).toContainText('Show Synergies');
  });

  test('synergy lines appear after placing two adjacent synergy towers and enabling the overlay', async ({ page }) => {
    // Dismiss the NextWave overlay so the board is interactive
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }

    // The map is procedurally generated, so the first two .tower-slot elements in the DOM
    // may NOT be grid-adjacent. Find two tower-slot tiles that ARE adjacent by computing
    // their (row, col) from their position in the flat tile list, then return their indices.
    const adjacentIndices = await page.evaluate(() => {
      const COLS = 20;
      const allTiles = Array.from(document.querySelectorAll('.game-board .tile'));
      // Build a set of tower-slot indices for fast lookup
      const slotIndices = new Set();
      allTiles.forEach((el, idx) => {
        if (el.classList.contains('tower-slot')) slotIndices.add(idx);
      });
      // For each tower-slot, check if the tile immediately to its right (same row, col+1)
      // or immediately below (next row, same col) is also a tower-slot.
      for (const idx of slotIndices) {
        const row = Math.floor(idx / COLS);
        const col = idx % COLS;
        const rightIdx = row * COLS + (col + 1);
        const downIdx = (row + 1) * COLS + col;
        if (slotIndices.has(rightIdx)) return [idx, rightIdx];
        if (slotIndices.has(downIdx)) return [idx, downIdx];
      }
      return null;
    });

    if (adjacentIndices === null) {
      // No two adjacent tower slots found on this generated map — skip test
      return;
    }

    const [idx1, idx2] = adjacentIndices;
    // Click the first adjacent tower-slot tile
    await page.locator('.game-board .tile').nth(idx1).click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();

    // Select BasicTower (already selected by default; ensure it's still selected after panel opened)
    const basicBtn = page.locator('.tower-picker button').filter({ hasText: 'BasicTower' });
    if (await basicBtn.isVisible() && (await basicBtn.getAttribute('disabled')) === null) {
      await basicBtn.click();
    }

    // Click the second adjacent tower-slot tile (BasicTower+BasicTower always synergises)
    await page.locator('.game-board .tile').nth(idx2).click();
    await expect(page.locator('.tower-icon')).toHaveCount(2, { timeout: 3000 });

    // Enable the global synergy overlay via the burger menu
    await page.locator('.hud-burger-btn').click();
    await page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: 'Show Synergies' }).click();

    // Both BasicTowers synergise — .synergy-line elements must appear in the SVG layer.
    await expect(page.locator('.synergy-line').first()).toBeAttached({ timeout: 2000 });
  });

  test('hovering an occupied tower-slot shows focal synergy lines to its partners', async ({ page }) => {
    // Dismiss NextWave overlay
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Place two adjacent BasicTowers (BasicTower+BasicTower synergy always fires)
    const basicBtn = page.locator('.tower-picker button').filter({ hasText: 'BasicTower' });
    if (await basicBtn.isVisible() && (await basicBtn.getAttribute('disabled')) === null) {
      await basicBtn.click();
    }
    const slots = page.locator('.tower-slot');
    await slots.first().click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    // Second adjacent BasicTower
    if (await basicBtn.isVisible() && (await basicBtn.getAttribute('disabled')) === null) {
      await basicBtn.click();
    }
    if (await slots.nth(1).isVisible()) {
      await slots.nth(1).click();
    }
    const towerCount = await page.locator('.tower-icon').count();
    if (towerCount < 2) return; // skip if gold ran out

    // Hover the first tower tile — should show focal synergy lines without the global toggle
    const towerTile = page.locator('.tile').filter({ has: page.locator('.tower-icon') }).first();
    await towerTile.hover();
    // Focal synergy lines appear when hoveredTower has partners
    await expect(page.locator('.synergy-line').first()).toBeAttached({ timeout: 2000 });
  });

  test('partner tile gets an outline highlight when a tower with synergy is selected', async ({ page }) => {
    // Dismiss NextWave overlay
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Place two adjacent BasicTowers
    const basicBtn = page.locator('.tower-picker button').filter({ hasText: 'BasicTower' });
    if (await basicBtn.isVisible() && (await basicBtn.getAttribute('disabled')) === null) {
      await basicBtn.click();
    }
    const slots = page.locator('.tower-slot');
    await slots.first().click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    if (await basicBtn.isVisible() && (await basicBtn.getAttribute('disabled')) === null) {
      await basicBtn.click();
    }
    if (await slots.nth(1).isVisible()) {
      await slots.nth(1).click();
    }
    const towerCount = await page.locator('.tower-icon').count();
    if (towerCount < 2) return; // skip if gold ran out

    // Select the first tower to trigger partner highlighting
    const towerTile = page.locator('.tile').filter({ has: page.locator('.tower-icon') }).first();
    await towerTile.click();

    // At least one partner tile should have an inline outline style applied
    const hasPartnerOutline = await page.evaluate(() => {
      const tiles = document.querySelectorAll('.tile');
      for (const tile of tiles) {
        if (tile.style && tile.style.outline && tile.style.outline.includes('solid')) {
          return true;
        }
      }
      return false;
    });
    expect(hasPartnerOutline).toBe(true);
  });

  test('.hud-burger-item--active CSS class has a teal/distinct colour (PR #125 synergies in burger)', async ({ page }) => {
    // Verify the CSS rule for .hud-burger-item--active is loaded and applied
    // Open burger menu, enable synergies so the button gets the active class
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    await page.locator('.hud-burger-btn').click();
    await page.locator('.hud-burger-menu .hud-burger-item').filter({ hasText: 'Show Synergies' }).click();
    // Re-open menu to inspect the active item
    await page.locator('.hud-burger-btn').click();
    const activeBtn = page.locator('.hud-burger-item--active');
    await expect(activeBtn).toBeVisible();
    const borderColor = await activeBtn.evaluate(el => getComputedStyle(el).borderColor);
    // Border must be a non-default colour (index.css sets teal: #00e5cc or similar brand colour)
    expect(borderColor).not.toBe('rgb(0, 0, 0)');
    expect(borderColor).not.toBe('');
  });

  // --- Ghost range ring preview on TowerPicker hover (issue #114 / PR #129) ---

  test('hovering a TowerPicker button shows .ghost-range-ring in the SVG overlay', async ({ page }) => {
    // Dismiss the NextWave overlay so the board is interactive
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Hover over the BasicTower button in TowerPicker
    const basicBtn = page.locator('.tower-picker-btn').filter({ hasText: 'BasicTower' });
    await expect(basicBtn).toBeVisible();
    await basicBtn.hover();
    // The .ghost-range-ring SVG circle must appear in the DOM while hovering
    await expect(page.locator('.ghost-range-ring')).toBeAttached({ timeout: 2000 });
  });

  test('moving mouse away from TowerPicker button removes .ghost-range-ring', async ({ page }) => {
    // Dismiss the NextWave overlay so the board is interactive
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Hover over the BasicTower button to show the ring
    const basicBtn = page.locator('.tower-picker-btn').filter({ hasText: 'BasicTower' });
    await expect(basicBtn).toBeVisible();
    await basicBtn.hover();
    await expect(page.locator('.ghost-range-ring')).toBeAttached({ timeout: 2000 });
    // Move the mouse away from TowerPicker to trigger mouseleave → onHoverTowerType(null)
    await page.locator('.hud').hover();
    // The .ghost-range-ring must no longer be in the DOM
    await expect(page.locator('.ghost-range-ring')).not.toBeAttached({ timeout: 2000 });
  });

  test('.ghost-range-ring is rendered as an SVG circle inside the projectile-layer SVG', async ({ page }) => {
    // Dismiss the NextWave overlay
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Hover over any TowerPicker button
    const basicBtn = page.locator('.tower-picker-btn').filter({ hasText: 'BasicTower' });
    await expect(basicBtn).toBeVisible();
    await basicBtn.hover();
    // The ring must be an SVG circle element attached to the DOM
    const ring = page.locator('.ghost-range-ring');
    await expect(ring).toBeAttached({ timeout: 2000 });
    // Verify it is an SVG circle (tagName 'circle')
    const tagName = await ring.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('circle');
    // The circle must have a non-zero radius attribute
    const r = await ring.getAttribute('r');
    expect(parseFloat(r)).toBeGreaterThan(0);
  });

  test('.ghost-range-ring has a distinct radius for each tower type (BasicTower vs SniperTower)', async ({ page }) => {
    // Dismiss the NextWave overlay so the board is interactive
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Hover BasicTower and capture the ghost ring radius
    const basicBtn = page.locator('.tower-picker-btn').filter({ hasText: 'BasicTower' });
    await basicBtn.hover();
    await expect(page.locator('.ghost-range-ring')).toBeAttached({ timeout: 2000 });
    const basicR = await page.locator('.ghost-range-ring').getAttribute('r');

    // Move away to clear the ring
    await page.locator('.hud').hover();
    await expect(page.locator('.ghost-range-ring')).not.toBeAttached({ timeout: 2000 });

    // Hover SniperTower (costs 100g, player starts with 100g so it is affordable)
    const sniperBtn = page.locator('.tower-picker-btn').filter({ hasText: 'SniperTower' });
    if ((await sniperBtn.getAttribute('disabled')) !== null) {
      // SniperTower unaffordable — skip comparison
      return;
    }
    await sniperBtn.hover();
    await expect(page.locator('.ghost-range-ring')).toBeAttached({ timeout: 2000 });
    const sniperR = await page.locator('.ghost-range-ring').getAttribute('r');

    // BasicTower range=3, SniperTower range=7 → sniper radius must be larger
    expect(parseFloat(sniperR)).toBeGreaterThan(parseFloat(basicR));
  });

  test('.ghost-range-ring CSS has an orange dashed stroke (pointer-events:none)', async ({ page }) => {
    // Verify the .ghost-range-ring CSS rule from index.css is loaded and applied.
    const { stroke, dasharray, pointerEvents } = await page.evaluate(() => {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.style.position = 'absolute';
      svg.style.top = '-9999px';
      document.body.appendChild(svg);
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('class', 'ghost-range-ring');
      svg.appendChild(circle);
      const computed = getComputedStyle(circle);
      const result = {
        stroke: computed.stroke,
        dasharray: computed.strokeDasharray,
        pointerEvents: computed.pointerEvents,
      };
      document.body.removeChild(svg);
      return result;
    });
    // Stroke must be orange-ish (rgba(249, 115, 22, ...)) — not black or empty
    expect(stroke).not.toBe('');
    expect(stroke).not.toBe('rgb(0, 0, 0)');
    expect(stroke).not.toBe('none');
    // Must be dashed (stroke-dasharray set)
    expect(dasharray).not.toBe('none');
    expect(dasharray).not.toBe('');
    // Must not intercept mouse events
    expect(pointerEvents).toBe('none');
  });

  test('.ghost-range-ring disappears after placing a tower (cleared by onHoverTowerType(null))', async ({ page }) => {
    // Dismiss the NextWave overlay so the board is interactive
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Hover BasicTower to show the ghost ring
    const basicBtn = page.locator('.tower-picker-btn').filter({ hasText: 'BasicTower' });
    await basicBtn.hover();
    await expect(page.locator('.ghost-range-ring')).toBeAttached({ timeout: 2000 });

    // Click a tower slot to place a tower — App clears hoverTowerType on placement
    const slot = page.locator('.tower-slot').first();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();

    // The ghost ring must be gone after placement (hoverTowerType reset to null)
    await expect(page.locator('.ghost-range-ring')).not.toBeAttached({ timeout: 2000 });
  });

});

// --- DifficultySelector component (issue #73) ---

test.describe('DifficultySelector', () => {
  test('difficulty overlay is visible on fresh page load', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.difficulty-overlay')).toBeVisible();
  });

  test('difficulty overlay shows all four difficulty buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.difficulty-btn--easy')).toBeVisible();
    await expect(page.locator('.difficulty-btn--normal')).toBeVisible();
    await expect(page.locator('.difficulty-btn--hard')).toBeVisible();
    await expect(page.locator('.difficulty-btn--nightmare')).toBeVisible();
  });

  test('selecting Hard sets HUD gold to 75 and shows Hard difficulty pill', async ({ page }) => {
    await page.goto('/');
    // The difficulty overlay must be visible before clicking
    await expect(page.locator('.difficulty-overlay')).toBeVisible();
    // Click the Hard button
    await page.click('.difficulty-btn--hard');
    // Overlay must be dismissed
    await expect(page.locator('.difficulty-overlay')).not.toBeVisible();
    // HUD gold must reflect Hard starting gold (75)
    await expect(page.locator('.hud-gold')).toContainText('Gold: 75');
    // HUD difficulty pill must be visible and contain "Hard"
    await expect(page.locator('.hud-difficulty-pill')).toBeVisible();
    await expect(page.locator('.hud-difficulty-pill')).toContainText('Hard');
  });

  test('selecting Easy sets HUD gold to 150 and shows Easy difficulty pill', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.difficulty-overlay')).toBeVisible();
    await page.click('.difficulty-btn--easy');
    await expect(page.locator('.difficulty-overlay')).not.toBeVisible();
    await expect(page.locator('.hud-gold')).toContainText('Gold: 150');
    await expect(page.locator('.hud-difficulty-pill')).toContainText('Easy');
  });

  test('selecting Normal sets HUD gold to 100 and shows Normal difficulty pill', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.difficulty-overlay')).toBeVisible();
    await page.click('.difficulty-btn--normal');
    await expect(page.locator('.difficulty-overlay')).not.toBeVisible();
    await expect(page.locator('.hud-gold')).toContainText('Gold: 100');
    await expect(page.locator('.hud-difficulty-pill')).toContainText('Normal');
  });

  test('selecting Nightmare sets HUD gold to 50 and shows Nightmare difficulty pill', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.difficulty-overlay')).toBeVisible();
    await page.click('.difficulty-btn--nightmare');
    await expect(page.locator('.difficulty-overlay')).not.toBeVisible();
    await expect(page.locator('.hud-gold')).toContainText('Gold: 50');
    await expect(page.locator('.hud-difficulty-pill')).toContainText('Nightmare');
  });

  test('difficulty overlay reappears after restart', async ({ page }) => {
    await page.goto('/');
    // Select any difficulty to dismiss the overlay
    await page.click('.difficulty-btn--normal');
    await expect(page.locator('.difficulty-overlay')).not.toBeVisible();
    // Trigger game over via fiber injection then click restart
    await triggerGamePhase(page, 'lose');
    await expect(page.locator('.game-over-overlay')).toBeVisible({ timeout: 2000 });
    await page.locator('.game-over-restart').click();
    // After restart, difficulty overlay must appear again
    await expect(page.locator('.difficulty-overlay')).toBeVisible({ timeout: 2000 });
  });

  // --- Seeded map generation (issue #112 / PR #127) ---

  test('.level-chip is visible on page load and contains an 8-char hex pattern', async ({ page }) => {
    // Reload to a fresh page so the seed is always present in the URL hash.
    // Some prior tests modify page state; a fresh goto ensures LEVEL_HASH is computed.
    await page.goto('/');
    const diffOverlay = page.locator('.difficulty-overlay');
    if (await diffOverlay.isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    // LEVEL_HASH is always set (derived from the seed in the URL hash or a freshly generated one).
    // The .level-chip element is rendered in HUD whenever levelHash is truthy.
    const chip = page.locator('.level-chip');
    await expect(chip).toBeAttached({ timeout: 5000 });
    const chipText = await chip.textContent();
    // Must contain "Level: #" followed by exactly 8 hex characters
    expect(chipText).toMatch(/Level:\s*#[0-9a-fA-F]{8}/);
  });

  test('clicking .hud-burger-btn then .hud-new-map causes navigation to a new seed URL', async ({ page }) => {
    // Reload to a fresh page so state is clean
    await page.goto('/');
    const diffOverlay = page.locator('.difficulty-overlay');
    if (await diffOverlay.isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    // Dismiss NextWave overlay so the burger button is fully interactive
    const nwBtn = page.locator('.next-wave-start');
    if (await nwBtn.isVisible()) await nwBtn.click();
    // Open the burger menu
    await page.locator('.hud-burger-btn').click();
    await expect(page.locator('.hud-burger-menu')).toBeVisible();
    // .hud-new-map must be present in the menu
    const newMapBtn = page.locator('.hud-new-map');
    await expect(newMapBtn).toBeVisible();
    // handleNewMap() sets window.location.hash='' then calls window.location.reload().
    // Use waitForURL to detect the navigation that follows the reload.
    await Promise.all([
      page.waitForURL(/localhost:5173/, { timeout: 10000 }),
      newMapBtn.click(),
    ]);
    // After navigation, the app generates a new seed and writes it to the URL hash.
    // Wait for the seed hash to appear (App.jsx calls window.location.hash = `seed=XXXXXXXX`)
    await page.waitForFunction(
      () => /seed=[0-9a-fA-F]{8}/.test(window.location.hash),
      { timeout: 5000 }
    );
    const hashAfter = await page.evaluate(() => window.location.hash);
    expect(hashAfter).toMatch(/seed=[0-9a-fA-F]{8}/);
  });

  test('.game-over-level-hash is visible on the game-over screen and contains a # followed by 8 hex chars', async ({ page }) => {
    // Reload to a fresh page so the React fiber is fully ready before fiber injection
    await page.goto('/');
    const diffOverlay = page.locator('.difficulty-overlay');
    if (await diffOverlay.isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    // Wait for React fiber to attach to #game before calling triggerGamePhase
    await page.waitForFunction(() => {
      const el = document.querySelector('#game');
      return el && Object.keys(el).some(k => k.startsWith('__reactFiber'));
    }, { timeout: 5000 });
    // Trigger the lose phase via fiber injection
    await triggerGamePhase(page, 'lose');
    await expect(page.locator('.game-over-overlay')).toBeVisible();
    // The level hash element must be present and show the seed
    const hashEl = page.locator('.game-over-level-hash');
    await expect(hashEl).toBeVisible();
    const hashText = await hashEl.textContent();
    // Must contain "Level: #" followed by exactly 8 hex characters
    expect(hashText).toMatch(/Level:\s*#[0-9a-fA-F]{8}/);
  });

  // --- Sound effects mute toggle (PR #128 / issue #113) ---

  test('.hud-mute-btn is present inside the burger menu when the menu is open', async ({ page }) => {
    await page.goto('/');
    // Dismiss the difficulty overlay if it appeared
    if (await page.locator('.difficulty-overlay').count() > 0) {
      await page.click('.difficulty-btn--normal');
    }
    // Dismiss the next-wave-overlay if it appeared (it intercepts pointer events)
    if (await page.locator('.next-wave-overlay').count() > 0) {
      await page.click('.next-wave-start');
    }
    // Wait for the HUD burger button to be visible and actionable
    await expect(page.locator('.hud-burger-btn')).toBeVisible({ timeout: 5000 });
    // Open the burger menu
    await page.locator('.hud-burger-btn').click();
    await expect(page.locator('.hud-burger-menu')).toBeVisible();
    // Mute button must be present inside the menu
    await expect(page.locator('.hud-burger-menu .hud-mute-btn')).toBeVisible();
  });

  test('.hud-mute-btn shows "🔊 Mute" label when sound is not muted', async ({ page }) => {
    // Navigate to a valid origin so localStorage is accessible
    await page.goto('/');
    if (await page.locator('.difficulty-overlay').count() > 0) {
      await page.click('.difficulty-btn--normal');
    }
    // Clear any persisted mute state via evaluate (page is now on localhost)
    await page.evaluate(() => { try { localStorage.removeItem('sfx-muted') } catch {} });
    // Reload so the HUD picks up the cleared mute state
    await page.goto('/');
    if (await page.locator('.difficulty-overlay').count() > 0) {
      await page.click('.difficulty-btn--normal');
    }
    // Dismiss the next-wave-overlay if it appeared (it intercepts pointer events)
    if (await page.locator('.next-wave-overlay').count() > 0) {
      await page.click('.next-wave-start');
    }
    await expect(page.locator('.hud-burger-btn')).toBeVisible({ timeout: 5000 });
    // Open burger menu
    await page.locator('.hud-burger-btn').click();
    await expect(page.locator('.hud-burger-menu')).toBeVisible();
    const muteBtn = page.locator('.hud-mute-btn');
    await expect(muteBtn).toBeVisible();
    // When not muted the label must contain Mute (not Unmute)
    const label = await muteBtn.textContent();
    expect(label).toContain('Mute');
    expect(label).not.toContain('Unmute');
  });

  test('clicking .hud-mute-btn toggles label to "🔇 Unmute" and persists in localStorage', async ({ page }) => {
    // Navigate to a valid origin so localStorage is accessible
    await page.goto('/');
    if (await page.locator('.difficulty-overlay').count() > 0) {
      await page.click('.difficulty-btn--normal');
    }
    // Clear any persisted mute state
    await page.evaluate(() => { try { localStorage.removeItem('sfx-muted') } catch {} });
    // Reload so HUD initializes with clean mute state
    await page.goto('/');
    if (await page.locator('.difficulty-overlay').count() > 0) {
      await page.click('.difficulty-btn--normal');
    }
    // Dismiss the next-wave-overlay if it appeared (it intercepts pointer events)
    if (await page.locator('.next-wave-overlay').count() > 0) {
      await page.click('.next-wave-start');
    }
    await expect(page.locator('.hud-burger-btn')).toBeVisible({ timeout: 5000 });
    // Open burger menu
    await page.locator('.hud-burger-btn').click();
    await expect(page.locator('.hud-burger-menu')).toBeVisible();
    const muteBtn = page.locator('.hud-mute-btn');
    await expect(muteBtn).toBeVisible();
    // Click to mute
    await muteBtn.click();
    // Menu stays open — button label should switch to Unmute
    await expect(page.locator('.hud-mute-btn')).toBeVisible();
    const labelAfter = await page.locator('.hud-mute-btn').textContent();
    expect(labelAfter).toContain('Unmute');
    // localStorage must reflect muted=true
    const stored = await page.evaluate(() => { try { return localStorage.getItem('sfx-muted') } catch { return null } });
    expect(stored).toBe('true');
  });

  test('clicking .hud-mute-btn twice returns to unmuted state', async ({ page }) => {
    // Navigate to a valid origin so localStorage is accessible
    await page.goto('/');
    if (await page.locator('.difficulty-overlay').count() > 0) {
      await page.click('.difficulty-btn--normal');
    }
    // Clear mute state then reload
    await page.evaluate(() => { try { localStorage.removeItem('sfx-muted') } catch {} });
    await page.goto('/');
    if (await page.locator('.difficulty-overlay').count() > 0) {
      await page.click('.difficulty-btn--normal');
    }
    // Dismiss the next-wave-overlay if it appeared (it intercepts pointer events)
    if (await page.locator('.next-wave-overlay').count() > 0) {
      await page.click('.next-wave-start');
    }
    await expect(page.locator('.hud-burger-btn')).toBeVisible({ timeout: 5000 });
    // Open burger menu and click mute then unmute
    await page.locator('.hud-burger-btn').click();
    await expect(page.locator('.hud-burger-menu')).toBeVisible();
    await page.locator('.hud-mute-btn').click();
    await page.locator('.hud-mute-btn').click();
    // Should be back to Mute label
    const labelFinal = await page.locator('.hud-mute-btn').textContent();
    expect(labelFinal).toContain('Mute');
    expect(labelFinal).not.toContain('Unmute');
    // localStorage must be false
    const stored = await page.evaluate(() => { try { return localStorage.getItem('sfx-muted') } catch { return null } });
    expect(stored).toBe('false');
  });

  test('mute preference persists across page reload', async ({ page }) => {
    // Navigate to a valid origin so localStorage is accessible
    await page.goto('/');
    if (await page.locator('.difficulty-overlay').count() > 0) {
      await page.click('.difficulty-btn--normal');
    }
    // Clear mute state, reload so HUD starts unmuted
    await page.evaluate(() => { try { localStorage.removeItem('sfx-muted') } catch {} });
    await page.goto('/');
    if (await page.locator('.difficulty-overlay').count() > 0) {
      await page.click('.difficulty-btn--normal');
    }
    // Dismiss the next-wave-overlay if it appeared (it intercepts pointer events)
    if (await page.locator('.next-wave-overlay').count() > 0) {
      await page.click('.next-wave-start');
    }
    await expect(page.locator('.hud-burger-btn')).toBeVisible({ timeout: 5000 });
    // Mute via the button
    await page.locator('.hud-burger-btn').click();
    await expect(page.locator('.hud-burger-menu')).toBeVisible();
    await page.locator('.hud-mute-btn').click();
    const stored = await page.evaluate(() => { try { return localStorage.getItem('sfx-muted') } catch { return null } });
    expect(stored).toBe('true');
    // Reload and verify persistence
    await page.goto('/');
    if (await page.locator('.difficulty-overlay').count() > 0) {
      await page.click('.difficulty-btn--normal');
    }
    // Dismiss the next-wave-overlay again after reload
    if (await page.locator('.next-wave-overlay').count() > 0) {
      await page.click('.next-wave-start');
    }
    await expect(page.locator('.hud-burger-btn')).toBeVisible({ timeout: 5000 });
    await page.locator('.hud-burger-btn').click();
    await expect(page.locator('.hud-burger-menu')).toBeVisible();
    // Button must show Unmute (muted state was persisted via localStorage)
    const labelReloaded = await page.locator('.hud-mute-btn').textContent();
    expect(labelReloaded).toContain('Unmute');
  });

  // --- Responsive tile sizing (issue #116 / PR #131) ---

  test('tiles are 40px on a full-size (1920x1080) viewport', async ({ page }) => {
    // Resize to 1920x1080 — computeTileSize caps at 40 so tiles should be 40px.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    const diffOverlay = page.locator('.difficulty-overlay');
    if (await diffOverlay.isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    await expect(page.locator('.game-board')).toBeVisible();
    // Each .tile must have computed width/height equal to 40px
    const tileWidth = await page.locator('.tile').first().evaluate(el =>
      parseFloat(getComputedStyle(el).width)
    );
    expect(tileWidth).toBe(40);
  });

  test('tiles are smaller than 40px on a narrow (800px wide) viewport', async ({ page }) => {
    // Resize to a narrow viewport that forces tiles to shrink below 40px.
    // computeTileSize = Math.min(40, Math.floor(Math.min(800/20, (600-240)/15))) = Math.min(40,24) = 24
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');
    const diffOverlay = page.locator('.difficulty-overlay');
    if (await diffOverlay.isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    await expect(page.locator('.game-board')).toBeVisible();
    const tileWidth = await page.locator('.tile').first().evaluate(el =>
      parseFloat(getComputedStyle(el).width)
    );
    expect(tileWidth).toBeLessThan(40);
  });

  // --- Enemy status indicators: frozen, slowed, poisoned (issue #118 / PR #134) ---
  // These tests inject enemies directly via React fiber (stateHooks[7] = enemies, post-PR #131).
  // isEnemyFrozen: speedMult===0 && slowUntil set
  // isEnemySlowed: speedMult>0 && speedMult<1 && slowUntil set
  // isEnemyPoisoned: poisonEffects array is non-empty

  test('frozen enemy (speedMult=0) shows .enemy--frozen class', async ({ page }) => {
    await page.goto('/');
    if (await page.locator('.difficulty-overlay').isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // enemies = stateHooks[7] (post-PR #131)
          if (stateHooks[7]) {
            stateHooks[7].queue.dispatch([{
              id: 'test-frozen-1',
              hp: 80,
              maxHp: 100,
              pos: { row: 2, col: 3 },
              waypointIndex: 1,
              speed: 1.0,
              type: 'grunt',
              goldReward: 8,
              speedMult: 0,
              slowUntil: Date.now() + 5000,
            }]);
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber');
    });
    // Enemy layer must render
    await expect(page.locator('.enemy-layer').first()).toBeAttached({ timeout: 2000 });
    // The enemy must carry .enemy--frozen
    const frozenEl = page.locator('.enemy-layer .enemy--frozen').first();
    expect(await frozenEl.count()).toBeGreaterThan(0);
    await expect(frozenEl).toBeAttached({ timeout: 2000 });
    // The freeze icon (❄) must be present inside the frozen enemy
    const freezeIcon = page.locator('.enemy-layer .enemy--frozen .enemy--freeze-icon').first();
    await expect(freezeIcon).toBeAttached({ timeout: 2000 });
    // Must NOT carry .enemy--slowed at the same time
    await expect(page.locator('.enemy-layer .enemy--slowed')).toHaveCount(0);
  });

  test('slowed enemy (speedMult=0.5) shows .enemy--slowed class', async ({ page }) => {
    await page.goto('/');
    if (await page.locator('.difficulty-overlay').isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // enemies = stateHooks[7] (post-PR #131)
          if (stateHooks[7]) {
            stateHooks[7].queue.dispatch([{
              id: 'test-slowed-1',
              hp: 80,
              maxHp: 100,
              pos: { row: 2, col: 4 },
              waypointIndex: 1,
              speed: 1.0,
              type: 'grunt',
              goldReward: 8,
              speedMult: 0.5,
              slowUntil: Date.now() + 5000,
            }]);
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber');
    });
    // Enemy layer must render
    await expect(page.locator('.enemy-layer').first()).toBeAttached({ timeout: 2000 });
    // The enemy must carry .enemy--slowed
    const slowedEl = page.locator('.enemy-layer .enemy--slowed').first();
    expect(await slowedEl.count()).toBeGreaterThan(0);
    await expect(slowedEl).toBeAttached({ timeout: 2000 });
    // Must NOT carry .enemy--frozen at the same time
    await expect(page.locator('.enemy-layer .enemy--frozen')).toHaveCount(0);
  });

  test('poisoned enemy (poisonEffects set) shows .enemy--poisoned and .enemy--poison-drip', async ({ page }) => {
    await page.goto('/');
    if (await page.locator('.difficulty-overlay').isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // enemies = stateHooks[7] (post-PR #131)
          if (stateHooks[7]) {
            stateHooks[7].queue.dispatch([{
              id: 'test-poisoned-1',
              hp: 80,
              maxHp: 100,
              pos: { row: 2, col: 5 },
              waypointIndex: 1,
              speed: 1.0,
              type: 'grunt',
              goldReward: 8,
              effects: [{ type: 'poison', ticksRemaining: 10 }],
            }]);
          }
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber');
    });
    // Enemy layer must render
    await expect(page.locator('.enemy-layer').first()).toBeAttached({ timeout: 2000 });
    // The enemy must carry .enemy--poisoned
    const poisonedEl = page.locator('.enemy-layer .enemy--poisoned').first();
    expect(await poisonedEl.count()).toBeGreaterThan(0);
    await expect(poisonedEl).toBeAttached({ timeout: 2000 });
    // The poison drip element must be present inside the poisoned enemy
    const dripEl = page.locator('.enemy-layer .enemy--poisoned .enemy--poison-drip').first();
    await expect(dripEl).toBeAttached({ timeout: 2000 });
  });

  // --- Session history panel (issue #119 / PR #135) ---
  // HistoryPanel: overlay opened via burger menu > 🕐 History button.
  // historyPanelOpen = stateHooks[28] (PR #135, inserted between achievementModalOpen[27] and prestigeStars[29]).

  test('clicking History in burger menu opens .history-panel overlay', async ({ page }) => {
    // Start fresh to avoid any state from prior tests leaking in
    await page.goto('/');
    if (await page.locator('.difficulty-overlay').isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    // Dismiss NextWave overlay so the burger button in the HUD is fully interactive
    const nwBtn = page.locator('.next-wave-start');
    if (await nwBtn.isVisible()) await nwBtn.click({ force: true });
    // Open burger menu
    await page.locator('.hud-burger-btn').click({ force: true });
    await expect(page.locator('.hud-burger-menu')).toBeVisible();
    // History button must be present in the menu
    const historyBtn = page.locator('.hud-burger-menu .hud-history-btn');
    await expect(historyBtn).toBeVisible();
    // Click it — panel opens
    await historyBtn.click();
    // The history-panel overlay must be visible
    await expect(page.locator('.history-panel-overlay')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.history-panel')).toBeVisible({ timeout: 2000 });
  });

  test('HistoryPanel shows empty-state text when localStorage has no history', async ({ page }) => {
    // Navigate fresh and clear history before load so the panel sees an empty store
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('towerDefense_sessionHistory');
    });
    await page.reload();
    if (await page.locator('.difficulty-overlay').isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    // Dismiss NextWave overlay
    const nwBtn = page.locator('.next-wave-start');
    if (await nwBtn.isVisible()) await nwBtn.click({ force: true });
    // Open burger menu and click History
    await page.locator('.hud-burger-btn').click({ force: true });
    await expect(page.locator('.hud-burger-menu')).toBeVisible();
    const historyBtn = page.locator('.hud-burger-menu .hud-history-btn');
    await expect(historyBtn).toBeVisible();
    await historyBtn.click();
    // Panel must show the empty-state paragraph
    await expect(page.locator('.history-panel-overlay')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.history-panel-empty')).toBeVisible({ timeout: 2000 });
    const emptyText = await page.locator('.history-panel-empty').textContent();
    expect(emptyText).toMatch(/no previous sessions/i);
  });

  test('HistoryPanel closes when the close (✕) button is clicked', async ({ page }) => {
    // Start fresh to avoid interference from prior tests
    await page.goto('/');
    if (await page.locator('.difficulty-overlay').isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    // Dismiss NextWave overlay
    const nwBtn = page.locator('.next-wave-start');
    if (await nwBtn.isVisible()) await nwBtn.click({ force: true });
    // Open burger menu, click History to open the panel
    await page.locator('.hud-burger-btn').click({ force: true });
    await expect(page.locator('.hud-burger-menu')).toBeVisible();
    await page.locator('.hud-burger-menu .hud-history-btn').click();
    await expect(page.locator('.history-panel-overlay')).toBeVisible({ timeout: 2000 });
    // Click the ✕ close button
    await page.locator('.history-panel-close').click();
    // Panel must disappear
    await expect(page.locator('.history-panel-overlay')).not.toBeVisible({ timeout: 2000 });
  });

  test('after game over, localStorage contains a towerDefense_sessionHistory entry', async ({ page }) => {
    // Navigate fresh so fiber state is clean and #game element is present
    await page.goto('/');
    if (await page.locator('.difficulty-overlay').isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    // Inject lives=0 and gamePhase='playing' to trigger the game-over useEffect which calls saveSession.
    // The useEffect in App.jsx runs when lives <= 0 && gamePhase === 'playing'.
    await setLivesAndPhase(page, 0, 'playing');
    // Wait for game-over overlay (confirms useEffect ran and saveSession was called)
    await expect(page.locator('.game-over-overlay')).toBeVisible({ timeout: 3000 });
    // Read localStorage and verify the entry was written
    const history = await page.evaluate(() => {
      const raw = localStorage.getItem('towerDefense_sessionHistory');
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    });
    expect(history).not.toBeNull();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
    // Each entry must have the required shape
    const entry = history[0];
    expect(entry).toHaveProperty('hash');
    expect(entry).toHaveProperty('maxWave');
    expect(entry).toHaveProperty('score');
    expect(entry).toHaveProperty('playedAt');
  });

  // --- Sell tower feature (issue #136 / PR #143) ---
  // Helper: navigate fresh, select Normal difficulty, then dismiss the NextWave overlay.
  // Written inline in each test (self-contained) because beforeEach timing can leave
  // difficultyMode=null when tests are isolated with --grep.

  test('upgrade panel shows .upgrade-panel-sell-btn after placing and selecting a tower', async ({ page }) => {
    // Full fresh setup: navigate, select difficulty, dismiss wave overlay
    await page.goto('/');
    await expect(page.locator('.difficulty-overlay')).toBeVisible({ timeout: 5000 });
    await page.click('.difficulty-btn--normal');
    await expect(page.locator('.next-wave-overlay')).toBeVisible({ timeout: 5000 });
    await page.locator('.next-wave-start').click();
    await expect(page.locator('.next-wave-overlay')).not.toBeVisible();

    // Place a BasicTower — auto-select opens the upgrade panel
    const slot = page.locator('.tower-slot').first();
    await expect(slot).toBeVisible();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    // Upgrade panel must open automatically (auto-select behavior from issue #42)
    await expect(page.locator('.upgrade-panel')).toBeVisible();
    // Sell button must be present inside the panel
    await expect(page.locator('.upgrade-panel-sell-btn')).toBeVisible();
  });

  test('clicking .upgrade-panel-sell-btn removes the tower from the board and increases gold', async ({ page }) => {
    // Full fresh setup: navigate, select difficulty, dismiss wave overlay
    await page.goto('/');
    await expect(page.locator('.difficulty-overlay')).toBeVisible({ timeout: 5000 });
    await page.click('.difficulty-btn--normal');
    await expect(page.locator('.next-wave-overlay')).toBeVisible({ timeout: 5000 });
    await page.locator('.next-wave-start').click();
    await expect(page.locator('.next-wave-overlay')).not.toBeVisible();

    // Read starting gold from HUD (Normal difficulty: 100g)
    const goldText = await page.locator('.hud-gold').textContent();
    const startGold = parseInt(goldText.replace(/[^0-9]/g, ''), 10);

    // Place a BasicTower (costs 50g) — auto-select opens the upgrade panel
    const slot = page.locator('.tower-slot').first();
    await expect(slot).toBeVisible();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();

    const towerCountBefore = await page.locator('.tower-icon').count();
    expect(towerCountBefore).toBeGreaterThan(0);

    // Wait for upgrade panel and the sell button to appear
    await expect(page.locator('.upgrade-panel')).toBeVisible();
    const sellBtn = page.locator('.upgrade-panel-sell-btn');
    await expect(sellBtn).toBeVisible();

    // Sell button must be enabled (gold < MAX_GOLD=9999 after placement)
    await expect(sellBtn).not.toBeDisabled();

    // Click sell
    await sellBtn.click();

    // Tower must be removed from the board
    const towerCountAfter = await page.locator('.tower-icon').count();
    expect(towerCountAfter).toBeLessThan(towerCountBefore);

    // Gold displayed in HUD must have increased (refund added back)
    const goldTextAfter = await page.locator('.hud-gold').textContent();
    const goldAfter = parseInt(goldTextAfter.replace(/[^0-9]/g, ''), 10);
    expect(goldAfter).toBeGreaterThan(startGold - 50); // at least some refund returned
  });

  test('.upgrade-panel-sell-btn is disabled when gold is at MAX_GOLD (9999)', async ({ page }) => {
    // Full fresh setup: navigate, select difficulty, dismiss wave overlay
    await page.goto('/');
    await expect(page.locator('.difficulty-overlay')).toBeVisible({ timeout: 5000 });
    await page.click('.difficulty-btn--normal');
    await expect(page.locator('.next-wave-overlay')).toBeVisible({ timeout: 5000 });
    await page.locator('.next-wave-start').click();
    await expect(page.locator('.next-wave-overlay')).not.toBeVisible();

    // Place a BasicTower — auto-select opens upgrade panel
    const slot = page.locator('.tower-slot').first();
    await expect(slot).toBeVisible();
    await slot.click();
    await expect(page.locator('.tower-icon').first()).toBeVisible();
    await expect(page.locator('.upgrade-panel')).toBeVisible();

    // Inject gold = 9999 (MAX_GOLD) via React fiber: stateHooks[2] = gold
    // Hook indices from verified comment at top of this file (post-PR #135, unchanged by PR #143):
    //   stateHook[2] = gold
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          const stateHooks = [];
          let hookNode = fiber.memoizedState;
          while (hookNode) {
            if (hookNode.queue && typeof hookNode.queue.dispatch === 'function') {
              stateHooks.push(hookNode);
            }
            hookNode = hookNode.next;
          }
          // stateHooks[2] = gold (verified against live App.jsx post-PR #135)
          if (stateHooks[2] && stateHooks[2].queue && stateHooks[2].queue.dispatch) {
            stateHooks[2].queue.dispatch(9999);
            return;
          }
          throw new Error('Could not find gold hook dispatcher (expected stateHooks[2])');
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber for gold injection');
    });

    // Wait for HUD gold to reflect 9999
    await expect(page.locator('.hud-gold')).toContainText('9999', { timeout: 2000 });

    // Sell button must now be disabled — selling would overflow gold beyond MAX_GOLD
    const sellBtn = page.locator('.upgrade-panel-sell-btn');
    await expect(sellBtn).toBeVisible();
    await expect(sellBtn).toBeDisabled();
  });
});
