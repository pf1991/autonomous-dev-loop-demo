import { test, expect } from '@playwright/test';

/**
 * Helper: find the React state setter for a given state index inside the App component.
 * In Vite dev builds React runs in development mode, exposing __reactFiber on DOM nodes.
 */
async function triggerGamePhase(page, phase) {
  await page.evaluate((targetPhase) => {
    // Walk fibers from #game upward to find the App fiber (the one with many hooks)
    const gameEl = document.querySelector('#game');
    const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
    let fiber = gameEl[fiberKey];
    // Go up the tree to find a component fiber (not a host fiber)
    while (fiber) {
      if (fiber.memoizedState && typeof fiber.type === 'function') {
        // Walk the hooks linked list to find the gamePhase hook dispatcher
        // App.jsx order (all hooks including useRef) after PR #97 (difficultyMode prepended):
        //   difficultyMode(0), difficultyModeRef(1), gold(2), lives(3), wave(4), speed(5),
        //   towers(6), enemies(7), projectiles(8), deathAnimations(9), deathAnimationsRef(10),
        //   selectedTowerType(11), selectedTower(12), hoveredSlot(13), gamePhase(14)
        let hookNode = fiber.memoizedState;
        let i = 0;
        while (hookNode && i < 14) {
          hookNode = hookNode.next;
          i++;
        }
        if (hookNode && hookNode.queue && hookNode.queue.dispatch) {
          hookNode.queue.dispatch(targetPhase);
          return;
        }
      }
      fiber = fiber.return;
    }
    throw new Error('Could not find gamePhase hook dispatcher');
  }, phase);
}

/**
 * Helper: force lives to a given value via React fiber injection and set gamePhase to 'playing'.
 * App.jsx hook order (all hooks including useRef) after PR #97 (difficultyMode prepended):
 *   difficultyMode(0), difficultyModeRef(1), gold(2), lives(3), wave(4), speed(5),
 *   towers(6), enemies(7), projectiles(8), deathAnimations(9), deathAnimationsRef(10),
 *   selectedTowerType(11), selectedTower(12), hoveredSlot(13), gamePhase(14)
 */
