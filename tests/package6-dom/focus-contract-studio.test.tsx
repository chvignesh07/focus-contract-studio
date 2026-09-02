import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { FocusContractStudio } from '../../app/focus-contract-studio.tsx';
import {
  CANCEL_CONFIGURATION,
  REVISION_1_CONFIGURATION,
} from '../../lib/domain/focus-configuration.ts';

const proposalId = '00000000-0000-4000-8000-000000006501';
const digest = '6'.repeat(64);

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function harness(
  disposition: 'results' | 'conflict' | 'abstention' = 'results',
  includeProposal = true,
) {
  let variant: 'delete-account-standard' | 'delete-account-danger-emphasis' =
    'delete-account-standard';
  let viewRevision = 1;
  const calls: Array<{ url: string; body: Record<string, unknown>; signal?: AbortSignal }> = [];
  const review = () => ({
    ok: true,
    contractVersion: 'fcs-webmcp-v2',
    review: {
      variant,
      implementedRevision: 1,
      implemented: REVISION_1_CONFIGURATION,
      observation: {
        rehearsalSessionId: '00000000-0000-4000-8000-000000006502',
        observedInitialFocus: 'delete-button',
        manifestDigest8: 'manifest',
        eventDigest8: 'event123',
        trust: 'untrusted-browser-telemetry',
      },
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
      disposition,
      reasonCode: disposition === 'results'
        ? 'SUPPORTED_PRECEDENT'
        : disposition === 'conflict'
          ? 'PRECEDENT_CONFLICT'
          : 'NO_ELIGIBLE_PRECEDENT',
      records: disposition === 'abstention' ? [] : [{
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
      }, ...(disposition === 'conflict' ? [{
        recordId: 'D002',
        outcomeKey: 'reason-input',
        sourceKind: 'synthetic-seed',
        validFrom: '2026-01-02T00:00:00Z',
        validUntil: null,
        applicability: 'exact-variant',
        lexicalRank: 2,
        structuredRank: 1,
        relationshipRank: 2,
        rrfContribution: '0.04865151',
        ranks: [2, 1, 2],
        rrf: '0.04865151',
        rationaleExcerpt: 'Reason-first preserves context. Evidence only — not approval.',
      }] : [])],
    },
    proposal: disposition === 'results' && includeProposal ? {
      proposalId,
      baseImplementedRevision: 1,
      proposalDigest8: digest.slice(0, 8),
      proposalDigest: digest,
      changedFields: ['initialFocus'],
      fieldEvidence: [{
        field: 'initialFocus',
        recordId: 'D001',
        outcomeKey: 'cancel-button',
      }],
      status: 'proposed',
      applied: false,
      label: 'NOT APPLIED',
      configuration: CANCEL_CONFIGURATION,
      summary: 'Focus Cancel first.',
      authorKind: 'agent',
      createdAt: '2026-09-01T15:00:01Z',
      parentProposalId: null,
    } : null,
  });
  const history = () => ({
    ok: true,
    activeRevision: 1,
    records: [
      {
        kind: 'revision',
        id: 'revision-1',
        revision: 1,
        source: 'seed',
        occurredAt: 1_788_500_000,
      },
      {
        kind: 'proposal',
        id: proposalId,
        proposalDigest8: digest.slice(0, 8),
        baseRevision: 1,
        status: 'proposed',
        occurredAt: 1_788_500_001,
      },
    ],
  });
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    calls.push({ url, body, signal: init?.signal ?? undefined });
    if (url === '/api/session/bootstrap') {
      return json({
        ok: true,
        data: {
          generation: 1,
          csrfToken: 'page-csrf',
          activeVariant: {
            slug: variant,
            implementedRevision: 1,
            viewRevision,
          },
        },
      }, 201);
    }
    if (url === '/api/focus-review') return json(review());
    if (url === '/api/focus-history') return json(history());
    if (url === '/api/active-variant') {
      variant = body.variant as typeof variant;
      viewRevision += 1;
      return json({ ok: true, data: { variant, viewRevision } });
    }
    throw new Error(`unexpected ${url}`);
  });
  return { calls, fetchMock };
}

afterEach(() => {
  delete (document as Document & { modelContext?: unknown }).modelContext;
  vi.unstubAllGlobals();
});

test('first viewport truth and six inspectable real stages replace package-facing hierarchy', async () => {
  const value = harness();
  vi.stubGlobal('fetch', value.fetchMock);
  render(<FocusContractStudio />);
  expect(await screen.findByRole('heading', { name: /govern one real focus decision/i })).toBeVisible();
  expect(screen.queryByText(/Package 5/u)).not.toBeInTheDocument();
  const rail = screen.getByRole('navigation', { name: 'Governed workflow stages' });
  const links = within(rail).getAllByRole('link');
  expect(links).toHaveLength(6);
  expect(links.map((link) => link.textContent)).toEqual([
    expect.stringContaining('Observe'),
    expect.stringContaining('Precedent'),
    expect.stringContaining('Proposal'),
    expect.stringContaining('Review'),
    expect.stringContaining('Apply'),
    expect.stringContaining('Verify & history'),
  ]);
  const truth = screen.getByRole('region', { name: 'Current focus decision truth' });
  expect(truth).toHaveTextContent('IMPLEMENTED REVISION 1');
  expect(truth).toHaveTextContent('OBSERVED DELETE');
  expect(truth).toHaveTextContent('D001');
  expect(truth).toHaveTextContent('CANCEL');
  expect(truth).toHaveTextContent('VERIFICATION SCOPE');
  expect(truth).toHaveTextContent('Fresh finalized raw keyboard/focus events');
  expect(truth).toHaveTextContent('cannot authorize apply, manufacture events, or prove WCAG/general conformance');
  expect(truth).toHaveTextContent('NOT APPLIED');
  expect(screen.getByText(/Only an exact human review can authorize apply\./u)).toBeVisible();
});

