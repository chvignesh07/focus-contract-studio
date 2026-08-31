import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { DeleteAccountDialog } from '../../app/delete-account-dialog';
import { FocusContractStudio } from '../../app/focus-contract-studio';
import { REVISION_1_CONFIGURATION } from '../../lib/domain/focus-configuration';

afterEach(() => vi.unstubAllGlobals());

test('dialog captures one actual closed manifest and raw sequence without typed content', async () => {
  const onComplete = vi.fn();
  const onStart = vi.fn(async () => ({
    rehearsalSessionId: '00000000-0000-4000-8000-000000000391',
    variantId: '00000000-0000-4000-8000-000000000392',
    implementedRevision: 1,
    expiresAt: 1_788_200_030,
  }));
  const onSyntheticDelete = vi.fn();
  const user = userEvent.setup();
  render(
    <DeleteAccountDialog
      configuration={REVISION_1_CONFIGURATION}
      onRehearsalComplete={onComplete}
      onStartRehearsal={onStart}
      onSyntheticDelete={onSyntheticDelete}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Run complete rehearsal' }));
  expect(onStart).toHaveBeenCalledTimes(1);
  const dialog = screen.getByRole('dialog', { name: 'Delete account' });
  expect(dialog).toHaveAccessibleDescription(
    'Deleting your account is permanent. You can optionally tell us why.',
  );
  expect(screen.getByRole('button', { name: 'Delete account' })).toHaveFocus();
  await user.type(screen.getByLabelText('Reason (optional)'), 'P3_PRIVATE_MARKER');

  screen.getByRole('button', { name: 'Delete account' }).focus();
  await user.keyboard('{Tab}');
  await user.keyboard('{Tab}');
  await user.keyboard('{Tab}');
  await user.keyboard('{Tab}');
  await user.keyboard('{Shift>}{Tab}{/Shift}');
  await user.keyboard('{Escape}');
  fireEvent(dialog, new Event('cancel', { cancelable: true }));

  await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  const capture = onComplete.mock.calls[0]![0];
  expect(capture.manifest).toMatchObject({
    manifestVersion: 'focus-manifest-v1',
    targetIds: [
      'delete-trigger',
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
    variantId: '00000000-0000-4000-8000-000000000392',
    implementedRevision: 1,
  });
  expect(capture.events[0]).toMatchObject({
    eventType: 'dialog_open',
    targetId: 'delete-trigger',
  });
  expect(capture.events.at(-1)).toMatchObject({
    eventType: 'focus_return',
    targetId: 'delete-trigger',
  });
  expect(JSON.stringify(capture)).not.toContain('P3_PRIVATE_MARKER');
  expect(JSON.stringify(capture)).not.toMatch(/value|innerHTML|outerHTML|selector/iu);
  expect(onSyntheticDelete).not.toHaveBeenCalled();
});

test('observer records only browser-dispatched allowlisted keys and never closes destructively', async () => {
  const onComplete = vi.fn();
  const user = userEvent.setup();
  render(
    <DeleteAccountDialog
      configuration={REVISION_1_CONFIGURATION}
      onRehearsalComplete={onComplete}
      onStartRehearsal={async () => ({
        rehearsalSessionId: '00000000-0000-4000-8000-000000000393',
        variantId: '00000000-0000-4000-8000-000000000394',
        implementedRevision: 1,
        expiresAt: 1_788_200_030,
      })}
      onSyntheticDelete={vi.fn()}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Run complete rehearsal' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.keyDown(dialog, { key: 'Enter' });
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  const encoded = JSON.stringify(onComplete.mock.calls[0]![0]);
  expect(encoded).not.toContain('Enter');
  expect(encoded).not.toContain('delete"');
});

const reviewPayload = {
  ok: true,
  contractVersion: 'fcs-webmcp-v2',
  review: {
    variant: 'delete-account-standard',
    implementedRevision: 1,
    implemented: REVISION_1_CONFIGURATION,
    observation: null,
    precedentComparison: {
      label: 'DECISION_MISMATCH',
      behavior: 'initial-focus',
      implementedOutcome: 'delete-button',
      precedentOutcome: 'cancel-button',
    },
  },
  retrieval: {
    queryToken: `v1.1788300000.${'A'.repeat(43)}`,
    issuedAt: '2026-08-31T18:00:00Z',
    expiresAt: '2026-08-31T18:05:00Z',
    algorithm: 'rrf-k60-v2',
    disposition: 'results',
    reasonCode: 'SUPPORTED_PRECEDENT',
    records: [{
      recordId: 'D001',
      outcomeKey: 'cancel-button',
      applicability: 'exact-variant',
      rationaleExcerpt: 'Synthetic evidence only.',
      ranks: [1, 1, 1],
      rrf: '0.04918033',
    }],
  },
  proposal: null,
};

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('completion control stays focusable and suppresses click and keyboard re-entry while starting', async () => {
  let resolveStart!: (response: Response) => void;
  const startResponse = new Promise<Response>((resolve) => {
    resolveStart = resolve;
  });
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/session/bootstrap') return json({
      ok: true,
      data: {
        generation: 1,
        csrfToken: 'page-held-csrf-token',
        activeVariant: { slug: 'delete-account-standard', implementedRevision: 1, viewRevision: 1 },
      },
    }, 201);
    if (url === '/api/focus-review') return json(reviewPayload);
    if (url === '/api/rehearsals/start') return startResponse;
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();
  render(<FocusContractStudio />);
  const control = await screen.findByRole('button', { name: 'Run complete rehearsal' });
  control.focus();
  await user.click(control);
  await waitFor(() => expect(control).toHaveAttribute('aria-disabled', 'true'));
  expect(control).not.toBeDisabled();
  expect(control).toHaveFocus();
  expect(control).toHaveAccessibleDescription('Starting one bounded raw browser rehearsal…');
  await user.click(control);
  await user.keyboard('{Enter}{Space}');
  expect(fetchMock.mock.calls.filter(([input]) => String(input) === '/api/rehearsals/start')).toHaveLength(1);

  resolveStart(json({
    ok: false,
    error: { code: 'REHEARSAL_START_FAILED', message: 'The rehearsal could not be started.', retryable: true, correlationId: '00000000-0000-4000-8000-000000000398' },
  }, 500));
  expect(await screen.findByRole('status')).toHaveTextContent('The rehearsal could not be started.');
  expect(control).toHaveFocus();
});

test('page presents captured manifest and six non-color textual verification rows with restrained status', async () => {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url === '/api/session/bootstrap') return json({
      ok: true,
      data: {
        generation: 1,
        csrfToken: 'page-held-csrf-token',
        activeVariant: { slug: 'delete-account-standard', implementedRevision: 1, viewRevision: 1 },
      },
    }, 201);
    if (url === '/api/focus-review') return json(reviewPayload);
    if (url === '/api/rehearsals/start') return json({
      ok: true,
      rehearsal: {
        rehearsalSessionId: '00000000-0000-4000-8000-000000000395',
        variantId: '00000000-0000-4000-8000-000000000396',
        implementedRevision: 1,
        expiresAt: 1_788_300_030,
        state: 'recording',
      },
    }, 201);
    if (/\/api\/rehearsals\/.+\/finalize$/u.test(url)) return json({
      ok: true,
      rehearsal: {
        rehearsalSessionId: '00000000-0000-4000-8000-000000000395',
        implementedRevision: 1,
        eventCount: 15,
        state: 'finalized',
      },
    }, 201);
    if (url === '/api/verifications') return json({
      ok: true,
      verification: {
        receiptId: '00000000-0000-4000-8000-000000000397',
        implementedRevision: 1,
        environment: 'browser',
        verifierVersion: 'focus-event-verifier-v1',
        overallResult: 'fail',
        manifest: {
          dialogName: 'Delete account',
          dialogDescription: 'Deleting your account is permanent. You can optionally tell us why.',
          role: 'dialog',
          ariaModal: true,
          open: true,
        },
        manifestDigest8: '12345678',
        eventDigest8: '90abcdef',
        checks: [
          { behavior: 'initialFocus', result: 'pass', evidenceSequences: [1, 2] },
          { behavior: 'focusOrder', result: 'pass', evidenceSequences: [4, 5, 6, 7, 8] },
          { behavior: 'trapTab', result: 'pass', evidenceSequences: [3, 4] },
          { behavior: 'trapShiftTab', result: 'pass', evidenceSequences: [11, 12] },
          { behavior: 'escapeAction', result: 'pass', evidenceSequences: [13, 14] },
          { behavior: 'returnFocus', result: 'not_observed', evidenceSequences: [14] },
        ],
        idempotentReplay: false,
      },
    }, 201);
    throw new Error(`unexpected ${url}`);
  }));
  const user = userEvent.setup();
  render(<FocusContractStudio />);
  await user.click(await screen.findByRole('button', { name: 'Run complete rehearsal' }));
  const dialog = screen.getByRole('dialog', { name: 'Delete account' });
  screen.getByRole('button', { name: 'Delete account' }).focus();
  await user.keyboard('{Tab}{Tab}{Tab}{Tab}');
  await user.keyboard('{Shift>}{Tab}{/Shift}{Escape}');
  fireEvent(dialog, new Event('cancel', { cancelable: true }));

  const result = await screen.findByRole('region', { name: 'Raw rehearsal verification' });
  expect(result).toHaveTextContent('Overall result: fail');
  expect(result).toHaveTextContent('Implemented revision 1');
  expect(result).toHaveTextContent('Environment: browser');
  expect(result).toHaveTextContent('Dialog · open · modal');
  expect(result).toHaveTextContent('Delete account');
  expect(result).toHaveTextContent('Manifest 12345678');
  expect(result).toHaveTextContent('Events 90abcdef');
  for (const label of ['Initial focus', 'Focus order', 'Forward Tab wrap', 'Backward Shift+Tab wrap', 'Escape action', 'Return focus']) {
    expect(result).toHaveTextContent(label);
  }
  expect(result).toHaveTextContent('not observed');
  expect(result).toHaveTextContent('Sequences: 14');
  expect(result).toHaveTextContent(/does not prove approval, general conformance, or human operation/i);
  expect(calls.filter((url) => url === '/api/verifications')).toHaveLength(1);
  expect(screen.getAllByRole('status')).toHaveLength(1);
});

test('rehearsal errors are associated with the control and do not steal focus', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/session/bootstrap') return json({
      ok: true,
      data: {
        generation: 1,
        csrfToken: 'page-held-csrf-token',
        activeVariant: { slug: 'delete-account-standard', implementedRevision: 1, viewRevision: 1 },
      },
    }, 201);
    if (url === '/api/focus-review') return json(reviewPayload);
    if (url === '/api/rehearsals/start') return json({
      ok: false,
      error: { code: 'REHEARSAL_START_FAILED', message: 'The rehearsal could not be started.', retryable: true, correlationId: '00000000-0000-4000-8000-000000000399' },
    }, 500);
    throw new Error(`unexpected ${url}`);
  }));
  const user = userEvent.setup();
  render(<FocusContractStudio />);
  const control = await screen.findByRole('button', { name: 'Run complete rehearsal' });
  await user.click(control);
  expect(await screen.findByRole('status')).toHaveTextContent('The rehearsal could not be started.');
  expect(control).toHaveAttribute('aria-describedby', 'rehearsal-status');
  expect(control).toHaveFocus();
});
