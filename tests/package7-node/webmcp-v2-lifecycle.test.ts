import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FcsWebMcpV2Registry,
  type FcsWebMcpV2ModelContextLike,
  type RegisteredFcsWebMcpV2Tool,
} from '../../lib/webmcp/register.ts';

class FakeModelContext implements FcsWebMcpV2ModelContextLike {
  readonly tools = new Map<string, RegisteredFcsWebMcpV2Tool>();
  readonly signals: AbortSignal[] = [];
  failOn: string | undefined;

  async registerTool(
    tool: RegisteredFcsWebMcpV2Tool,
    { signal }: { signal: AbortSignal },
  ): Promise<void> {
    if (tool.name === this.failOn) throw new Error('injected registration failure');
    if (this.tools.has(tool.name)) throw new Error(`duplicate ${tool.name}`);
    signal.throwIfAborted();
    this.tools.set(tool.name, tool);
    this.signals.push(signal);
    signal.addEventListener('abort', () => this.tools.delete(tool.name), { once: true });
  }
}

function registry(options: {
  pageKey: string;
  currentPageKey: () => string;
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}): FcsWebMcpV2Registry {
  return new FcsWebMcpV2Registry({
    csrfToken: 'csrf',
    pageKey: options.pageKey,
    currentPageKey: options.currentPageKey,
    fetcher: options.fetcher ?? (async () => new Response('{}')),
  });
}

test('duplicate install, HMR replacement, navigation, and teardown leave one four-tool singleton', async () => {
  const modelContext = new FakeModelContext();
  let pageKey = 'page:1';
  const first = registry({ pageKey, currentPageKey: () => pageKey });

  await first.install(modelContext);
  assert.deepEqual([...modelContext.tools.keys()], [
    'read_active_focus_review',
    'create_focus_contract_proposal',
    'apply_approved_focus_contract',
    'verify_focus_contract',
  ]);
  const firstSignals = [...modelContext.signals];

  await first.install(modelContext);
  assert.equal(firstSignals.every(({ aborted }) => aborted), true);
  assert.equal(modelContext.tools.size, 4);
  const secondSignals = modelContext.signals.slice(4);
  const oldRead = modelContext.tools.get('read_active_focus_review')!;

  pageKey = 'page:2';
  await assert.rejects(oldRead.execute({}, {
    signal: new AbortController().signal,
  }), { message: 'STALE_REVISION' });

  const replacement = registry({ pageKey, currentPageKey: () => pageKey });
  await replacement.install(modelContext);
  assert.equal(secondSignals.every(({ aborted }) => aborted), true);
  assert.equal(first.installed, false);
  assert.equal(replacement.installed, true);
  assert.equal(modelContext.tools.size, 4);

  first.dispose();
  assert.equal(modelContext.tools.size, 4);
  replacement.dispose();
  assert.equal(modelContext.tools.size, 0);
});

test('singleton replacement cancels an in-flight callback and a failed install fully recovers', async () => {
  const modelContext = new FakeModelContext();
  const currentPageKey = () => 'page:1';
  let observedSignal: AbortSignal | undefined;
  const first = registry({
    pageKey: 'page:1',
    currentPageKey,
    fetcher: async (_input, init) => {
      observedSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        observedSignal?.addEventListener('abort', () => {
          reject(new DOMException('cancelled', 'AbortError'));
        }, { once: true });
      });
    },
  });
  await first.install(modelContext);
  const pending = modelContext.tools.get('read_active_focus_review')!.execute({}, {
    signal: new AbortController().signal,
  });

  const replacement = registry({ pageKey: 'page:1', currentPageKey });
  await replacement.install(modelContext);
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(observedSignal?.aborted, true);
  assert.equal(first.installed, false);

  modelContext.failOn = 'verify_focus_contract';
  const failed = registry({ pageKey: 'page:1', currentPageKey });
  await assert.rejects(failed.install(modelContext), {
    message: 'injected registration failure',
  });
  assert.equal(failed.installed, false);
  assert.equal(modelContext.tools.size, 0);

  modelContext.failOn = undefined;
  const recovered = registry({ pageKey: 'page:1', currentPageKey });
  await recovered.install(modelContext);
  assert.equal(recovered.installed, true);
  assert.equal(modelContext.tools.size, 4);
  recovered.dispose();
});
