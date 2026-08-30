import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { FocusContractStudio } from '../../app/focus-contract-studio';

const reviewPayload = {
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
    records: [
      {
        recordId: 'D001',
        outcomeKey: 'cancel-button',
        applicability: 'exact-variant',
        rationaleExcerpt:
          'For this destructive dialog, focus Cancel first. Evidence only — not approval.',
        ranks: [1, 1, 1],
        rrf: '0.04918033',
      },
    ],
  },
  proposal: null,
} as const;

const bootstrapPayload = {
  ok: true,
  data: {
    generation: 1,
    csrfToken: 'page-held-csrf-token',
    activeVariant: {
      slug: 'delete-account-standard',
      implementedRevision: 1,
      viewRevision: 1,
    },
  },
};

const proposalPayload = {
  ok: true,
  contractVersion: 'fcs-webmcp-v2',
  proposal: {
    proposalId: '00000000-0000-4000-8000-000000002501',
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
};

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  delete (document as Document & { modelContext?: unknown }).modelContext;
  vi.unstubAllGlobals();
});

test('bootstraps before read and renders the exact Package 2 decision boundary', async () => {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url === '/api/session/bootstrap') return json(bootstrapPayload, 201);
      if (url === '/api/focus-review') return json(reviewPayload);
      throw new Error(`unexpected ${url}`);
    }),
  );

  render(<FocusContractStudio />);
  expect(screen.getByRole('status')).toHaveTextContent('Preparing an isolated demo');
  expect(await screen.findByText('IMPLEMENTED REVISION 1')).toBeVisible();
  expect(calls.slice(0, 2)).toEqual([
    '/api/session/bootstrap',
    '/api/focus-review',
  ]);
  expect(screen.getByText('DECISION MISMATCH')).toBeVisible();
  expect(screen.getByText('PRECEDENT: CANCEL')).toBeVisible();
  expect(screen.getByText('EVIDENCE ONLY — NOT APPROVAL')).toBeVisible();
  expect(screen.getByText('D001')).toBeVisible();
  expect(await screen.findByText(/Site tools are unavailable here/)).toBeVisible();
  expect(screen.queryByText(/Package 0 Site-tool probe/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /approve|apply/i })).not.toBeInTheDocument();
});

test('native dialog exposes its name/description, observes the actual Delete focus, and restores the trigger', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url === '/api/session/bootstrap') return json(bootstrapPayload, 201);
      if (url === '/api/focus-review') return json(reviewPayload);
      if (url === '/api/observations/initial-focus') {
        return json({
          ok: true,
          observation: { observedInitialFocus: 'delete-button' },
        }, 201);
      }
      throw new Error(`unexpected ${url}`);
    }),
  );
  const user = userEvent.setup();
  render(<FocusContractStudio />);
  const trigger = await screen.findByRole('button', { name: 'Run opening rehearsal' });
  await user.click(trigger);

  const dialog = screen.getByRole('dialog', { name: 'Delete account' });
  expect(dialog).toHaveAttribute('open');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(dialog).toHaveAccessibleDescription(
    'Deleting your account is permanent. You can optionally tell us why.',
  );
  expect(screen.getByRole('button', { name: 'Delete account', hidden: false })).toHaveFocus();

  await waitFor(() => {
    expect(requests.some(({ url }) => url === '/api/observations/initial-focus')).toBe(true);
  });
  const observation = requests.find(
    ({ url }) => url === '/api/observations/initial-focus',
  )!;
  expect((observation.init?.headers as Record<string, string>)['x-fcs-csrf']).toBe(
    'page-held-csrf-token',
  );
  const body = JSON.parse(String(observation.init?.body));
  expect(body).toMatchObject({
    firstTargetId: 'delete-button',
    manifest: {
      targetIds: [
        'dialog-title',
        'reason-input',
        'cancel-button',
        'delete-button',
      ],
      tabbableOrder: ['reason-input', 'cancel-button', 'delete-button'],
      dialogName: 'Delete account',
      role: 'dialog',
      ariaModal: true,
      open: true,
    },
  });
  expect(JSON.stringify(body)).not.toContain('reasonText');
  expect(Object.keys(body).sort()).toEqual([
    'clientOffsetMs',
    'firstTargetId',
    'manifest',
  ]);

  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(dialog).not.toHaveAttribute('open');
  await waitFor(() => expect(trigger).toHaveFocus());
});

