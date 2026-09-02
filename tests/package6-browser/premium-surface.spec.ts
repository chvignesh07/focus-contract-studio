import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

type Profile = {
  name: string;
  physicalWidth: number;
  physicalHeight: number;
  zoom: 1 | 2;
};

async function expectNoSeriousAxeViolations(page: Page) {
  const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(
    ({ impact }) => impact === 'critical' || impact === 'serious',
  );
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

async function configureProfile(page: Page, profile: Profile) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (profile.zoom === 1) {
    await page.setViewportSize({
      width: profile.physicalWidth,
      height: profile.physicalHeight,
    });
    return;
  }
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setDeviceMetricsOverride', {
    width: profile.physicalWidth / profile.zoom,
    height: profile.physicalHeight / profile.zoom,
    deviceScaleFactor: profile.zoom,
    mobile: false,
  });
}

async function activateByKeyboard(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.focus();
  if (!await locator.evaluate((element) => element === document.activeElement)) {
    await locator.focus();
  }
  await expect(locator).toBeFocused();
  await locator.press('Enter');
}

async function capture(page: Page, profile: Profile, state: string) {
  const directory = process.env.FCS_PACKAGE6_VISUAL_DIR;
  if (!directory) return;
  const profileName = profile.name.replace(/[^a-z0-9]+/giu, '-').replace(/^-|-$/gu, '');
  const screenshotPath = `${directory}/${profileName}-${state}.png`;
  if (profile.zoom === 2) {
    const session = await page.context().newCDPSession(page);
    const screenshot = await session.send('Page.captureScreenshot', {
      captureBeyondViewport: false,
      format: 'png',
      fromSurface: true,
    });
    await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  } else {
    await page.screenshot({ animations: 'disabled', path: screenshotPath });
  }
  if (profile.zoom === 2) await configureProfile(page, profile);
}

async function expectReflowAndTargets(page: Page) {
  const pageGeometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(pageGeometry.scrollWidth).toBeLessThanOrEqual(pageGeometry.clientWidth + 1);
  expect(pageGeometry.bodyWidth).toBeLessThanOrEqual(pageGeometry.clientWidth + 1);

  const twoDimensional = await page.locator('.table-scroll, .stage-rail').evaluateAll(
    (elements) => elements.map((element) => ({
      name: element.className,
      horizontal: element.scrollWidth > element.clientWidth + 1,
      vertical: element.scrollHeight > element.clientHeight + 1,
    })),
  );
  for (const container of twoDimensional) {
    expect(container.horizontal && container.vertical, container.name).toBe(false);
  }

  const controls = page.locator(
    'button:visible:not(:disabled), a:visible, textarea:visible:not(:disabled), input:visible:not(:disabled)',
  );
  for (let index = 0; index < await controls.count(); index += 1) {
    const locator = controls.nth(index);
    await locator.focus();
    const control = await locator.evaluate((element) => {
      const current = element as HTMLElement;
      const target = current instanceof HTMLInputElement && current.type === 'checkbox'
        ? current.closest('label') ?? current
        : current;
      const targetRectangle = target.getBoundingClientRect();
      const rectangle = current.getBoundingClientRect();
      const x = Math.max(0, Math.min(innerWidth - 1, rectangle.left + rectangle.width / 2));
      const y = Math.max(0, Math.min(innerHeight - 1, rectangle.top + rectangle.height / 2));
      const hit = document.elementFromPoint(x, y);
      return {
        id: current.id || current.textContent?.trim() || current.getAttribute('aria-label') || current.tagName,
        left: rectangle.left,
        top: rectangle.top,
        right: rectangle.right,
        bottom: rectangle.bottom,
        targetWidth: targetRectangle.width,
        targetHeight: targetRectangle.height,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        unobscured: hit === current || current.contains(hit),
      };
    });
    expect(control.targetWidth, control.id).toBeGreaterThanOrEqual(44);
    expect(control.targetHeight, control.id).toBeGreaterThanOrEqual(44);
    expect(control.left, control.id).toBeGreaterThanOrEqual(-1);
    expect(control.top, control.id).toBeGreaterThanOrEqual(-1);
    expect(control.right, control.id).toBeLessThanOrEqual(control.viewportWidth + 1);
    expect(control.bottom, control.id).toBeLessThanOrEqual(control.viewportHeight + 1);
    expect(control.unobscured, control.id).toBe(true);
  }
}

