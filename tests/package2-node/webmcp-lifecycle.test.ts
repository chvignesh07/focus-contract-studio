import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Package2ToolRegistry,
  type ModelContextLike,
  type RegisteredPackage2Tool,
} from '../../lib/webmcp/register.ts';

class FakeModelContext implements ModelContextLike {
  readonly tools = new Map<string, RegisteredPackage2Tool>();
  readonly registrationSignals: AbortSignal[] = [];

  async registerTool(
    tool: RegisteredPackage2Tool,
    options: { signal: AbortSignal },
  ): Promise<void> {
    if (this.tools.has(tool.name)) throw new Error(`duplicate ${tool.name}`);
    this.tools.set(tool.name, tool);
    this.registrationSignals.push(options.signal);
    options.signal.addEventListener('abort', () => this.tools.delete(tool.name), {
      once: true,
    });
  }
}

test('install, teardown, and reinstall preserve exactly two live registrations', async () => {
  const modelContext = new FakeModelContext();
  const registry = new Package2ToolRegistry({
    csrfToken: 'csrf',
    fetcher: async () => new Response('{}'),
  });
  await registry.install(modelContext);
  assert.deepEqual([...modelContext.tools.keys()], [
    'read_active_focus_review',
    'create_focus_contract_proposal',
  ]);
  const firstSignals = [...modelContext.registrationSignals];
  await registry.install(modelContext);
  assert.equal(firstSignals.every((signal) => signal.aborted), true);
  assert.equal(modelContext.tools.size, 2);
  registry.dispose();
  assert.equal(modelContext.tools.size, 0);
});

test('failed second registration aborts the first and call cancellation reaches fetch', async () => {
  const failing: ModelContextLike = {
    registerTool: async (tool, { signal }) => {
      if (tool.name === 'create_focus_contract_proposal') throw new Error('injected');
      signal.addEventListener('abort', () => undefined, { once: true });
    },
  };
  const failedRegistry = new Package2ToolRegistry({
    csrfToken: 'csrf',
    fetcher: async () => new Response('{}'),
  });
  await assert.rejects(failedRegistry.install(failing));
  assert.equal(failedRegistry.installed, false);

  let observedSignal: AbortSignal | undefined;
  const pendingRegistry = new Package2ToolRegistry({
    csrfToken: 'csrf',
    fetcher: async (_request, init) => {
      observedSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        observedSignal?.addEventListener(
          'abort',
          () => reject(new DOMException('cancelled', 'AbortError')),
          { once: true },
        );
      });
    },
  });
  const modelContext = new FakeModelContext();
  await pendingRegistry.install(modelContext);
  const controller = new AbortController();
  const pending = modelContext.tools
    .get('read_active_focus_review')!
    .execute({}, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(observedSignal, controller.signal);
});