test('creates a real Cancel proposal and renders the durable unapplied diff', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal(
    'crypto',
    { ...crypto, randomUUID: () => '00000000-0000-4000-8000-000000002502' },
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url === '/api/session/bootstrap') return json(bootstrapPayload, 201);
      if (url === '/api/focus-review') return json(reviewPayload);
      if (url === '/api/focus-proposals') return json(proposalPayload, 201);
      throw new Error(`unexpected ${url}`);
    }),
  );
  const user = userEvent.setup();
  render(<FocusContractStudio />);
  await user.click(await screen.findByRole('button', { name: 'Create Cancel proposal' }));

  expect(await screen.findByText('NOT APPLIED')).toBeVisible();
  const diff = screen.getByRole('table', { name: 'Proposed focus change' });
  expect(within(diff).getByText('Initial focus')).toBeVisible();
  expect(within(diff).getByText('Delete button')).toBeVisible();
  expect(within(diff).getByText('Cancel button')).toBeVisible();
  expect(screen.getByText(/Supported by D001/)).toBeVisible();

  const create = requests.find(({ url }) => url === '/api/focus-proposals')!;
  expect((create.init?.headers as Record<string, string>)['x-fcs-csrf']).toBe(
    'page-held-csrf-token',
  );
  const body = JSON.parse(String(create.init?.body));
  expect(body).toMatchObject({
    baseImplementedRevision: 1,
    configuration: { initialFocus: 'cancel-button' },
    evidenceRecordIds: ['D001'],
    idempotencyKey: '00000000-0000-4000-8000-000000002502',
  });
  expect(JSON.stringify(body)).not.toContain('csrf');
  expect(screen.getByText('IMPLEMENTED REVISION 1')).toBeVisible();
});

test('reload state comes from the read API and still renders NOT APPLIED without changing Delete', async () => {
  const persistedReview = {
    ...reviewPayload,
    proposal: {
      proposalId: proposalPayload.proposal.proposalId,
      baseImplementedRevision: 1,
      proposalDigest8: '12345678',
      changedFields: ['initialFocus'],
      fieldEvidence: proposalPayload.proposal.fieldEvidence,
      status: 'proposed',
      applied: false,
      label: 'NOT APPLIED',
    },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/session/bootstrap') return json(bootstrapPayload);
      if (String(input) === '/api/focus-review') return json(persistedReview);
      throw new Error(`unexpected ${String(input)}`);
    }),
  );
  render(<FocusContractStudio />);
  expect(await screen.findByText('NOT APPLIED')).toBeVisible();
  expect(screen.getByText('IMPLEMENTED REVISION 1')).toBeVisible();
  expect(screen.getByText('OBSERVED: NOT YET CAPTURED')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Run opening rehearsal' })).toBeEnabled();
});

test('the mounted page registers exactly two tools after bootstrap and aborts both on unmount/remount', async () => {
  const order: string[] = [];
  const registrations: Array<{ name: string; signal: AbortSignal }> = [];
  (document as Document & {
    modelContext?: {
      registerTool: (
        tool: { name: string },
        options: { signal: AbortSignal },
      ) => Promise<void>;
    };
  }).modelContext = {
    async registerTool(tool, { signal }) {
      order.push(`register:${tool.name}`);
      registrations.push({ name: tool.name, signal });
    },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/session/bootstrap') {
        order.push('bootstrap');
        return json(bootstrapPayload, 201);
      }
      if (url === '/api/focus-review') {
        order.push('review');
        return json(reviewPayload);
      }
      throw new Error(`unexpected ${url}`);
    }),
  );

  const first = render(<FocusContractStudio />);
  await waitFor(() => expect(registrations).toHaveLength(2));
  expect(order).toEqual([
    'bootstrap',
    'review',
    'register:read_active_focus_review',
    'register:create_focus_contract_proposal',
  ]);
  expect(registrations.map(({ name }) => name)).toEqual([
    'read_active_focus_review',
    'create_focus_contract_proposal',
  ]);
  first.unmount();
  expect(registrations.slice(0, 2).every(({ signal }) => signal.aborted)).toBe(true);

  const second = render(<FocusContractStudio />);
  await waitFor(() => expect(registrations).toHaveLength(4));
  expect(registrations.slice(2).map(({ name }) => name)).toEqual([
    'read_active_focus_review',
    'create_focus_contract_proposal',
  ]);
  second.unmount();
  expect(registrations.every(({ signal }) => signal.aborted)).toBe(true);
});
