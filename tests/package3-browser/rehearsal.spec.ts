import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

async function expectFocusedControlsInsideViewport(scope: Page | Locator) {
  const results = await scope
    .locator('button:visible, a:visible, textarea:visible')
    .evaluateAll((elements) =>
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

async function completeRehearsal(page: Page) {
  await page.getByRole('button', { name: 'Run complete rehearsal' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete account' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  return page.getByRole('region', { name: 'Raw rehearsal verification' });
}

async function expectVisibleFocusContrast(page: Page) {
  const contrast = await page
    .getByRole('button', { name: 'Run complete rehearsal' })
    .evaluate((element) => {
      element.focus();
      const parse = (value: string) =>
        value.match(/[\d.]+/gu)?.slice(0, 3).map(Number) ?? [0, 0, 0];
      const luminance = (color: number[]) => {
        const channel = color.map((value) => {
          const normalized = value / 255;
          return normalized <= 0.04045
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channel[0]! + 0.7152 * channel[1]! + 0.0722 * channel[2]!;
      };
      const style = getComputedStyle(element);
      const foreground = luminance(parse(style.outlineColor));
      const background = luminance(parse(style.backgroundColor));
      return {
        ratio:
          (Math.max(foreground, background) + 0.05) /
          (Math.min(foreground, background) + 0.05),
        style: style.outlineStyle,
        width: Number.parseFloat(style.outlineWidth),
      };
    });
  expect(contrast.style).not.toBe('none');
  expect(contrast.width).toBeGreaterThanOrEqual(2);
  expect(contrast.ratio).toBeGreaterThanOrEqual(3);
}

test('real keyboard completes one raw rehearsal without destructive dispatch', async ({ page }) => {
  const sensitiveMarker = 'P3_PRIVATE_MARKER_DO_NOT_PERSIST_9f31';
  let finalizePayload = '';
  page.on('request', (request) => {
    if (/\/api\/rehearsals\/[0-9a-f-]+\/finalize$/u.test(request.url())) {
      finalizePayload = request.postData() ?? '';
    }
  });
  await page.goto('/');
  const startResponse = page.waitForResponse(
    (response) => response.url().endsWith('/api/rehearsals/start'),
  );
  await page.getByRole('button', { name: 'Run complete rehearsal' }).click();
  expect((await startResponse).status()).toBe(201);
  const dialog = page.getByRole('dialog', { name: 'Delete account' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleDescription(
    'Deleting your account is permanent. You can optionally tell us why.',
  );
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('#delete-button')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.locator('#reason-input')).toBeFocused();
  await page.keyboard.type(sensitiveMarker);
  await page.keyboard.press('Tab');
  await expect(page.locator('#cancel-button')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#delete-button')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#reason-input')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#delete-button')).toBeFocused();

  const finalizeResponse = page.waitForResponse(
    (response) => /\/api\/rehearsals\/[0-9a-f-]+\/finalize$/u.test(response.url()),
  );
  await page.keyboard.press('Escape');
  const finalized = await finalizeResponse;
  expect(finalized.status()).toBe(201);
  expect(finalizePayload).not.toContain(sensitiveMarker);
  expect(await finalized.text()).not.toContain(sensitiveMarker);
  await expect(dialog).toBeHidden();
  await expect(page.locator('#delete-trigger')).toBeFocused();
  const result = page.getByRole('region', { name: 'Raw rehearsal verification' });
  await expect(result).toContainText('Overall result: pass');
  await expect(result).toContainText('Implemented revision 1');
  await expect(result).toContainText('Environment: browser');
  await expect(result).toContainText('Dialog · open · modal');
  await expect(result).toContainText('Initial focus');
  await expect(result).toContainText('Focus order');
  await expect(result).toContainText('Forward Tab wrap');
  await expect(result).toContainText('Backward Shift+Tab wrap');
  await expect(result).toContainText('Escape action');
  await expect(result).toContainText('Return focus');
  await expect(result).toContainText('Sequences:');
  await expect(result).toContainText(/does not prove approval, general conformance, or human operation/i);
  await expect(result).not.toContainText(sensitiveMarker);
  await expect(page.getByText(/Synthetic demo only/)).toHaveCount(0);
});

test('open native dialog blocks background focus and pointer activation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Run complete rehearsal' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete account' });
  await expect(dialog).toBeVisible();
  const background = page.getByRole('button', { name: 'Create Cancel proposal' });
  await background.evaluate((element) => (element as HTMLElement).focus());
  await expect(page.locator('#delete-button')).toBeFocused();
  let proposalRequests = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/focus-proposals')) proposalRequests += 1;
  });
  const box = await background.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.waitForTimeout(50);
  expect(proposalRequests).toBe(0);
});

test('dialog has no serious or critical automated accessibility violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Run complete rehearsal' }).click();
  const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(
    ({ impact }) => impact === 'critical' || impact === 'serious',
  );
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});

for (const profile of [
  { name: 'desktop', width: 1280, height: 900, deviceScaleFactor: 1 },
  { name: '320px', width: 320, height: 900, deviceScaleFactor: 1 },
  { name: '375px', width: 375, height: 900, deviceScaleFactor: 1 },
  { name: '200% browser-scale emulation', width: 640, height: 450, deviceScaleFactor: 2 },
]) {
  test(`${profile.name} preserves one-dimensional reflow and unobscured focus through the result`, async ({
    page,
  }) => {
    if (profile.deviceScaleFactor === 1) {
      await page.setViewportSize({ width: profile.width, height: profile.height });
    } else {
      const client = await page.context().newCDPSession(page);
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: profile.width,
        height: profile.height,
        screenWidth: profile.width * profile.deviceScaleFactor,
        screenHeight: profile.height * profile.deviceScaleFactor,
        deviceScaleFactor: profile.deviceScaleFactor,
        mobile: false,
      });
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    expect(await page.evaluate(() => devicePixelRatio)).toBe(profile.deviceScaleFactor);
    expect(await page.evaluate(() => innerWidth)).toBe(profile.width);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
    await expectFocusedControlsInsideViewport(page);
    await expectVisibleFocusContrast(page);
    const result = await completeRehearsal(page);
    await expect(result).toContainText('Overall result: pass');
    await result.scrollIntoViewIfNeeded();
    await expect(result).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
    const transitionDuration = await page
      .getByRole('button', { name: 'Run complete rehearsal' })
      .evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(Number.parseFloat(transitionDuration)).toBeLessThan(0.01);
  });
}
