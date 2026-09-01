import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

type Profile = {
  name: string;
  physicalWidth: number;
  physicalHeight: number;
  zoom: 1 | 2;
};

const responsiveProfiles: Profile[] = [
  { name: '320px', physicalWidth: 320, physicalHeight: 760, zoom: 1 },
  { name: '375px', physicalWidth: 375, physicalHeight: 812, zoom: 1 },
  { name: 'true 200% zoom', physicalWidth: 1_280, physicalHeight: 900, zoom: 2 },
];

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

test('built page enforces nonce headers without breaking WebMCP, privacy, or accessibility', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { tools: [] as string[], violations: [] as string[] };
    Object.defineProperty(window, '__package8Security', { value: state });
    document.addEventListener('securitypolicyviolation', (event) => {
      state.violations.push(
        `${event.violatedDirective}:${event.blockedURI}:${event.sourceFile}:${event.lineNumber}`,
      );
    });
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool: async (tool: { name: string }, { signal }: { signal: AbortSignal }) => {
          state.tools.push(tool.name);
          signal.addEventListener('abort', () => {
            state.tools = state.tools.filter((name) => name !== tool.name);
          }, { once: true });
        },
      },
    });
  });

  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  const headers = response!.headers();
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['origin-agent-cluster']).toBe('?1');
  expect(headers['permissions-policy']).toBe(
    'camera=(), geolocation=(), microphone=(), payment=(), tools=(self)',
  );
  const csp = headers['content-security-policy'] ?? '';
  const nonce = /nonce-([^' ;]+)/u.exec(csp)?.[1];
  expect(nonce).toBeTruthy();
  expect(csp).not.toMatch(/\*|'unsafe-inline'|'unsafe-eval'|https?:/u);

  await expect(page.getByRole('heading', { name: 'Govern one real focus decision' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Privacy and public-demo limits' })).toBeVisible();
  const runtime = await page.evaluate((expectedNonce) => {
    const state = (window as unknown as Window & {
      __package8Security: { tools: string[]; violations: string[] };
    }).__package8Security;
    return {
      originAgentCluster: window.originAgentCluster,
      tools: state.tools,
      violations: state.violations,
      missingNonce: [...document.querySelectorAll('script, style')]
        .filter((element) => (element as HTMLScriptElement | HTMLStyleElement).nonce !== expectedNonce)
        .length,
    };
  }, nonce);
  expect(runtime.originAgentCluster).toBe(true);
  expect(runtime.tools).toEqual([
    'read_active_focus_review',
    'create_focus_contract_proposal',
    'apply_approved_focus_contract',
    'verify_focus_contract',
  ]);
  expect(runtime.missingNonce).toBe(0);
  expect(runtime.violations).toEqual([]);

  await expectNoSeriousAxeViolations(page);
});

for (const profile of responsiveProfiles) {
  test(`${profile.name} current surface reflows and preserves keyboard focus`, async ({ page }) => {
    await configureProfile(page, profile);
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Govern one real focus decision' })).toBeVisible();

    await page.keyboard.press('Tab');
    const brand = page.locator('.brand');
    await expect(brand).toBeFocused();
    const focusVisual = await brand.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(focusVisual.outlineStyle).not.toBe('none');
    expect(Number.parseFloat(focusVisual.outlineWidth)).toBeGreaterThanOrEqual(3);

    await expectReflowAndTargets(page);
    const opening = page.getByRole('button', { name: 'Run opening rehearsal' });
    await opening.focus();
    await opening.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Delete account' });
    await expect(dialog).toBeVisible();
    await expect(page.locator('#delete-button')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.locator('#delete-trigger')).toBeFocused();
    await expectNoSeriousAxeViolations(page);
  });
}
