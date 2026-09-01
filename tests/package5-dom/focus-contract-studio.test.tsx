import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { FocusContractStudio } from '../../app/focus-contract-studio.tsx';
import { CANCEL_CONFIGURATION, REVISION_1_CONFIGURATION } from '../../lib/domain/focus-configuration.ts';

const proposalId = '00000000-0000-4000-8000-000000005501';
const receiptId = '00000000-0000-4000-8000-000000005502';
const digest = 'a'.repeat(64);

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status, headers: { 'content-type': 'application/json' },
  });
}

function appHarness(
  initialStatus: 'proposed' | 'approved' = 'proposed',
  startWithoutProposal = false,
  noPrecedent = false,
) {
  let status: 'proposed' | 'approved' | 'rejected' | 'revoked' | 'applied' = initialStatus;
  let revision = 1;
  let proposalPresent = !startWithoutProposal;
  let activeProposalId = proposalId;
  let authorKind: 'agent' | 'reviewer' = 'agent';
  let configuration = CANCEL_CONFIGURATION;
  let parentProposalId: string | null = null;
  let fieldEvidence = [{ field: 'initialFocus', recordId: 'D001', outcomeKey: 'cancel-button' }];
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  let applyFailures = 0;
  const reviewPayload = () => ({
    ok: true,
    contractVersion: 'fcs-webmcp-v2',
    review: {
      variant: 'delete-account-standard',
      implementedRevision: revision,
      implemented: revision === 2 ? CANCEL_CONFIGURATION : REVISION_1_CONFIGURATION,
      observation: null,
      precedentComparison: {
        label: revision === 2 ? 'ALIGNED' : 'DECISION_MISMATCH',
        behavior: 'initial-focus',
        implementedOutcome: revision === 2 ? 'cancel-button' : 'delete-button',
        precedentOutcome: 'cancel-button',
      },
    },
    retrieval: {
      queryToken: `v1.1788500000.${'A'.repeat(43)}`,
      issuedAt: '2026-08-31T19:33:20Z',
      expiresAt: '2026-08-31T19:38:20Z',
      algorithm: 'rrf-k60-v2', disposition: noPrecedent ? 'abstain' : 'results', reasonCode: noPrecedent ? 'NO_ELIGIBLE_PRECEDENT' : 'SUPPORTED_PRECEDENT',
      records: noPrecedent ? [] : [{
        recordId: 'D001', outcomeKey: 'cancel-button', applicability: 'exact-variant',
        rationaleExcerpt: 'Cancel protects the escape path. Evidence only — not approval.',
        ranks: [1, 1, 1], rrf: '0.04918033',
      }],
    },
    proposal: proposalPresent ? {
      proposalId: activeProposalId, baseImplementedRevision: 1, proposalDigest8: digest.slice(0, 8),
      proposalDigest: digest, changedFields: ['initialFocus'],
      fieldEvidence,
      status, applied: status === 'applied', label: status === 'applied' ? 'APPLIED' : 'NOT APPLIED',
      configuration,
      summary: 'Focus Cancel first for this destructive confirmation dialog.',
      authorKind, createdAt: '2026-08-31T19:33:23Z', parentProposalId,
    } : null,
  });
  const historyPayload = () => ({
    ok: true,
    activeRevision: revision,
    records: [
      { kind: 'revision', id: 'revision-1', revision: 1, source: 'seed', occurredAt: 1 },
      ...(proposalPresent ? [{ kind: 'proposal', id: activeProposalId, proposalDigest8: digest.slice(0, 8), baseRevision: 1, status, occurredAt: 2 }] : []),
      ...(status !== 'proposed' && status !== 'rejected' ? [{ kind: 'decision', id: 'decision-1', proposalId: activeProposalId, action: 'approve', occurredAt: 3 }] : []),
      ...(revision >= 2 ? [{ kind: 'application', id: receiptId, proposalId: activeProposalId, fromRevision: 1, toRevision: 2, occurredAt: 4 }] : []),
      ...(revision >= 3 ? [{ kind: 'revision', id: 'revision-3', revision: 3, source: 'undo', occurredAt: 5 }] : []),
    ],
  });
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    requests.push({ url, body });
    if (url === '/api/session/bootstrap') return json({
      ok: true,
      data: { generation: 1, csrfToken: 'page-csrf', activeVariant: { slug: 'delete-account-standard', implementedRevision: 1, viewRevision: 1 } },
    }, 201);
    if (url === '/api/focus-review') return json(reviewPayload());
    if (url === '/api/focus-history') return json(historyPayload());
    if (url.endsWith('/review')) {
      const action = body.action as string;
      status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action === 'revoke' ? 'revoked' : 'proposed';
      if (action === 'edit') {
        activeProposalId = '00000000-0000-4000-8000-000000005503';
        authorKind = 'reviewer';
        configuration = { ...CANCEL_CONFIGURATION, initialFocus: 'reason-input' };
        parentProposalId = proposalId;
        fieldEvidence = [];
      }
      return json({ ok: true, review: { action, proposalId: activeProposalId, resultId: 'decision', status, replayed: false } }, 201);
    }
    if (url === '/api/focus-proposals/reviewer') {
      proposalPresent = true;
      activeProposalId = '00000000-0000-4000-8000-000000005504';
      authorKind = 'reviewer';
      configuration = CANCEL_CONFIGURATION;
      fieldEvidence = [];
      return json({ ok: true, review: { action: 'create', proposalId: activeProposalId, resultId: activeProposalId, status: 'proposed', replayed: false } }, 201);
    }
    if (url.endsWith('/apply')) {
      if (applyFailures > 0) {
        applyFailures -= 1;
        return json({ ok: false, error: { code: 'APPLICATION_WRITE_FAILED', message: 'The application outcome is uncertain. Retry recovers the receipt with the same key.', retryable: true, correlationId: crypto.randomUUID() } }, 503);
      }
      status = 'applied';
      revision = 2;
      return json({
        ok: true,
        receipt: { receiptId, proposalId, proposalDigest8: digest.slice(0, 8), fromRevision: 1, toRevision: 2, result: 'applied', createdAt: '2026-08-31T19:33:25Z', replayed: false },
      }, 201);
    }
    if (url === '/api/focus-revisions/1/undo') {
      revision = 3;
      return json({ ok: true, receipt: { revisionId: 'revision-3', restoredRevision: 1, fromRevision: 2, toRevision: 3, createdAt: '2026-08-31T19:33:26Z', replayed: false } }, 201);
    }
    if (url === '/api/session/reset') {
      revision = 1;
      proposalPresent = false;
      return json({ ok: true, data: { generation: 2, csrfToken: 'new-csrf', replayed: false } });
    }
    throw new Error(`unexpected ${url}`);
  });
  return {
    fetchMock,
    requests,
    failNextApply() { applyFailures += 1; },
  };
}