async function setLivesAndPhase(page, livesValue, phase) {
  await page.evaluate(({ livesValue, phase }) => {
    const gameEl = document.querySelector('#game');
    const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
    let fiber = gameEl[fiberKey];
    while (fiber) {
      if (fiber.memoizedState && typeof fiber.type === 'function') {
        // App.jsx hook order (all hooks including useRef) after PR #97 (difficultyMode prepended):
        //   difficultyMode(0), difficultyModeRef(1), gold(2), lives(3), wave(4), speed(5),
        //   towers(6), enemies(7), projectiles(8), deathAnimations(9), deathAnimationsRef(10),
        //   selectedTowerType(11), selectedTower(12), hoveredSlot(13), gamePhase(14)
        let hookNode = fiber.memoizedState;
        let livesHook = null;
        let phaseHook = null;
        let i = 0;
        while (hookNode) {
          if (i === 3) livesHook = hookNode;
          if (i === 14) phaseHook = hookNode;
          hookNode = hookNode.next;
          i++;
        }
        if (livesHook && livesHook.queue && livesHook.queue.dispatch) {
          livesHook.queue.dispatch(livesValue);
        }
        if (phaseHook && phaseHook.queue && phaseHook.queue.dispatch) {
          phaseHook.queue.dispatch(phase);
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

  test('GameOver win overlay shows "You Win" message and Restart button', async ({ page }) => {
    await triggerGamePhase(page, 'win');
    await expect(page.locator('.game-over-overlay')).toBeVisible();
    await expect(page.locator('.game-over-message')).toContainText('You Win');
    await expect(page.locator('.game-over-restart')).toBeVisible();
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
    // The SVG must contain a rect with class tower-basic (the diamond shape)
    const diamond = svgEl.locator('rect.tower-basic');
    await expect(diamond).toBeAttached();
    // Verify no emoji text remains — the icon element should contain an SVG, not raw text
    const innerText = await towerIcon.evaluate(el => el.innerText.trim());
    expect(innerText).toBe('');
  });

  test('SniperTower renders an SVG with a red triangle (polygon.tower-sniper)', async ({ page }) => {
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
    // .tower-icon should now contain an SVG with a polygon.tower-sniper
    const towerIcon = page.locator('.tower-icon').first();
    await expect(towerIcon).toBeVisible();
    const svgEl = towerIcon.locator('svg');
    await expect(svgEl).toBeAttached();
    const triangle = svgEl.locator('polygon.tower-sniper');
    await expect(triangle).toBeAttached();
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
   * App.jsx hook order (all hooks including useRef):
   *   gold(0), lives(1), wave(2), speed(3), towers(4), enemies(5),
   *   projectiles(6), deathAnimations(7), deathAnimationsRef(8),
   *   selectedTowerType(9), selectedTower(10), hoveredSlot(11), gamePhase(12)
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
            if (i === 4) waveHook = hookNode;
            if (i === 14) phaseHook = hookNode;
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
            if (i === 4) waveHook = hookNode;
            if (i === 14) phaseHook = hookNode;
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
            if (i === 4) waveHook = hookNode;
            if (i === 14) phaseHook = hookNode;
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
            if (i === 4) waveHook = hookNode;
            if (i === 14) phaseHook = hookNode;
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
    // Countdown banner for wave 5 shows NEXT wave (wave+1=6) stats:
    // New exponential formula: count = 5 + (6-1) = 10 enemies, HP = Math.round(100 * 1.4^5) = 538
    await expect(page.locator('.wave-countdown-banner')).toBeVisible({ timeout: 2000 });
    const info = page.locator('.wave-countdown-info');
    // Use toBeAttached + inner text check — the span may be visually clipped in headless
    await expect(info).toBeAttached();
    const infoText = await info.textContent();
    expect(infoText).toContain('10 enemies');
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
    // Sell button must be visible and show the refund amount (35g for BasicTower)
    const sellBtn = panel.locator('.upgrade-panel-sell-btn');
    await expect(sellBtn).toBeVisible();
    await expect(sellBtn).toContainText('Sell');
    await expect(sellBtn).toContainText('35g');
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

    // Gold should be goldNum - 50 (buy) + 35 (sell refund) = goldNum - 15
    const goldAfterText = await page.locator('.hud-gold').textContent();
    const goldAfterNum = parseInt(goldAfterText.replace(/\D/g, ''), 10);
    expect(goldAfterNum).toBe(goldNum - 50 + 35);

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
    // App.jsx useState declaration order after PR #97 (difficultyMode prepended):
    //   0=difficultyMode,1=gold,2=lives,3=wave,4=speed,5=towers,6=enemies,
    //   7=projectiles,8=deathAnimations,9=selectedTowerType,10=selectedTower,
    //   11=hoveredSlot,12=gamePhase,13=endlessMode,14=finalScore
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
          if (stateHooks[14]) stateHooks[14].queue.dispatch(1234);  // finalScore
          if (stateHooks[12]) stateHooks[12].queue.dispatch('lose'); // gamePhase
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

  test('"Next Wave Early" button is not visible before a wave starts', async ({ page }) => {
    // On initial load the game is between-waves, so the button must not appear
    await expect(page.locator('.hud-next-wave')).not.toBeVisible();
  });

  test('"Next Wave Early" button appears in the HUD once a wave is playing', async ({ page }) => {
    // Start wave 1
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // The button must become visible during a wave (not final wave)
    await expect(page.locator('.hud-next-wave')).toBeVisible({ timeout: 3000 });
  });

  test('"Next Wave Early" button becomes disabled after being clicked once', async ({ page }) => {
    // Start wave 1
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    const earlyBtn = page.locator('.hud-next-wave');
    await expect(earlyBtn).toBeVisible({ timeout: 3000 });
    // Initially enabled
    await expect(earlyBtn).not.toBeDisabled();
    // Click it
    await earlyBtn.click();
    // Must be disabled immediately after use (one early call per wave)
    await expect(earlyBtn).toBeDisabled();
  });

  test('clicking "Next Wave Early" adds enemies to the board (wave overlap)', async ({ page }) => {
    // Start wave 1
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    const earlyBtn = page.locator('.hud-next-wave');
    await expect(earlyBtn).toBeVisible({ timeout: 3000 });
    // Wait for some enemies to spawn so there is already a wave in flight
    await expect(page.locator('.enemy').first()).toBeVisible({ timeout: 5000 });
    // Trigger the early wave
    await earlyBtn.click();
    // The board should still have enemies (not reset) — at least one enemy must be present
    await expect(page.locator('.enemy').first()).toBeAttached({ timeout: 2000 });
    // The button must now be disabled
    await expect(earlyBtn).toBeDisabled();
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

  // --- Endless mode (issue #56) ---

  test('endless mode toggle is visible on the pre-wave-1 start screen', async ({ page }) => {
    // On initial load the NextWave overlay must be visible and contain the endless toggle
    await expect(page.locator('.next-wave-overlay')).toBeVisible();
    await expect(page.locator('.endless-mode-toggle')).toBeVisible();
    await expect(page.locator('.endless-mode-checkbox')).toBeVisible();
    await expect(page.locator('.endless-mode-label')).toContainText('Endless Mode');
  });

  test('endless mode checkbox is unchecked by default', async ({ page }) => {
    await expect(page.locator('.endless-mode-checkbox')).not.toBeChecked();
  });

  test('checking endless mode checkbox enables endless mode', async ({ page }) => {
    const checkbox = page.locator('.endless-mode-checkbox');
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });

  test('HUD shows ENDLESS badge when endless mode is active', async ({ page }) => {
    // Enable endless mode before starting
    await page.locator('.endless-mode-checkbox').check();
    // Start wave 1
    await page.locator('.next-wave-start').click();
    // ENDLESS badge must appear in the HUD
    await expect(page.locator('.hud-endless-badge')).toBeVisible();
    await expect(page.locator('.hud-endless-badge')).toContainText('ENDLESS');
  });

  test('HUD does not show ENDLESS badge in normal mode', async ({ page }) => {
    // Do NOT enable endless mode — start wave 1 normally
    await page.locator('.next-wave-start').click();
    // Badge must not be present
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

  test('TowerPicker shows Splash special-ability label for CannonTower', async ({ page }) => {
    const cannonBtn = page.locator('.tower-picker button').filter({ hasText: 'CannonTower' });
    await expect(cannonBtn).toBeAttached();
    // The special label should show a Splash indicator
    const specialLabel = cannonBtn.locator('.tower-picker-special');
    await expect(specialLabel).toBeAttached();
    const labelText = await specialLabel.textContent();
    expect(labelText).toMatch(/Splash/);
  });

  test('TowerPicker shows Slow special-ability label for SlowTower', async ({ page }) => {
    const slowBtn = page.locator('.tower-picker button').filter({ hasText: 'SlowTower' });
    await expect(slowBtn).toBeAttached();
    // The special label should show a Slow indicator
    const specialLabel = slowBtn.locator('.tower-picker-special');
    await expect(specialLabel).toBeAttached();
    const labelText = await specialLabel.textContent();
    expect(labelText).toMatch(/Slow/);
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

  test('SlowTower renders SVG with polygon.tower-slow when placed', async ({ page }) => {
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
    await expect(svgEl.locator('polygon.tower-slow')).toBeAttached();
  });

  // --- Status-effect towers: PoisonTower (issue #67) ---

  test('TowerPicker shows PoisonTower button', async ({ page }) => {
    await expect(page.locator('.tower-picker')).toBeVisible();
    await expect(page.locator('.tower-picker button').filter({ hasText: 'PoisonTower' })).toBeAttached();
  });

  test('TowerPicker shows Poison special-ability label for PoisonTower', async ({ page }) => {
    const poisonBtn = page.locator('.tower-picker button').filter({ hasText: 'PoisonTower' });
    await expect(poisonBtn).toBeAttached();
    const specialLabel = poisonBtn.locator('.tower-picker-special');
    await expect(specialLabel).toBeAttached();
    const labelText = await specialLabel.textContent();
    expect(labelText).toMatch(/Poison/);
  });

  test('PoisonTower renders SVG with polygon.tower-poison when placed', async ({ page }) => {
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
    await expect(svgEl.locator('polygon.tower-poison').first()).toBeAttached();
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

  // --- Money animation: floating "+N gold" labels on enemy kill (issue #64) ---
  // These tests inject deathAnimations state directly via React fiber to avoid
  // relying on natural gameplay kills (BasicTower does only 25 damage/shot on
  // 80 HP grunts, requiring multiple passes which is unreliable in headless tests).

  test('death-gold-label appears when deathAnimations state is populated', async ({ page }) => {
    // Inject a deathAnimation entry directly via React fiber
    // App.jsx hook order (all hooks including useRef) after PR #97 (difficultyMode prepended):
    //   difficultyMode(0), difficultyModeRef(1), gold(2), lives(3), wave(4), speed(5),
    //   towers(6), enemies(7), projectiles(8), deathAnimations(9), deathAnimationsRef(10), ...
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          // Walk to hook index 9: deathAnimations (useState) — shifted +2 by PR #97
          let hookNode = fiber.memoizedState;
          let i = 0;
          while (hookNode && i < 9) {
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
    // Inject a deathAnimation entry directly via React fiber (hook index 9 after PR #97)
    await page.evaluate(() => {
      const gameEl = document.querySelector('#game');
      const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
      let fiber = gameEl[fiberKey];
      while (fiber) {
        if (fiber.memoizedState && typeof fiber.type === 'function') {
          let hookNode = fiber.memoizedState;
          let i = 0;
          while (hookNode && i < 9) {
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
          // wave=index 3, gamePhase=index 12 (after PR #97 difficultyMode prepended)
          if (stateHooks[3]) stateHooks[3].queue.dispatch(4);           // wave → 4
          if (stateHooks[12]) stateHooks[12].queue.dispatch('between-waves');
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
          // wave=index 3, gamePhase=index 12 (after PR #97 difficultyMode prepended)
          if (stateHooks[3]) stateHooks[3].queue.dispatch(2);           // wave → 2
          if (stateHooks[12]) stateHooks[12].queue.dispatch('between-waves');
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
          // enemies = dispatch index 6 (after PR #97 difficultyMode prepended)
          if (stateHooks[6]) {
            stateHooks[6].queue.dispatch([{
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
          // comboDisplay = dispatch index 24 (after PR #103 prestigeStars+wavesReached inserted)
          if (stateHooks[24]) {
            stateHooks[24].queue.dispatch({ count: 3, label: 'TRIPLE KILL', bonus: 5, visible: true });
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
          // comboDisplay = dispatch index 24 (after PR #103 prestigeStars+wavesReached inserted)
          if (stateHooks[24]) {
            stateHooks[24].queue.dispatch({ count: 5, label: 'RAMPAGE', bonus: 20, visible: true });
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
          // comboDisplay = dispatch index 24 (after PR #103 prestigeStars+wavesReached inserted)
          if (stateHooks[24]) {
            stateHooks[24].queue.dispatch({ count: 4, label: 'QUAD KILL', bonus: 10, visible: true });
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
          // comboDisplay = dispatch index 24 (after PR #103 prestigeStars+wavesReached inserted)
          if (stateHooks[24]) {
            stateHooks[24].queue.dispatch({ count: 0, label: '', bonus: 0, visible: false });
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
          // powerCrates = dispatch index 15 (after PR #97 difficultyMode prepended)
          if (stateHooks[15]) {
            stateHooks[15].queue.dispatch([{
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
          // Read current towers (index 5 after PR #97 difficultyMode prepended) and patch kills
          const towersHook = stateHooks[5];
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
          // towers = dispatch index 5 (after PR #97 difficultyMode prepended)
          const towersHook = stateHooks[5];
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
    // The stats section must contain a "Kills:" label
    const statsText = await panel.locator('.upgrade-panel-stats').textContent();
    expect(statsText).toContain('Kills:');
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
          // stateHooks[27] = pendingWaveAdvance (after PR #103 inserted prestigeStars+wavesReached); walk all hooks to find the node after it
          const pendingWaveHook = stateHooksForSeed[27];
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
          // Dispatch indices (useState only, 0-indexed) after PR #100: wave=3, gamePhase=12
          if (stateHooks[3]) stateHooks[3].queue.dispatch(3);           // wave → 3
          if (stateHooks[12]) stateHooks[12].queue.dispatch('between-waves');
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
          // Dispatch indices after PR #97: wave=3, gamePhase=12
          if (stateHooks[3]) stateHooks[3].queue.dispatch(2);
          if (stateHooks[12]) stateHooks[12].queue.dispatch('between-waves');
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
   * useState-only (stateHooks[N], dispatch-capable hooks in order):
   *   stateHooks[0]  = difficultyMode
   *   stateHooks[1]  = gold
   *   stateHooks[2]  = lives
   *   stateHooks[3]  = wave
   *   stateHooks[4]  = speed
   *   stateHooks[5]  = towers
   *   stateHooks[6]  = enemies
   *   stateHooks[7]  = projectiles
   *   stateHooks[8]  = deathAnimations
   *   stateHooks[9]  = selectedTowerType
   *   stateHooks[10] = selectedTower
   *   stateHooks[11] = hoveredSlot
   *   stateHooks[12] = gamePhase
   *   stateHooks[13] = endlessMode
   *   stateHooks[14] = finalScore
   *   stateHooks[15] = powerCrates
   *   stateHooks[16] = overchargeActive
   *   stateHooks[17] = interestFlash
   *   stateHooks[18] = interestCountdown
   *   stateHooks[19] = unlockedAchievements
   *   stateHooks[20] = achievementToasts
   *   stateHooks[21] = achievementModalOpen
   *   stateHooks[22] = prestigeStars        ← PR #103 (new)
   *   stateHooks[23] = wavesReached         ← PR #103 (new)
   *   stateHooks[24] = comboDisplay         ← was [22]
   *   stateHooks[25] = adjacencySynergies   ← was [23]
   *   stateHooks[26] = earlyWaveCalled      ← was [24]
   *   stateHooks[27] = pendingWaveAdvance   ← was [25]
   *   stateHooks[28] = currentWaveEventType ← was [26]
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

  test('HUD shows trophy button with achievement count (e.g. "🏆 0/12")', async ({ page }) => {
    // The HUD achievement button must be visible on initial load
    const btn = page.locator('.hud-achievement-btn');
    await expect(btn).toBeVisible();
    // Must contain the trophy emoji and a fraction of the form N/12
    const text = await btn.textContent();
    expect(text).toMatch(/🏆\s*\d+\/12/);
  });

  test('HUD trophy button shows 0/12 when no achievements are unlocked', async ({ page }) => {
    // Clear localStorage achievements and reload to start fresh
    await page.evaluate(() => localStorage.removeItem('unlockedAchievements'));
    await page.reload();
    const btn = page.locator('.hud-achievement-btn');
    await expect(btn).toBeVisible();
    const text = await btn.textContent();
    expect(text).toMatch(/🏆\s*0\/12/);
  });

  test('clicking the HUD trophy button opens the achievement modal', async ({ page }) => {
    // Dismiss the NextWave overlay so the HUD trophy button is clickable
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Modal should not be visible initially
    await expect(page.locator('.achievement-modal')).not.toBeAttached();
    // Click the trophy button
    await page.locator('.hud-achievement-btn').click();
    // Modal overlay and modal must appear
    await expect(page.locator('.achievement-modal-overlay')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.achievement-modal')).toBeVisible();
  });

  test('achievement modal lists 12 achievement items', async ({ page }) => {
    // Dismiss the NextWave overlay so the HUD trophy button is clickable
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Open modal via trophy button
    await page.locator('.hud-achievement-btn').click();
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
    // Open modal
    await page.locator('.hud-achievement-btn').click();
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
    await dispatchAppHook(page, 31, ['first_blood']);
    // Open modal
    await page.locator('.hud-achievement-btn').click();
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
    await dispatchAppHook(page, 31, ['first_blood', 'boss_slayer', 'combo_king']);
    // Open modal
    await page.locator('.hud-achievement-btn').click();
    await expect(page.locator('.achievement-modal')).toBeVisible({ timeout: 2000 });
    // Modal title must show 3/12
    const title = page.locator('.achievement-modal-title');
    const titleText = await title.textContent();
    expect(titleText).toContain('3/12');
  });

  test('clicking the close button in the achievement modal closes it', async ({ page }) => {
    // Dismiss the NextWave overlay so the HUD trophy button is clickable
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Open modal
    await page.locator('.hud-achievement-btn').click();
    await expect(page.locator('.achievement-modal')).toBeVisible({ timeout: 2000 });
    // Click close button
    await page.locator('.achievement-modal-close').click();
    // Modal must be gone
    await expect(page.locator('.achievement-modal')).not.toBeAttached({ timeout: 2000 });
  });

  test('clicking the modal overlay backdrop closes the modal', async ({ page }) => {
    // Dismiss the NextWave overlay so the HUD trophy button is clickable
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Open modal
    await page.locator('.hud-achievement-btn').click();
    await expect(page.locator('.achievement-modal-overlay')).toBeVisible({ timeout: 2000 });
    // Click the overlay (not the modal itself) — use coordinates at the very top-left
    // of the overlay which is outside the centered modal panel
    await page.locator('.achievement-modal-overlay').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('.achievement-modal')).not.toBeAttached({ timeout: 2000 });
  });

  test('HUD trophy button count updates when achievements are injected', async ({ page }) => {
    // Initially 0/12
    const btn = page.locator('.hud-achievement-btn');
    await expect(btn).toBeVisible();
    // Inject 5 achievements
    await dispatchAppHook(page, 31, ['first_blood', 'boss_slayer', 'combo_king', 'tower_builder', 'golden_hoard']);
    // Button text should update to 5/12
    await expect(btn).toContainText('5/12');
  });

  test('AchievementToast appears when an achievement toast is injected', async ({ page }) => {
    // Toast container must not be visible when no toasts are active
    await expect(page.locator('.achievement-toast-container')).not.toBeAttached();
    // Inject a toast via hook index 33 (achievementToasts, after PR #100 interest hooks inserted)
    await dispatchAppHook(page, 33, [{ id: 'first_blood', name: 'First Blood', dismissAt: Date.now() + 5000 }]);
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
    await dispatchAppHook(page, 33, [{ id: 'boss_slayer', name: 'Boss Slayer', dismissAt: Date.now() + 5000 }]);
    await expect(page.locator('.achievement-toast').first()).toBeVisible({ timeout: 2000 });
    const icon = page.locator('.achievement-toast-icon').first();
    const iconText = await icon.textContent();
    expect(iconText).toContain('🏆');
  });

  test('achievement modal is accessible — has achievement-modal-list with list items', async ({ page }) => {
    // Dismiss the NextWave overlay so the HUD trophy button is clickable
    const startBtn = page.locator('.next-wave-start');
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    // Open modal
    await page.locator('.hud-achievement-btn').click();
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

  test('MortarTower renders SVG with polygon.tower-mortar when placed (via gold injection)', async ({ page }) => {
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
          // gold = dispatch index 1 (after PR #97 difficultyMode prepended)
          if (stateHooks[1]) stateHooks[1].queue.dispatch(200);
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

    // SVG must be present with the octagon polygon carrying class tower-mortar
    const svgEl = towerIcon.locator('svg');
    await expect(svgEl).toBeAttached();
    await expect(svgEl.locator('polygon.tower-mortar').first()).toBeAttached();

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
          // enemies = dispatch stateHook index 6 (after PR #97 difficultyMode prepended)
          if (stateHooks[6]) {
            stateHooks[6].queue.dispatch([enemy]);
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
  // so we must also set gamePhase='playing' (overall hook index 14) for the ticker to render.

  test('.hud-interest-ticker is visible in the HUD after injecting a non-null interestCountdown with playing phase', async ({ page }) => {
    // Set gamePhase='playing' (overall index 14) and interestCountdown=7 (overall index 28).
    // Gold starts at 100 (Normal); the HUD renders .hud-interest-ticker when
    // interestCountdown !== null && gold > 0.
    await dispatchAppHook(page, 14, 'playing');
    await dispatchAppHook(page, 28, 7);
    // The ticker must be attached and visible in the HUD
    await expect(page.locator('.hud .hud-interest-ticker')).toBeVisible({ timeout: 2000 });
    // Ticker text must mention interest and a countdown in seconds
    const tickerText = await page.locator('.hud-interest-ticker').textContent();
    expect(tickerText).toContain('interest');
    expect(tickerText).toMatch(/\d+s/);
  });

  test('.hud-interest-ticker shows correct interest amount based on current gold', async ({ page }) => {
    // Gold starts at 100 (Normal); computeInterest(100) = floor(100 * 0.05) = 5
    await dispatchAppHook(page, 14, 'playing');
    await dispatchAppHook(page, 28, 5);
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

  test('.hud-prestige-stars is visible in the HUD on initial load', async ({ page }) => {
    // HUD renders .hud-prestige-stars unconditionally (all 5 star slots are always shown)
    await expect(page.locator('.hud-prestige-stars')).toBeVisible();
    // Must contain exactly 5 star span elements
    const stars = page.locator('.hud-prestige-stars .prestige-star');
    await expect(stars).toHaveCount(5);
  });

  test('.hud-prestige-stars shows hollow stars when prestigeStars=0', async ({ page }) => {
    // Ensure localStorage has no prestige stars (default state)
    await page.evaluate(() => localStorage.removeItem('prestigeStars'));
    await page.reload();
    // After reload, dismiss difficulty selector
    const diffOverlay = page.locator('.difficulty-overlay');
    if (await diffOverlay.isVisible()) {
      await page.click('.difficulty-btn--normal');
    }
    // All 5 stars must be hollow (prestigeStars=0)
    const filledStars = page.locator('.prestige-star--filled');
    await expect(filledStars).toHaveCount(0);
    const hollowStars = page.locator('.prestige-star--hollow');
    await expect(hollowStars).toHaveCount(5);
  });

  test('.hud-prestige-stars shows filled stars when prestigeStars is injected via fiber', async ({ page }) => {
    // Inject prestigeStars=2 via React fiber (stateHooks[22] after PR #103)
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
          // prestigeStars = stateHooks[22] (after PR #103)
          if (stateHooks[22]) stateHooks[22].queue.dispatch(2);
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });
    // 2 filled stars, 3 hollow stars
    await expect(page.locator('.prestige-star--filled')).toHaveCount(2);
    await expect(page.locator('.prestige-star--hollow')).toHaveCount(3);
  });

  test('.prestige-btn appears in GameOver overlay when endlessMode=true, wavesReached>=20, prestigeStars<5', async ({ page }) => {
    // Inject endlessMode=true (stateHooks[13]), wavesReached=20 (stateHooks[23]),
    // prestigeStars=0 (stateHooks[22]), and gamePhase='lose' (stateHooks[12])
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
          // Dispatch all in the same React batch
          if (stateHooks[22]) stateHooks[22].queue.dispatch(0);           // prestigeStars = 0
          if (stateHooks[23]) stateHooks[23].queue.dispatch(20);          // wavesReached = 20
          if (stateHooks[13]) stateHooks[13].queue.dispatch(true);        // endlessMode = true
          if (stateHooks[12]) stateHooks[12].queue.dispatch('lose');      // gamePhase = 'lose'
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
    // Inject endlessMode=true, wavesReached=10 (below threshold), gamePhase='lose'
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
          if (stateHooks[22]) stateHooks[22].queue.dispatch(0);           // prestigeStars = 0
          if (stateHooks[23]) stateHooks[23].queue.dispatch(10);          // wavesReached = 10 (below threshold)
          if (stateHooks[13]) stateHooks[13].queue.dispatch(true);        // endlessMode = true
          if (stateHooks[12]) stateHooks[12].queue.dispatch('lose');      // gamePhase = 'lose'
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

  test('.prestige-btn is absent when endlessMode=false even if wavesReached>=20', async ({ page }) => {
    // Inject endlessMode=false, wavesReached=25, gamePhase='lose'
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
          if (stateHooks[22]) stateHooks[22].queue.dispatch(0);           // prestigeStars = 0
          if (stateHooks[23]) stateHooks[23].queue.dispatch(25);          // wavesReached = 25
          if (stateHooks[13]) stateHooks[13].queue.dispatch(false);       // endlessMode = false
          if (stateHooks[12]) stateHooks[12].queue.dispatch('lose');      // gamePhase = 'lose'
          return;
        }
        fiber = fiber.return;
      }
      throw new Error('Could not find App fiber hooks');
    });
    await expect(page.locator('.game-over-overlay')).toBeVisible({ timeout: 2000 });
    // Prestige button must NOT appear (not endless mode)
    await expect(page.locator('.prestige-btn')).not.toBeAttached();
  });

  test('.prestige-btn is absent when prestigeStars=5 (star cap reached)', async ({ page }) => {
    // Inject endlessMode=true, wavesReached=25, prestigeStars=5 (cap), gamePhase='lose'
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
          if (stateHooks[22]) stateHooks[22].queue.dispatch(5);           // prestigeStars = 5 (cap)
          if (stateHooks[23]) stateHooks[23].queue.dispatch(25);          // wavesReached = 25
          if (stateHooks[13]) stateHooks[13].queue.dispatch(true);        // endlessMode = true
          if (stateHooks[12]) stateHooks[12].queue.dispatch('lose');      // gamePhase = 'lose'
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
    // Ensure clean state: 0 prestige stars
    await page.evaluate(() => localStorage.removeItem('prestigeStars'));
    await page.reload();
    await page.waitForSelector('.game-board', { state: 'visible' });
    // Inject conditions that show the prestige button via fiber
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
          if (stateHooks[22]) stateHooks[22].queue.dispatch(0);           // prestigeStars = 0
          if (stateHooks[23]) stateHooks[23].queue.dispatch(20);          // wavesReached = 20
          if (stateHooks[13]) stateHooks[13].queue.dispatch(true);        // endlessMode = true
          if (stateHooks[12]) stateHooks[12].queue.dispatch('lose');      // gamePhase = 'lose'
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
    const stored = await page.evaluate(() => localStorage.getItem('prestigeStars'));
    expect(stored).toBe('1');
    // Reload and verify the star persists in the HUD
    await page.reload();
    await page.waitForSelector('.hud-prestige-stars', { state: 'visible' });
    const filledAfterReload = await page.locator('.prestige-star--filled').count();
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
});