async function expectNativeModalIsolation(page: Page, dialog: Locator) {
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  const descriptionId = await dialog.getAttribute('aria-describedby');
  expect(descriptionId).toBeTruthy();
  await expect(page.locator(`#${descriptionId!}`)).toBeVisible();
  const isolation = await page.evaluate(() => {
    const background = document.querySelector<HTMLElement>('.brand')!;
    const state = window as Window & {
      __backgroundClicks?: number;
      __backgroundPoint?: { x: number; y: number };
    };
    state.__backgroundClicks = 0;
    background.addEventListener('click', () => { state.__backgroundClicks! += 1; }, { once: true });
    const rectangle = background.getBoundingClientRect();
    state.__backgroundPoint = {
      x: rectangle.left + rectangle.width / 2,
      y: rectangle.top + rectangle.height / 2,
    };
    background.focus();
    return {
      focusRejected: document.activeElement !== background,
      focusStayedInModal: Boolean(
        document.querySelector('dialog:modal')?.contains(document.activeElement),
      ),
    };
  });
  expect(isolation.focusRejected).toBe(true);
  expect(isolation.focusStayedInModal).toBe(true);
  const point = await page.evaluate(() =>
    (window as Window & { __backgroundPoint?: { x: number; y: number } }).__backgroundPoint!,
  );
  await page.mouse.click(point.x, point.y);
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() =>
    (window as Window & { __backgroundClicks?: number }).__backgroundClicks,
  )).toBe(0);
}

