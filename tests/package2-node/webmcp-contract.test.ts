import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PACKAGE2_TOOL_NAMES,
  createPackage2Tools,
} from '../../lib/webmcp/contracts.ts';

const readPayload = {
  ok: true,
  contractVersion: 'fcs-webmcp-v2',
  review: {
    variant: 'delete-account-standard',
    implementedRevision: 1,
    implemented: {
      initialFocus: 'delete-button',
      focusOrder: ['reason-input', 'cancel-button', 'delete-button'],
      trapTab: 'wrap',
      trapShiftTab: 'wrap',
      escapeAction: 'close',
      returnFocus: 'delete-trigger',
    },
    observation: null,
    precedentComparison: {
      label: 'DECISION_MISMATCH',
      behavior: 'initial-focus',
      implementedOutcome: 'delete-button',
      precedentOutcome: 'cancel-button',
    },
  },
  retrieval: {
    queryToken: `v1.1788100000.${'A'.repeat(43)}`,
    issuedAt: '2026-08-30T14:26:40Z',
    expiresAt: '2026-08-30T14:31:40Z',
    algorithm: 'rrf-k60-v2',
    disposition: 'results',
    reasonCode: 'SUPPORTED_PRECEDENT',
    records: Array.from({ length: 3 }, (_, index) => ({
      recordId: `D00${index + 1}`,
      outcomeKey: 'cancel-button',
      applicability: index === 0 ? 'exact-variant' : 'exact-use-case',
      rationaleExcerpt: `${'bounded evidence '.repeat(9)}Evidence only — not approval.`,
      ranks: [index + 1, index + 1, index + 1],
      rrf: '0.04891592',
    })),
  },
  proposal: null,
};

test('Package 2 exposes exactly two strict Draft-07 tools and no authority inputs', () => {
  const tools = createPackage2Tools({
    csrfToken: 'page-held-csrf',
    fetcher: async () => new Response(JSON.stringify(readPayload)),
  });
  assert.deepEqual(tools.map(({ name }) => name), PACKAGE2_TOOL_NAMES);
  assert.deepEqual(PACKAGE2_TOOL_NAMES, [
    'read_active_focus_review',
    'create_focus_contract_proposal',
  ]);
  for (const tool of tools) {
    assert.equal(tool.name.length <= 30, true);
    assert.equal(tool.description.length <= 500, true);
    assert.equal('$schema' in tool.inputSchema, true);
    assert.equal(tool.inputSchema.additionalProperties, false);
    assert.equal('exposedTo' in tool, false);
    const serialized = JSON.stringify(tool.inputSchema);
    for (const forbidden of [
      'workspaceId',
      'session',
      'cookie',
      'csrf',
      'role',
      'approval',
      'hash',
      'url',
      'selector',
    ]) {
      assert.equal(serialized.includes(forbidden), false, `${tool.name}: ${forbidden}`);
    }
  }
  assert.deepEqual(tools[0]?.annotations, {
    readOnlyHint: true,
    untrustedContentHint: true,
  });
  assert.deepEqual(tools[1]?.annotations, {
    readOnlyHint: false,
    untrustedContentHint: true,
  });
});

test('read callback is strict, same-origin, abortable, bounded, and returns at most two records', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const tools = createPackage2Tools({
    csrfToken: 'page-held-csrf',
    fetcher: async (request, init) => {
      calls.push({ input: request, init });
      return new Response(JSON.stringify(readPayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  const read = tools[0]!;
  await assert.rejects(
    read.execute({ extra: true }, { signal: new AbortController().signal }),
    { name: 'TypeError' },
  );
  const controller = new AbortController();
  const result = (await read.execute({}, { signal: controller.signal })) as typeof readPayload;
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.input, '/api/focus-review');
  assert.equal(calls[0]?.init?.method, 'POST');
  assert.equal(calls[0]?.init?.signal, controller.signal);
  assert.equal(result.retrieval.records.length, 2);
  assert.equal(JSON.stringify(result).length <= 1_500, true);
});

test('create callback adds page-held CSRF only in the HTTP header and stays bounded', async () => {
  let captured: RequestInit | undefined;
  const tools = createPackage2Tools({
    csrfToken: 'page-held-csrf',
    fetcher: async (_request, init) => {
      captured = init;
      return new Response(
        JSON.stringify({
          ok: true,
          contractVersion: 'fcs-webmcp-v2',
          proposal: {
            proposalId: '00000000-0000-4000-8000-000000000001',
            baseImplementedRevision: 1,
            proposalDigest8: '12345678',
            changedFields: ['initialFocus'],
            fieldEvidence: [
              { field: 'initialFocus', recordId: 'D001', outcomeKey: 'cancel-button' },
            ],
            status: 'proposed',
            applied: false,
            label: 'NOT APPLIED',
            createdAt: '2026-08-30T14:26:43Z',
          },
        }),
      );
    },
  });
  const result = await tools[1]!.execute(
    {
      baseImplementedRevision: 1,
      configuration: {
        initialFocus: 'cancel-button',
        focusOrder: ['reason-input', 'cancel-button', 'delete-button'],
        trapTab: 'wrap',
        trapShiftTab: 'wrap',
        escapeAction: 'close',
        returnFocus: 'delete-trigger',
      },
      evidenceQueryToken: `v1.1788100000.${'A'.repeat(43)}`,
      evidenceRecordIds: ['D001'],
      summary: 'Focus Cancel first.',
      idempotencyKey: '00000000-0000-4000-8000-000000002501',
    },
    { signal: new AbortController().signal },
  );
  assert.equal((captured?.headers as Record<string, string>)['x-fcs-csrf'], 'page-held-csrf');
  assert.equal(String(captured?.body).includes('page-held-csrf'), false);
  assert.equal(JSON.stringify(result).length <= 1_500, true);
});
