import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { FocusContractStudio } from '../../app/focus-contract-studio.tsx';
import { REVISION_1_CONFIGURATION } from '../../lib/domain/focus-configuration.ts';
import type { RegisteredFcsWebMcpV2Tool } from '../../lib/webmcp/contracts.ts';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function pageHarness() {
  let variant: 'delete-account-standard' | 'delete-account-danger-emphasis' =
    'delete-account-standard';
  let viewRevision = 1;
  let implementedRevision = 1;
  let proposal: Record<string, unknown> | null = null;
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === '/api/session/bootstrap') {
      return json({
        ok: true,
        data: {
          generation: 7,
          csrfToken: 'page-csrf',
          activeVariant: { slug: variant, implementedRevision: 1, viewRevision },
        },
      }, 201);
    }
    if (url === '/api/focus-review') {
      return json({
        ok: true,
        contractVersion: 'fcs-webmcp-v2',
        review: {
          variant,
          implementedRevision,
          implemented: implementedRevision === 1
            ? REVISION_1_CONFIGURATION
            : {
                ...REVISION_1_CONFIGURATION,
                initialFocus: 'cancel-button',
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
          queryToken: `v1.1788500000.${'A'.repeat(43)}`,
          issuedAt: '2026-09-01T15:00:00Z',
          expiresAt: '2026-09-01T15:05:00Z',
          algorithm: 'rrf-k60-v2',
          disposition: 'results',
          reasonCode: 'SUPPORTED_PRECEDENT',
          records: [{
            recordId: 'D001',
            outcomeKey: 'cancel-button',
            sourceKind: 'synthetic-seed',
            validFrom: '2026-01-01T00:00:00Z',
            validUntil: null,
            applicability: 'exact-variant',
            lexicalRank: 1,
            structuredRank: 1,
            relationshipRank: 1,
            rrfContribution: '0.04918033',
            ranks: [1, 1, 1],
            rrf: '0.04918033',
            rationaleExcerpt: 'Cancel protects the escape path. Evidence only — not approval.',
          }],
        },
        proposal,
      });
    }
    if (url === '/api/focus-history') {
      return json({ ok: true, activeRevision: implementedRevision, records: [] });
    }
    if (url === '/api/focus-proposals') {
      proposal = {
        proposalId: '00000000-0000-4000-8000-000000007101',
        baseImplementedRevision: 1,
        proposalDigest8: '12345678',
        proposalDigest: '1'.repeat(64),
        changedFields: ['initialFocus'],
        fieldEvidence: [{
          field: 'initialFocus',
          recordId: 'D001',
          outcomeKey: 'cancel-button',
        }],
        status: 'proposed',
        applied: false,
        label: 'NOT APPLIED',
        configuration: {
          ...REVISION_1_CONFIGURATION,
          initialFocus: 'cancel-button',
        },
        summary: 'Focus Cancel first.',
        authorKind: 'agent',
        createdAt: '2026-09-04T06:15:01Z',
        parentProposalId: null,
      };
      return json({ ok: true, contractVersion: 'fcs-webmcp-v2', proposal }, 201);
    }
    if (url.endsWith('/apply')) {
      implementedRevision = 2;
      proposal = { ...proposal, status: 'applied', applied: true, label: 'APPLIED' };
      return json({
        ok: true,
        receipt: {
          receiptId: '00000000-0000-4000-8000-000000007103',
          proposalId: '00000000-0000-4000-8000-000000007101',
          proposalDigest8: '12345678',
          fromRevision: 1,
          toRevision: 2,
          result: 'applied',
          createdAt: '2026-09-04T06:15:02Z',
          replayed: false,
        },
      }, 201);
    }
    if (url === '/api/active-variant') {
      const body = JSON.parse(String(init?.body)) as { variant: typeof variant };
      variant = body.variant;
      viewRevision += 1;
      return json({ ok: true, data: { variant, viewRevision } });
    }
    throw new Error(`unexpected ${url}`);
  });
  return fetcher;
}

class ModelContext {
  readonly tools = new Map<string, RegisteredFcsWebMcpV2Tool>();
  readonly signals: AbortSignal[] = [];

  async registerTool(
    tool: RegisteredFcsWebMcpV2Tool,
    { signal }: { signal: AbortSignal },
  ): Promise<void> {
    if (this.tools.has(tool.name)) throw new Error(`duplicate ${tool.name}`);
    this.tools.set(tool.name, tool);
    this.signals.push(signal);
    signal.addEventListener('abort', () => this.tools.delete(tool.name), { once: true });
  }
}

