import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PACKAGE0_TOOL_NAME,
  Package0ProbeRegistry,
} from '../../probes/webmcp/package0-tool.ts';

type RegisteredTool = {
  name: string;
  execute: (
    input: { mode: 'snapshot' | 'wait_for_cancel' },
    context: { signal: AbortSignal },
  ) => Promise<unknown>;
};

class FakeModelContext {
  readonly tools = new Map<string, RegisteredTool>();
  readonly registrationSignals: AbortSignal[] = [];

  async registerTool(
    tool: RegisteredTool,
    options: { signal: AbortSignal },
  ): Promise<void> {
    if (this.tools.has(tool.name)) {
      throw new Error(`duplicate tool: ${tool.name}`);
    }

    this.tools.set(tool.name, tool);
    this.registrationSignals.push(options.signal);
    options.signal.addEventListener(
      'abort',
      () => {
        this.tools.delete(tool.name);
      },
      { once: true },
    );
  }
}

test('registration abort removes the top-level probe tool', async () => {
  const modelContext = new FakeModelContext();
  const registry = new Package0ProbeRegistry();

  await registry.install(modelContext);
  assert.equal(modelContext.tools.has(PACKAGE0_TOOL_NAME), true);

  registry.dispose();
  assert.equal(modelContext.registrationSignals[0]?.aborted, true);
  assert.equal(modelContext.tools.size, 0);
});

test('reinstall aborts the prior registration before adding one replacement', async () => {
  const modelContext = new FakeModelContext();
  const registry = new Package0ProbeRegistry();

  await registry.install(modelContext);
  const firstSignal = modelContext.registrationSignals[0];
  await registry.install(modelContext);

  assert.equal(firstSignal?.aborted, true);
  assert.equal(modelContext.tools.size, 1);
  assert.equal(modelContext.registrationSignals.length, 2);
});

test('execute observes the invocation cancellation signal', async () => {
  const modelContext = new FakeModelContext();
  const registry = new Package0ProbeRegistry();
  await registry.install(modelContext);
  const tool = modelContext.tools.get(PACKAGE0_TOOL_NAME);
  assert.ok(tool);
  const callController = new AbortController();

  const pending = tool.execute(
    { mode: 'wait_for_cancel' },
    { signal: callController.signal },
  );
  callController.abort();

  await assert.rejects(pending, { name: 'AbortError' });
});

test('snapshot result is deterministic and stays below the 1500 character budget', async () => {
  const modelContext = new FakeModelContext();
  const registry = new Package0ProbeRegistry();
  await registry.install(modelContext);
  const tool = modelContext.tools.get(PACKAGE0_TOOL_NAME);
  assert.ok(tool);

  const result = await tool.execute(
    { mode: 'snapshot' },
    { signal: new AbortController().signal },
  );

  assert.deepEqual(result, {
    ok: true,
    probe: 'focus-contract-studio-package-0',
    lifecycle: 'registered',
    readOnly: true,
  });
  assert.ok(JSON.stringify(result).length <= 1_500);
});

test('execute rejects an unknown mode even if host schema validation is bypassed', async () => {
  const modelContext = new FakeModelContext();
  const registry = new Package0ProbeRegistry();
  await registry.install(modelContext);
  const tool = modelContext.tools.get(PACKAGE0_TOOL_NAME);
  assert.ok(tool);

  await assert.rejects(
    tool.execute(
      { mode: 'unknown' } as never,
      { signal: new AbortController().signal },
    ),
    { name: 'TypeError', message: 'Invalid Package 0 probe input' },
  );
});

test('execute rejects additional input properties at the callback boundary', async () => {
  const modelContext = new FakeModelContext();
  const registry = new Package0ProbeRegistry();
  await registry.install(modelContext);
  const tool = modelContext.tools.get(PACKAGE0_TOOL_NAME);
  assert.ok(tool);

  await assert.rejects(
    tool.execute(
      { mode: 'snapshot', extra: true } as never,
      { signal: new AbortController().signal },
    ),
    { name: 'TypeError', message: 'Invalid Package 0 probe input' },
  );
});
