import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

async function expectNoSeriousAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  const blocking = result.violations.filter(
    ({ impact }) => impact === 'critical' || impact === 'serious',
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

async function expectFocusedControlsInsideViewport(scope: Page | Locator) {
  const results = await scope.locator('button:visible, a:visible, textarea:visible').evaluateAll(
    (elements) =>
      elements.map((element) => {
        const control = element as HTMLElement;
        control.focus({ preventScroll: false });
        const rectangle = control.getBoundingClientRect();
        const hit = document.elementFromPoint(
          Math.max(0, Math.min(innerWidth - 1, rectangle.left + rectangle.width / 2)),
          Math.max(0, Math.min(innerHeight - 1, rectangle.top + rectangle.height / 2)),
        );
        return {
          id: control.id || control.textContent?.trim() || control.tagName,
          left: rectangle.left,
          top: rectangle.top,
          right: rectangle.right,
          bottom: rectangle.bottom,
          width: rectangle.width,
          height: rectangle.height,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
          unobscured: hit === control || control.contains(hit),
        };
      }),
  );
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

test('fresh anonymous user completes Observe → Precedent → durable NOT APPLIED proposal', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('IMPLEMENTED REVISION 1', { exact: true })).toBeVisible();
  await expect(page.getByText('DECISION MISMATCH')).toBeVisible();
  await expect(page.getByText('PRECEDENT: CANCEL')).toBeVisible();
  await expect(
    page.getByText('EVIDENCE ONLY — NOT APPROVAL', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('D001')).toBeVisible();
  await expect(page.getByText(/Site tools are unavailable here/)).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  await expectFocusedControlsInsideViewport(page);

  const observation = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/observations/initial-focus') &&
      response.request().method() === 'POST',
  );
  await page.evaluate(() => {
    const calls: string[] = [];
    (window as unknown as { __fcsScriptFocusCalls: string[] }).__fcsScriptFocusCalls = calls;
    const nativeFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function instrumentedFocus(options?: FocusOptions) {
      calls.push(this.id);
      nativeFocus.call(this, options);
    };
  });
  await page.getByRole('button', { name: 'Run opening rehearsal' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete account' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toHaveAccessibleDescription(
    'Deleting your account is permanent. You can optionally tell us why.',
  );
  await expect(page.locator('#delete-button')).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __fcsScriptFocusCalls: string[] })
          .__fcsScriptFocusCalls,
    ),
  ).not.toContain('delete-button');
  expect(
    await dialog.locator('button, textarea').evaluateAll((elements) =>
      elements
        .filter((element) => !(element as HTMLButtonElement).disabled)
        .map((element) => element.id),
    ),
  ).toEqual(['reason-input', 'cancel-button', 'delete-button']);
  await expectFocusedControlsInsideViewport(dialog);
  const backgroundProposalButton = page.getByRole('button', {
    name: 'Create Cancel proposal',
  });
  await backgroundProposalButton.evaluate((element) =>
    (element as HTMLElement).focus(),
  );
  await expect(page.locator('#delete-button')).toBeFocused();
  expect(
    await backgroundProposalButton.evaluate((element) => {
      const rectangle = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rectangle.left + rectangle.width / 2,
        rectangle.top + rectangle.height / 2,
      );
      return hit !== element && !element.contains(hit);
    }),
  ).toBe(true);
  let backgroundProposalRequests = 0;
  page.on('request', (request) => {
    if (
      request.url().endsWith('/api/focus-proposals') &&
      request.method() === 'POST'
    ) {
      backgroundProposalRequests += 1;
    }
  });
  const backgroundBox = await backgroundProposalButton.boundingBox();
  expect(backgroundBox).not.toBeNull();
  await page.mouse.click(
    backgroundBox!.x + backgroundBox!.width / 2,
    backgroundBox!.y + backgroundBox!.height / 2,
  );
  await page.waitForTimeout(50);
  expect(backgroundProposalRequests).toBe(0);
  await page.locator('#delete-button').focus();
  await expect(page.locator('#delete-button')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#reason-input')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#delete-button')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#reason-input')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#cancel-button')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#delete-button')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#cancel-button')).toBeFocused();
  expect((await observation).status()).toBe(201);
  await expectNoSeriousAxeViolations(page);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('#delete-trigger')).toBeFocused();
  await expect(page.getByText('OBSERVED: DELETE')).toBeVisible();

  const proposalResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/focus-proposals') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create Cancel proposal' }).click();
  expect((await proposalResponse).status()).toBe(201);
  await expect(page.getByText('NOT APPLIED')).toBeVisible();
  const diff = page.getByRole('table', { name: 'Proposed focus change' });
  await expect(diff.getByText('Delete button')).toBeVisible();
  await expect(diff.getByText('Cancel button')).toBeVisible();
  await expect(page.getByText('IMPLEMENTED REVISION 1', { exact: true })).toBeVisible();
  await expect(page.getByText(/apply is intentionally unavailable/i)).toBeVisible();
  await expectNoSeriousAxeViolations(page);

  await page.reload();
  await expect(page.getByText('NOT APPLIED')).toBeVisible();
  await expect(page.getByText('IMPLEMENTED REVISION 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Proposed focus change' })).toBeVisible();
  await page.getByRole('button', { name: 'Run opening rehearsal' }).click();
  await expect(page.locator('#delete-button')).toBeFocused();
});

test('a deliberate autofocus divergence is reported and rejected, never repaired in client code', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('IMPLEMENTED REVISION 1', { exact: true })).toBeVisible();
  await page.locator('#delete-button').evaluate((element) => {
    element.removeAttribute('autofocus');
    document.querySelector('#reason-input')?.setAttribute('autofocus', '');
    const calls: string[] = [];
    (window as unknown as { __fcsScriptFocusCalls: string[] }).__fcsScriptFocusCalls = calls;
    const nativeFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function instrumentedFocus(options?: FocusOptions) {
      calls.push(this.id);
      nativeFocus.call(this, options);
    };
  });
  const observation = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/observations/initial-focus') &&
      response.request().method() === 'POST',
  );

  await page.getByRole('button', { name: 'Run opening rehearsal' }).click();

  await expect(page.locator('#reason-input')).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __fcsScriptFocusCalls: string[] })
          .__fcsScriptFocusCalls,
    ),
  ).not.toContain('delete-button');
  expect((await observation).status()).toBe(409);
  await expect(page.locator('.activity-status')).toContainText(
    'does not match the rendered revision',
  );
});

for (const width of [320, 375]) {
  test(`${width}px viewport has one-dimensional reflow and unobscured focused controls`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByText('IMPLEMENTED REVISION 1', { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
    await expectFocusedControlsInsideViewport(page);
    await page.getByRole('button', { name: 'Run opening rehearsal' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete account' });
    await expect(dialog).toBeVisible();
    await expectFocusedControlsInsideViewport(dialog);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
  });
}

test('200% layout zoom and reduced motion preserve the complete local review', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByText('IMPLEMENTED REVISION 1', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  ).toBe(true);
  await expect(
    page.getByText('EVIDENCE ONLY — NOT APPROVAL', { exact: true }),
  ).toBeVisible();
  await expectFocusedControlsInsideViewport(page);
  await page.getByRole('button', { name: 'Run opening rehearsal' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete account' });
  await expect(dialog).toBeVisible();
  await expectFocusedControlsInsideViewport(dialog);
  const transitionDuration = await page
    .getByRole('button', { name: 'Run opening rehearsal' })
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(transitionDuration)).toBeLessThan(0.01);
});
