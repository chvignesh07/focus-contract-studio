import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

async function expectNoSeriousAxeViolations(page: Page) {
  const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(
    ({ impact }) => impact === 'critical' || impact === 'serious',
  );
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

async function expectFocusedControlsInsideViewport(scope: Page | Locator) {
  const results = await scope
    .locator('button:visible:not(:disabled), a:visible, textarea:visible:not(:disabled)')
    .evaluateAll((elements) => elements.map((element) => {
      const control = element as HTMLElement;
      control.focus({ preventScroll: false });
      const rectangle = control.getBoundingClientRect();
      const x = Math.max(0, Math.min(innerWidth - 1, rectangle.left + rectangle.width / 2));
      const y = Math.max(0, Math.min(innerHeight - 1, rectangle.top + rectangle.height / 2));
      const hit = document.elementFromPoint(x, y);
      return {
        id: control.id || control.textContent?.trim() || control.tagName,
        left: rectangle.left, top: rectangle.top, right: rectangle.right,
        bottom: rectangle.bottom, width: rectangle.width, height: rectangle.height,
        viewportWidth: innerWidth, viewportHeight: innerHeight,
        unobscured: hit === control || control.contains(hit),
      };
    }));
  for (const result of results) {
    expect(result.width, result.id).toBeGreaterThan(0);
    expect(result.height, result.id).toBeGreaterThan(0);
    expect(result.left, result.id).toBeGreaterThanOrEqual(-1);
    expect(result.top, result.id).toBeGreaterThanOrEqual(-1);
    expect(result.right, result.id).toBeLessThanOrEqual(result.viewportWidth + 1);
    expect(result.bottom, result.id).toBeLessThanOrEqual(result.viewportHeight + 1);
    expect(result.unobscured, result.id).toBe(true);
  }
}

async function activateByKeyboard(locator: Locator) {
  await locator.focus();
  await expect(locator).toBeFocused();
  await locator.press('Enter');
}

async function configureProfile(
  page: Page,
  profile: { width: number; height: number; zoom: number },
) {
  await page.setViewportSize({ width: profile.width, height: profile.height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

async function applyZoom(page: Page, zoom: number) {
  if (zoom !== 1) {
    await page.evaluate((value) => { document.documentElement.style.zoom = String(value); }, zoom);
  }
}

async function completePackage5Journey(page: Page, profileName: string, zoom: number) {
  let droppedCommittedApply = false;
  await page.route('**/api/focus-proposals/*/apply', async (route) => {
    if (!droppedCommittedApply) {
      droppedCommittedApply = true;
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      await route.abort('failed');
      return;
    }
    await route.continue();
  });

  await page.goto('/');
  await applyZoom(page, zoom);
  await expect(page.getByText('IMPLEMENTED REVISION 1', { exact: true })).toBeVisible();
  await expect(page.getByText('DECISION MISMATCH')).toBeVisible();
  await expect(page.getByText('PRECEDENT: CANCEL')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expectFocusedControlsInsideViewport(page);
  await expectNoSeriousAxeViolations(page);

  await activateByKeyboard(page.getByRole('button', { name: 'Run opening rehearsal' }));
  const openingDialog = page.getByRole('dialog', { name: 'Delete account' });
  await expect(openingDialog).toBeVisible();
  await expect(page.locator('#delete-button')).toBeFocused();
  await expect(page.locator('#delete-button')).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(openingDialog).toBeHidden();
  await expect(page.getByRole('status')).toContainText('Browser report recorded');

  await activateByKeyboard(page.getByRole('button', { name: 'Create Cancel proposal' }));
  const authority = page.getByRole('heading', { name: 'Complete exact authority' }).locator('..');
  await expect(authority).toContainText('NOT APPLIED · proposed');
  await expect(authority.locator('code').first()).toHaveText(/^[0-9a-f]{64}$/u);
  await expect(authority).toContainText('Base revision1');
  await expect(authority).toContainText('EVIDENCE ONLY — NEVER APPROVAL');
  await page.reload();
  await applyZoom(page, zoom);
  await expect(page.getByRole('heading', { name: 'Complete exact authority' }).locator('..')).toContainText('NOT APPLIED · proposed');

  await activateByKeyboard(page.getByRole('button', { name: 'Approve exact proposal' }));
  await expect(page.getByRole('heading', { name: 'Confirm approve' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm approve' })).toBeFocused();
  await activateByKeyboard(page.getByRole('button', { name: 'Confirm approve' }));
  await expect(page.getByRole('button', { name: 'Apply approved proposal' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Approve committed');
  await expect(page.getByText('IMPLEMENTED REVISION 1', { exact: true })).toBeVisible();

  await activateByKeyboard(page.getByRole('button', { name: 'Apply approved proposal' }));
  await expect(page.getByRole('button', { name: 'Confirm apply' })).toBeFocused();
  await activateByKeyboard(page.getByRole('button', { name: 'Confirm apply' }));
  await expect(page.getByRole('status')).toContainText('outcome is uncertain');
  await expect(page.getByText('IMPLEMENTED REVISION 1', { exact: true })).toBeVisible();
  await activateByKeyboard(page.getByRole('button', { name: 'Confirm apply' }));

  const receipt = page.getByRole('dialog', { name: 'Application committed' });
  await expect(receipt).toBeVisible();
  await expect(receipt.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expect(receipt).toContainText('advanced revision 1 to 2');
  await expectNoSeriousAxeViolations(page);
  await activateByKeyboard(receipt.getByRole('button', { name: 'Cancel' }));
  await expect(page.getByText('IMPLEMENTED REVISION 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chronological committed state' }).locator('..')).toContainText('revision 1 → 2');

  await page.reload();
  await applyZoom(page, zoom);
  await expect(page.getByText('IMPLEMENTED REVISION 2', { exact: true })).toBeVisible();
  await expect(page.getByText('Configured initial focus').locator('..')).toContainText('Cancel');
  await activateByKeyboard(page.getByRole('button', { name: 'Run complete rehearsal' }));
  const dialog = page.getByRole('dialog', { name: 'Delete account' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('#cancel-button')).toBeFocused();
  await expect(page.locator('#cancel-button')).toBeInViewport();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#reason-input')).toBeFocused();
  await expect(page.locator('#reason-input')).toBeInViewport();
  await page.keyboard.press('Tab');
  await expect(page.locator('#cancel-button')).toBeFocused();
  await expect(page.locator('#cancel-button')).toBeInViewport();
  await page.keyboard.press('Tab');
  await expect(page.locator('#delete-button')).toBeFocused();
  await expect(page.locator('#delete-button')).toBeInViewport();
  await page.keyboard.press('Tab');
  await expect(page.locator('#reason-input')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#cancel-button')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#reason-input')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#delete-button')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#delete-trigger')).toBeFocused();

  const verification = page.getByRole('region', { name: 'Raw rehearsal verification' });
  await expect(verification).toContainText('Overall result: pass');
  await expect(verification).toContainText('Runtime precedent projected: 1');
  await expect(verification.locator('.verification-check')).toHaveCount(6);
  await expect(verification).toContainText('Implemented revision 2');
  await expect(page.getByRole('heading', { name: 'Chronological committed state' }).locator('..')).toContainText('projected');
  await page.reload();
  await applyZoom(page, zoom);
  await expect(page.getByRole('region', { name: 'Raw rehearsal verification' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Chronological committed state' }).locator('..')).toContainText('projected');

  await activateByKeyboard(page.getByRole('button', { name: 'Undo to revision 1' }));
  await expect(page.getByRole('button', { name: 'Confirm undo' })).toBeFocused();
  await activateByKeyboard(page.getByRole('button', { name: 'Confirm undo' }));
  await expect(page.getByText('IMPLEMENTED REVISION 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Earlier approval remains invalid');
  await expect(page.getByRole('button', { name: 'Apply approved proposal' })).toHaveCount(0);
  await expect(page.getByText('IMPLEMENTED REVISION 3', { exact: true })).toBeVisible();
  await page.reload();
  await applyZoom(page, zoom);
  await expect(page.getByText('IMPLEMENTED REVISION 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply approved proposal' })).toHaveCount(0);

  await activateByKeyboard(page.getByRole('button', { name: 'Reset this workspace' }));
  await expect(page.getByRole('button', { name: 'Confirm reset' })).toBeFocused();
  await activateByKeyboard(page.getByRole('button', { name: 'Confirm reset' }));
  await expect(page.getByText('IMPLEMENTED REVISION 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Workspace reset recovered generation');
  await expect(page.getByRole('heading', { name: 'Complete exact authority' })).toHaveCount(0);
  await page.reload();
  await applyZoom(page, zoom);
  await expect(page.getByText('IMPLEMENTED REVISION 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chronological committed state' }).locator('..')).toContainText('WORKSPACE_RESET');
  await expectFocusedControlsInsideViewport(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const transitionDuration = await page.getByRole('button', { name: 'Create Cancel proposal' })
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(transitionDuration), profileName).toBeLessThan(0.01);
  await expectNoSeriousAxeViolations(page);
}

for (const profile of [
  { name: 'desktop', width: 1280, height: 900, zoom: 1 },
  { name: '320px', width: 320, height: 900, zoom: 1 },
  { name: '375px', width: 375, height: 900, zoom: 1 },
  { name: '200% browser zoom', width: 1280, height: 900, zoom: 2 },
]) {
  test(`${profile.name} completes review → apply recovery → verify → undo → reset`, async ({ page }) => {
    await configureProfile(page, profile);
    await completePackage5Journey(page, profile.name, profile.zoom);
    expect(await page.evaluate(() => document.documentElement.style.zoom || '1')).toBe(String(profile.zoom));
    expect(await page.evaluate(() => innerWidth)).toBe(profile.width);
  });
}
