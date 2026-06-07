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
        // App.jsx order: gold, lives, wave, speed, towers, enemies, gamePhase (index 6)
        let hookNode = fiber.memoizedState;
        let i = 0;
        while (hookNode && i < 6) {
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
 * App.jsx hook order: gold(0), lives(1), wave(2), speed(3), towers(4), enemies(5), gamePhase(6)
 */
async function setLivesAndPhase(page, livesValue, phase) {
  await page.evaluate(({ livesValue, phase }) => {
    const gameEl = document.querySelector('#game');
    const fiberKey = Object.keys(gameEl).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) throw new Error('React fiber not found — not a dev build?');
    let fiber = gameEl[fiberKey];
    while (fiber) {
      if (fiber.memoizedState && typeof fiber.type === 'function') {
        // index 1 = lives, index 6 = gamePhase
        let hookNode = fiber.memoizedState;
        let livesHook = null;
        let phaseHook = null;
        let i = 0;
        while (hookNode) {
          if (i === 1) livesHook = hookNode;
          if (i === 6) phaseHook = hookNode;
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
    // After restart, the game should be back to between-waves with NextWave overlay
    await expect(page.locator('.game-over-overlay')).not.toBeVisible();
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
    // Should be back to between-waves with NextWave overlay visible
    await expect(page.locator('.game-over-overlay')).not.toBeVisible();
    await expect(page.locator('.next-wave-overlay')).toBeVisible();
    // HUD should show lives = 20, gold = 100, wave = 1
    await expect(page.locator('.hud-lives')).toContainText('20');
    await expect(page.locator('.hud-gold')).toContainText('100');
    await expect(page.locator('.hud-wave')).toContainText('1');
  });
});