async function completeJourney(page: Page, profile: Profile) {
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
  await expect(page.getByRole('heading', { name: 'Govern one real focus decision' })).toBeVisible();
  const truth = page.getByRole('region', { name: 'Current focus decision truth' });
  await expect(truth).toContainText('IMPLEMENTED REVISION 1');
  await expect(truth).toContainText('D001');
  await expect(truth).toContainText('NOT APPLIED');
  await expect(page.getByText('Only an exact human review can authorize apply.')).toBeVisible();
  await expect(truth).toContainText('Fresh finalized raw keyboard/focus events');
  await expect(truth).toContainText('cannot authorize apply, manufacture events, or prove WCAG/general conformance');
  await expect(page.getByRole('navigation', { name: 'Governed workflow stages' }).getByRole('link')).toHaveCount(6);
  await expect(page.locator('[data-operation-state="unsupportedWebMCP"]')).toContainText(
    'complete human workflow remains available',
  );
  await capture(page, profile, 'initial');
  if (profile.name === 'desktop') {
    await expect(page.getByRole('heading', { name: 'Live delete-account dialog' })).toBeInViewport();
    await expect(page.getByRole('heading', { name: 'DECISION MISMATCH' })).toBeInViewport();
  }
  await expectReflowAndTargets(page);
  await expectNoSeriousAxeViolations(page);

  await activateByKeyboard(page.getByRole('tab', { name: 'Danger-emphasis' }));
  await expect(page.getByRole('tab', { name: 'Danger-emphasis', selected: true })).toBeVisible();
  await expect(truth).toContainText('IMPLEMENTED REVISION 1');
  if (profile.name === 'desktop') await capture(page, profile, 'danger-variant');
  await activateByKeyboard(page.getByRole('tab', { name: 'Standard' }));
  await expect(page.getByRole('tab', { name: 'Standard', selected: true })).toBeVisible();

  await activateByKeyboard(page.getByRole('button', { name: 'Run opening rehearsal' }));
  const openingDialog = page.getByRole('dialog', { name: 'Delete account' });
  await expect(openingDialog).toBeVisible();
  await expect(page.locator('#delete-button')).toBeFocused();
  if (profile.name === 'desktop') await capture(page, profile, 'opening-dialog');
  await expectNativeModalIsolation(page, openingDialog);
  await page.keyboard.press('Escape');
  await expect(openingDialog).toBeHidden();
  await expect(page.locator('#delete-trigger')).toBeFocused();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  await expect(page.locator('#delete-trigger')).toBeFocused();
  await expect(page.getByRole('status')).toContainText('Browser report recorded');

  await activateByKeyboard(page.getByRole('button', { name: 'Create Cancel proposal' }));
  const authority = page.getByRole('heading', { name: 'Complete exact authority' }).locator('..');
  await expect(authority).toContainText('NOT APPLIED · proposed');
  await expect(authority).toContainText('D001 · Cancel button');
  if (profile.name === 'desktop') {
    await authority.scrollIntoViewIfNeeded();
    await capture(page, profile, 'proposal-not-applied');
  }
  const acknowledgement = authority.getByRole('checkbox', {
    name: 'I reviewed this exact proposal and revision',
  });
  await expect(authority.getByRole('button', { name: 'Approve exact proposal' })).toBeDisabled();
  await acknowledgement.check();
  await activateByKeyboard(authority.getByRole('button', { name: 'Approve exact proposal' }));
  await expect(page.getByRole('button', { name: 'Confirm approve' })).toBeFocused();
  if (profile.name === 'desktop') await capture(page, profile, 'review-confirmation');
  await activateByKeyboard(page.getByRole('button', { name: 'Confirm approve' }));
  await expect(page.getByRole('button', { name: 'Apply approved proposal' })).toBeVisible();
  await expect(truth).toContainText('IMPLEMENTED REVISION 1');

  await activateByKeyboard(page.getByRole('button', { name: 'Apply approved proposal' }));
  await activateByKeyboard(page.getByRole('button', { name: 'Confirm apply' }));
  const uncertainStatus = page.getByRole('status');
  await expect(uncertainStatus).toContainText('OUTCOME UNCERTAIN — RECOVERING RECEIPT');
  await expect(truth).toContainText('IMPLEMENTED REVISION 1');
  if (profile.name === 'desktop') {
    await uncertainStatus.scrollIntoViewIfNeeded();
    await capture(page, profile, 'uncertain-recovery');
  }
  await activateByKeyboard(page.getByRole('button', { name: 'Confirm apply' }));

  const receiptDialog = page.getByRole('dialog', { name: 'Application committed' });
  await expect(receiptDialog).toBeVisible();
  await expect(receiptDialog.getByRole('button', { name: 'Close receipt' })).toBeFocused();
  await expect(receiptDialog).toContainText('advanced revision 1 to 2');
  await expectNativeModalIsolation(page, receiptDialog);
  if (profile.name === 'desktop') await capture(page, profile, 'application-receipt');
  await activateByKeyboard(receiptDialog.getByRole('button', { name: 'Copy receipt' }));
  await expect(page.getByRole('status')).toContainText('Application receipt copied');
  await activateByKeyboard(receiptDialog.getByRole('button', { name: 'Start revision-2 rehearsal' }));

  const dialog = page.getByRole('dialog', { name: 'Delete account' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#cancel-button')).toBeFocused();
  if (profile.name === 'desktop') await capture(page, profile, 'revision-2-dialog');
  await expectNativeModalIsolation(page, dialog);
  await page.locator('#cancel-button').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#reason-input')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#cancel-button')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#delete-button')).toBeFocused();
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

  const verification = page.getByRole('region', { name: 'Fresh raw rehearsal verification' });
  await expect(verification).toContainText('Overall result: pass');
  await expect(verification).toContainText('Implemented revision 2');
  await expect(verification).toContainText('reviewed application → verification receipt');
  await expect(verification.locator('.verification-check')).toHaveCount(6);
  for (const row of await verification.locator('.verification-check').all()) {
    await expect(row).toContainText('Raw event sequences: #');
  }
  await expect(verification).toContainText('does not prove approval, biological-human action, WCAG conformance, or general safety');
  if (profile.name === 'desktop') {
    await verification.scrollIntoViewIfNeeded();
    await capture(page, profile, 'verified-history');
  }
  await expectNoSeriousAxeViolations(page);

  const history = page.getByRole('heading', { name: 'Chronological committed state' }).locator('..');
  await expect(history).toContainText('application');
  await expect(history).toContainText('verification');
  await expect(history).toContainText('projection');
  const timestamps = await history.locator('time').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('datetime')!),
  );
  expect(timestamps).toEqual([...timestamps].sort());

  await page.reload();
  await expect(page.getByRole('article', { name: 'Permanent application receipt' })).toContainText('Revision 1 → 2');
  await activateByKeyboard(page.getByRole('button', { name: 'Undo to revision 1' }));
  await expect(page.getByRole('button', { name: 'Confirm undo' })).toBeFocused();
  if (profile.name === 'desktop') await capture(page, profile, 'undo-confirmation');
  await activateByKeyboard(page.getByRole('button', { name: 'Confirm undo' }));
  await expect(truth).toContainText('IMPLEMENTED REVISION 3');
  await expect(page.getByRole('status')).toContainText('Earlier approval remains invalid');
  if (profile.name === 'desktop') await capture(page, profile, 'undo-committed');

  await activateByKeyboard(page.getByRole('button', { name: 'Reset this workspace' }));
  await expect(page.getByRole('button', { name: 'Confirm reset' })).toBeFocused();
  if (profile.name === 'desktop') await capture(page, profile, 'reset-confirmation');
  await activateByKeyboard(page.getByRole('button', { name: 'Confirm reset' }));
  await expect(truth).toContainText('IMPLEMENTED REVISION 1');
  await expect(page.getByRole('status')).toContainText('Workspace reset recovered generation');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Chronological committed state' }).locator('..')).toContainText('WORKSPACE_RESET');
  await capture(page, profile, 'reset-complete');

  const focusStyle = await page.getByRole('button', { name: 'Create Cancel proposal' }).evaluate((element) => {
    element.focus();
    const style = getComputedStyle(element);
    return { outlineWidth: style.outlineWidth, transitionDuration: style.transitionDuration };
  });
  expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThanOrEqual(3);
  expect(Number.parseFloat(focusStyle.transitionDuration)).toBeLessThan(0.01);
  await expectReflowAndTargets(page);
  await expectNoSeriousAxeViolations(page);
}

for (const profile of [
  { name: 'desktop', physicalWidth: 1280, physicalHeight: 900, zoom: 1 },
  { name: '320px', physicalWidth: 320, physicalHeight: 900, zoom: 1 },
  { name: '375px', physicalWidth: 375, physicalHeight: 900, zoom: 1 },
  { name: '640 CSS px at DPR 2', physicalWidth: 1280, physicalHeight: 900, zoom: 2 },
] as const) {
  test(`${profile.name} completes the human workflow with WebMCP unavailable`, async ({ page }) => {
    await configureProfile(page, profile);
    await completeJourney(page, profile);
    const metrics = await page.evaluate(() => ({
      cssZoom: document.documentElement.style.zoom,
      devicePixelRatio,
      innerWidth,
    }));
    expect(metrics.cssZoom).toBe('');
    expect(metrics.innerWidth).toBe(profile.physicalWidth / profile.zoom);
    expect(metrics.devicePixelRatio).toBe(profile.zoom);
  });
}