afterEach(() => {
  delete (document as Document & { modelContext?: unknown }).modelContext;
  vi.unstubAllGlobals();
});

test('complete immutable proposal authority is visible and review input contains no caller authority', async () => {
  const harness = appHarness();
  vi.stubGlobal('fetch', harness.fetchMock);
  const user = userEvent.setup();
  render(<FocusContractStudio />);
  const authority = await screen.findByRole('heading', { name: 'Complete exact authority' });
  const section = authority.closest('section')!;
  expect(section).toHaveTextContent(digest);
  expect(section).toHaveTextContent('Base revision1');
  expect(section).toHaveTextContent('agent');
  expect(section).toHaveTextContent('2026-08-31T19:33:23Z');
  expect(section).toHaveTextContent('EVIDENCE ONLY');
  await user.click(within(section).getByRole('button', { name: 'Approve exact proposal' }));
  expect(screen.getByRole('heading', { name: 'Confirm approve' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Confirm approve' })).toHaveFocus();
  expect(harness.requests.filter(({ url }) => url.endsWith('/review'))).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: 'Confirm approve' }));
  expect(await screen.findByRole('button', { name: 'Apply approved proposal' })).toBeVisible();
  const reviewRequest = harness.requests.find(({ url }) => url.endsWith('/review'))!;
  expect(Object.keys(reviewRequest.body).sort()).toEqual(['action', 'idempotencyKey']);
  expect(reviewRequest.body).not.toHaveProperty('proposalHash');
  expect(screen.getByRole('status')).toHaveTextContent('Approve committed');
});