test('exact acknowledgement gates review confirmation and resets on variant CAS refresh', async () => {
  const value = harness();
  vi.stubGlobal('fetch', value.fetchMock);
  const user = userEvent.setup();
  const first = render(<FocusContractStudio />);
  const authority = (await screen.findByRole('heading', { name: 'Complete exact authority' }))
    .closest('section')!;
  const approve = within(authority).getByRole('button', { name: 'Approve exact proposal' });
  expect(approve).toBeDisabled();
  await user.click(within(authority).getByRole('checkbox', {
    name: 'I reviewed this exact proposal and revision',
  }));
  expect(approve).toBeEnabled();
  await user.click(approve);
  expect(screen.getByRole('heading', { name: 'Confirm approve' })).toBeVisible();
  expect(value.calls.filter(({ url }) => url.includes('/review'))).toHaveLength(0);

  await user.click(within(authority).getByRole('checkbox', {
    name: 'I reviewed this exact proposal and revision',
  }));
  expect(screen.queryByRole('heading', { name: 'Confirm approve' })).not.toBeInTheDocument();
  expect(value.calls.filter(({ url }) => url.includes('/review'))).toHaveLength(0);

  await user.click(within(authority).getByRole('checkbox', {
    name: 'I reviewed this exact proposal and revision',
  }));
  await user.click(approve);

  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(approve).toHaveFocus();
  await user.click(screen.getByRole('tab', { name: 'Danger-emphasis' }));
  expect(await screen.findByRole('tab', { name: 'Danger-emphasis', selected: true })).toBeVisible();
  expect(within(authority).getByRole('checkbox', {
    name: 'I reviewed this exact proposal and revision',
  })).not.toBeChecked();
  const switchCall = value.calls.find(({ url }) => url === '/api/active-variant')!;
  expect(switchCall.body).toEqual({
    variant: 'delete-account-danger-emphasis',
    expectedViewRevision: 1,
    idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/u),
  });
  expect(value.calls.filter(({ url }) => url === '/api/focus-review')).toHaveLength(2);
  expect(value.calls.filter(({ url }) => url === '/api/focus-history')).toHaveLength(2);
  const firstReview = value.calls.find(({ url }) => url === '/api/focus-review')!;
  expect(firstReview.signal?.aborted).toBe(true);

  first.unmount();
  const stalled = harness('results', false);
  const stalledFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === '/api/focus-proposals') {
      return await new Promise<Response>(() => undefined);
    }
    return stalled.fetchMock(input, init);
  });
  vi.stubGlobal('fetch', stalledFetch);
  const second = render(<FocusContractStudio />);
  await user.click(await screen.findByRole('button', { name: 'Create Cancel proposal' }));
  expect(await screen.findByRole('button', { name: 'Saving proposal…' })).toBeDisabled();
  expect(screen.getByRole('tab', { name: 'Standard' })).toBeDisabled();
  expect(screen.getByRole('tab', { name: 'Danger-emphasis' })).toBeDisabled();
  expect(stalled.calls.filter(({ url }) => url === '/api/active-variant')).toHaveLength(0);
  second.unmount();
});

test('semantic source order, complete evidence, and unsupported WebMCP remain comprehensible', async () => {
  const value = harness();
  vi.stubGlobal('fetch', value.fetchMock);
  render(<FocusContractStudio />);
  await screen.findByRole('heading', { name: 'Govern one real focus decision' });

  const headingNames = screen.getAllByRole('heading').map((heading) => heading.textContent);
  expect(headingNames.slice(0, 4)).toEqual([
    'Govern one real focus decision',
    'Live delete-account dialog',
    'DECISION MISMATCH',
    'Complete exact authority',
  ]);
  const evidence = screen.getByText('D001').closest('article')!;
  for (const label of [
    'Source', 'Valid from', 'Valid until', 'Scope', 'Lexical rank',
    'Structured rank', 'Relationship rank', 'RRF contribution',
  ]) {
    expect(evidence).toHaveTextContent(label);
  }
  expect(evidence).toHaveTextContent('Cancel protects the escape path');

  const unsupported = document.querySelector('[data-operation-state="unsupportedWebMCP"]')!;
  expect(unsupported).toHaveTextContent('complete human workflow remains available');
  expect(within(unsupported as HTMLElement).getAllByRole('link')).toHaveLength(1);
  expect(screen.getAllByRole('status')).toHaveLength(1);
});

test('conflict renders both precise outcomes and abstention preserves the reviewer-owned path', async () => {
  const conflict = harness('conflict');
  vi.stubGlobal('fetch', conflict.fetchMock);
  const { unmount } = render(<FocusContractStudio />);
  const outcomes = await screen.findByLabelText('Conflicting precedent outcomes');
  expect(within(outcomes).getByText('D001')).toBeVisible();
  expect(within(outcomes).getByText('Cancel')).toBeVisible();
  expect(within(outcomes).getByText('D002')).toBeVisible();
  expect(within(outcomes).getByText('Reason')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Create Cancel proposal' })).toBeDisabled();
  unmount();

  const abstention = harness('abstention');
  vi.stubGlobal('fetch', abstention.fetchMock);
  render(<FocusContractStudio />);
  expect(await screen.findByText(/No eligible precedent was returned/u)).toBeVisible();
  expect(screen.getByRole('checkbox', {
    name: /I accept responsibility for a novel Cancel-first proposal/u,
  })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Create reviewer novel proposal' })).toBeDisabled();
});