afterEach(() => {
  delete (document as Document & { modelContext?: unknown }).modelContext;
  vi.unstubAllGlobals();
});

test('the active top-level page registers exactly four fresh tools and tears them down', async () => {
  const modelContext = new ModelContext();
  (document as Document & { modelContext?: ModelContext }).modelContext = modelContext;
  vi.stubGlobal('fetch', pageHarness());
  const user = userEvent.setup();
  const page = render(<FocusContractStudio />);

  expect(await screen.findByText('Four bounded Site tools are registered for this page.')).toBeVisible();
  expect([...modelContext.tools.keys()]).toEqual([
    'read_active_focus_review',
    'create_focus_contract_proposal',
    'apply_approved_focus_contract',
    'verify_focus_contract',
  ]);
  const firstSignals = [...modelContext.signals];

  await user.click(screen.getByRole('tab', { name: 'Danger-emphasis' }));
  expect(await screen.findByRole('tab', {
    name: 'Danger-emphasis',
    selected: true,
  })).toBeVisible();
  await waitFor(() => expect(firstSignals.every(({ aborted }) => aborted)).toBe(true));
  expect(modelContext.tools.size).toBe(4);

  page.unmount();
  expect(modelContext.tools.size).toBe(0);
});

test('unsupported WebMCP keeps the complete visible human workflow', async () => {
  vi.stubGlobal('fetch', pageHarness());
  render(<FocusContractStudio />);

  expect(await screen.findByRole('heading', { name: /govern one real focus decision/i })).toBeVisible();
  const unsupported = document.querySelector('[data-operation-state="unsupportedWebMCP"]')!;
  expect(unsupported).toHaveTextContent('complete human workflow remains available');
  expect(screen.getByRole('button', { name: 'Create Cancel proposal' })).toBeEnabled();
  expect(within(screen.getByRole('navigation', { name: 'Governed workflow stages' }))
    .getAllByRole('link')).toHaveLength(6);
  expect(screen.getByRole('link', { name: /Reviewavailable/u })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Reset this workspace' })).toBeEnabled();
});

test('a successful WebMCP mutation refreshes the visible review without a reload', async () => {
  const modelContext = new ModelContext();
  (document as Document & { modelContext?: ModelContext }).modelContext = modelContext;
  const fetcher = pageHarness();
  vi.stubGlobal('fetch', fetcher);
  render(<FocusContractStudio />);

  expect(await screen.findByText('Four bounded Site tools are registered for this page.')).toBeVisible();
  const create = modelContext.tools.get('create_focus_contract_proposal')!;
  await create.execute({
    baseImplementedRevision: 1,
    configuration: {
      ...REVISION_1_CONFIGURATION,
      initialFocus: 'cancel-button',
    },
    evidenceQueryToken: `v1.1788500000.${'A'.repeat(43)}`,
    evidenceRecordIds: ['D001'],
    summary: 'Focus Cancel first.',
    idempotencyKey: '00000000-0000-4000-8000-000000007102',
  });

  await waitFor(() => expect(
    fetcher.mock.calls.filter(([input]) => String(input) === '/api/focus-review'),
  ).toHaveLength(2));
  expect(screen.getByRole('heading', { name: 'Complete exact authority' })).toBeVisible();
  expect(screen.getByRole('region', { name: 'Proposal state' })).toHaveTextContent('NOT APPLIED');
  expect(screen.getByRole('region', { name: 'Current focus decision truth' }))
    .toHaveTextContent('IMPLEMENTED REVISION 1');

  const apply = modelContext.tools.get('apply_approved_focus_contract')!;
  await apply.execute({
    proposalId: '00000000-0000-4000-8000-000000007101',
    expectedImplementedRevision: 1,
    idempotencyKey: '00000000-0000-4000-8000-000000007104',
  });

  await waitFor(() => expect(
    fetcher.mock.calls.filter(([input]) => String(input) === '/api/focus-review'),
  ).toHaveLength(3));
  expect(screen.getByRole('region', { name: 'Current focus decision truth' }))
    .toHaveTextContent('IMPLEMENTED REVISION 2');
  expect(screen.getByRole('region', { name: 'OPERATION_COMMITTED state' }))
    .toHaveTextContent(/Implemented revision changed\s*YES/u);
});