test('edit creates a visible reviewer child and revoke removes apply without changing revision 1', async () => {
  const edited = appHarness();
  vi.stubGlobal('fetch', edited.fetchMock);
  const user = userEvent.setup();
  const view = render(<FocusContractStudio />);
  await user.click(await screen.findByRole('button', { name: 'Edit as child proposal' }));
  await user.click(screen.getByRole('button', { name: 'Confirm edit' }));
  const authority = await screen.findByRole('heading', { name: 'Complete exact authority' });
  const section = authority.closest('section')!;
  expect(section).toHaveTextContent('reviewer');
  expect(section).toHaveTextContent(proposalId);
  expect(within(section).getByRole('table', { name: 'Proposed focus change' })).toHaveTextContent('Reason input');
  expect(section).toHaveTextContent('no precedent supports this proposed value');
  expect(section).not.toHaveTextContent('Supported by D001');
  expect(screen.getByText('IMPLEMENTED REVISION 1')).toBeVisible();
  const editRequest = edited.requests.find(({ body }) => body.action === 'edit')!;
  expect(Object.keys(editRequest.body).sort()).toEqual(['action', 'configuration', 'idempotencyKey', 'summary']);

  view.unmount();
  const revoked = appHarness('approved');
  vi.stubGlobal('fetch', revoked.fetchMock);
  render(<FocusContractStudio />);
  await user.click(await screen.findByRole('button', { name: 'Revoke approval' }));
  await user.click(screen.getByRole('button', { name: 'Confirm revoke' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Revoke committed');
  expect(screen.getByText('IMPLEMENTED REVISION 1')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Apply approved proposal' })).not.toBeInTheDocument();
});

test('abstention exposes reviewer novel responsibility and never labels it as precedent-supported', async () => {
  const harness = appHarness('proposed', true, true);
  vi.stubGlobal('fetch', harness.fetchMock);
  const user = userEvent.setup();
  render(<FocusContractStudio />);
  expect(await screen.findByText(/No eligible precedent was returned/u)).toBeVisible();
  const create = screen.getByRole('button', { name: 'Create reviewer novel proposal' });
  expect(create).toBeDisabled();
  await user.click(screen.getByRole('checkbox', { name: /I accept responsibility/u }));
  await user.click(create);
  const section = (await screen.findByRole('heading', { name: 'Complete exact authority' })).closest('section')!;
  expect(section).toHaveTextContent('reviewer');
  expect(section).toHaveTextContent('no precedent supports this proposed value');
  const request = harness.requests.find(({ url }) => url === '/api/focus-proposals/reviewer')!;
  expect(request.body).toMatchObject({ responsibilityAccepted: true });
  expect(request.body).not.toHaveProperty('evidenceRecordIds');
});

test('guarded apply exposes a receipt dialog focused on Cancel and refreshes revision 2/history', async () => {
  const harness = appHarness('approved');
  vi.stubGlobal('fetch', harness.fetchMock);
  const user = userEvent.setup();
  render(<FocusContractStudio />);
  await user.click(await screen.findByRole('button', { name: 'Apply approved proposal' }));
  await user.click(screen.getByRole('button', { name: 'Confirm apply' }));
  const dialog = await screen.findByRole('dialog', { name: 'Application committed' });
  expect(dialog).toHaveTextContent(receiptId);
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
  expect(screen.getByText('IMPLEMENTED REVISION 2')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Run complete rehearsal' })).toBeEnabled();
  expect(screen.getByRole('heading', { name: 'Chronological committed state' }).closest('section')).toHaveTextContent('revision 1 → 2');
  const applyRequest = harness.requests.find(({ url }) => url.endsWith('/apply'))!;
  expect(Object.keys(applyRequest.body).sort()).toEqual(['expectedImplementedRevision', 'idempotencyKey']);
});

test('uncertain apply retries with the identical key and never guesses success', async () => {
  const harness = appHarness('approved');
  harness.failNextApply();
  vi.stubGlobal('fetch', harness.fetchMock);
  const user = userEvent.setup();
  render(<FocusContractStudio />);
  await user.click(await screen.findByRole('button', { name: 'Apply approved proposal' }));
  await user.click(screen.getByRole('button', { name: 'Confirm apply' }));
  expect(await screen.findByRole('status')).toHaveTextContent('outcome is uncertain');
  expect(screen.getByText('IMPLEMENTED REVISION 1')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Confirm apply' }));
  await screen.findByRole('dialog', { name: 'Application committed' });
  const attempts = harness.requests.filter(({ url }) => url.endsWith('/apply'));
  expect(attempts).toHaveLength(2);
  expect(attempts[0]!.body.idempotencyKey).toBe(attempts[1]!.body.idempotencyKey);
});

test('undo and reset require separate confirmations and reconstruct committed state', async () => {
  const harness = appHarness('approved');
  vi.stubGlobal('fetch', harness.fetchMock);
  const user = userEvent.setup();
  render(<FocusContractStudio />);
  await user.click(await screen.findByRole('button', { name: 'Apply approved proposal' }));
  await user.click(screen.getByRole('button', { name: 'Confirm apply' }));
  await screen.findByRole('dialog', { name: 'Application committed' });
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Undo to revision 1' }));
  await user.click(screen.getByRole('button', { name: 'Confirm undo' }));
  expect(await screen.findByText('IMPLEMENTED REVISION 3')).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Earlier approval remains invalid');
  await user.click(screen.getByRole('button', { name: 'Reset this workspace' }));
  await user.click(screen.getByRole('button', { name: 'Confirm reset' }));
  expect(await screen.findByText('IMPLEMENTED REVISION 1')).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Complete exact authority' })).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('generation 2');
});
