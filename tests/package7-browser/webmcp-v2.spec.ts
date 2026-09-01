import { expect, test } from '@playwright/test';

test('top-level imperative WebMCP exposes exactly four fresh bounded tools', async ({ page }) => {
  await page.addInitScript(() => {
    const state = {
      tools: {} as Record<string, unknown>,
      aborted: 0,
      topLevel: window.top === window,
    };
    Object.defineProperty(window, '__fcsWebMcpTest', { value: state });
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool: async (tool: { name: string }, { signal }: { signal: AbortSignal }) => {
          if (tool.name in state.tools) throw new Error(`duplicate ${tool.name}`);
          state.tools[tool.name] = tool;
          signal.addEventListener('abort', () => {
            delete state.tools[tool.name];
            state.aborted += 1;
          }, { once: true });
        },
      },
    });
  });
  await page.goto('/');
  await expect(page.getByText('Four bounded Site tools are registered for this page.')).toBeVisible();

  const contract = await page.evaluate(async () => {
    const state = (window as typeof window & {
      __fcsWebMcpTest: {
        tools: Record<string, {
          name: string;
          description: string;
          inputSchema: Record<string, unknown>;
          annotations: Record<string, boolean>;
          execute: (input: unknown, context: { signal: AbortSignal }) => Promise<unknown>;
        }>;
        aborted: number;
        topLevel: boolean;
      };
    }).__fcsWebMcpTest;
    const names = Object.keys(state.tools);
    const result = await state.tools.read_active_focus_review!.execute({}, {
      signal: new AbortController().signal,
    });
    return {
      names,
      topLevel: state.topLevel,
      definitions: names.map((name) => {
        const tool = state.tools[name]!;
        return {
          name: tool.name,
          keys: Object.keys(tool),
          descriptionLength: tool.description.length,
          additionalProperties: tool.inputSchema.additionalProperties,
          schema: tool.inputSchema.$schema,
          annotations: tool.annotations,
        };
      }),
      result,
      resultLength: JSON.stringify(result).length,
    };
  });
  expect(contract.topLevel).toBe(true);
  expect(contract.names).toEqual([
    'read_active_focus_review',
    'create_focus_contract_proposal',
    'apply_approved_focus_contract',
    'verify_focus_contract',
  ]);
  expect(contract.names).not.toContain('package0_site_tool_probe');
  for (const definition of contract.definitions) {
    expect(definition.keys).not.toContain('exposedTo');
    expect(definition.descriptionLength).toBeLessThanOrEqual(500);
    expect(definition.additionalProperties).toBe(false);
    expect(definition.schema).toBe('http://json-schema.org/draft-07/schema#');
  }
  expect(contract.definitions.map(({ annotations }) => annotations)).toEqual([
    { readOnlyHint: true, untrustedContentHint: true },
    { readOnlyHint: false, untrustedContentHint: true },
    { readOnlyHint: false, untrustedContentHint: false },
    { readOnlyHint: false, untrustedContentHint: false },
  ]);
  expect(contract.result).toMatchObject({
    ok: true,
    contractVersion: 'fcs-webmcp-v2',
    review: { implementedRevision: 1 },
  });
  expect(contract.resultLength).toBeLessThanOrEqual(1_500);

  await page.getByRole('tab', { name: 'Danger-emphasis' }).click();
  await expect(page.getByRole('tab', { name: 'Danger-emphasis', selected: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const state = (window as typeof window & {
      __fcsWebMcpTest: { tools: Record<string, unknown>; aborted: number };
    }).__fcsWebMcpTest;
    return { names: Object.keys(state.tools), aborted: state.aborted };
  })).toEqual({ names: contract.names, aborted: 4 });
});

test('ordinary browsers retain the visible complete human path', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-operation-state="unsupportedWebMCP"]')).toContainText(
    'complete human workflow remains available',
  );
  await expect(page.getByRole('navigation', { name: 'Governed workflow stages' })
    .getByRole('link')).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Run opening rehearsal' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Create Cancel proposal' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Reset this workspace' })).toBeEnabled();
});
