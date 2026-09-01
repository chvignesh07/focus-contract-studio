'use client';

import { useEffect, useRef, useState } from 'react';

import {
  CANCEL_CONFIGURATION,
} from '../lib/domain/focus-configuration';
import type {
  InitialFocusManifest,
  InitialFocusTargetId,
} from '../lib/domain/initial-focus-manifest';
import type { ActiveFocusReviewResult } from '../lib/server/active-focus-review';
import {
  Package2ToolRegistry,
  type ModelContextLike,
} from '../lib/webmcp/register';
import {
  DeleteAccountDialog,
  type CapturedFocusRehearsal,
  type FocusRehearsalBinding,
} from './delete-account-dialog';

type BootstrapResult = {
  ok: true;
  data: {
    generation: number;
    csrfToken: string;
    activeVariant: {
      slug: string;
      implementedRevision: number;
      viewRevision: number;
    };
  };
};

type ProposalView = NonNullable<ActiveFocusReviewResult['proposal']> & {
  createdAt?: string;
};

type ProposalResult = {
  ok: true;
  contractVersion: 'fcs-webmcp-v2';
  proposal: ProposalView;
};

type StartRehearsalResult = {
  ok: true;
  rehearsal: FocusRehearsalBinding & { state: 'recording' };
};

type FinalizeRehearsalResult = {
  ok: true;
  rehearsal: {
    rehearsalSessionId: string;
    implementedRevision: number;
    eventCount: number;
    state: 'finalized';
  };
};

type VerificationView = {
  receiptId: string;
  implementedRevision: number;
  environment: 'browser' | 'playwright';
  verifierVersion: 'focus-event-verifier-v1';
  overallResult: 'pass' | 'fail';
  manifest: {
    dialogName: string;
    dialogDescription: string;
    role: string;
    ariaModal: boolean;
    open: boolean;
  };
  manifestDigest8: string;
  eventDigest8: string;
  checks: Array<{
    behavior:
      | 'initialFocus'
      | 'focusOrder'
      | 'trapTab'
      | 'trapShiftTab'
      | 'escapeAction'
      | 'returnFocus';
    result: 'pass' | 'fail' | 'not_observed';
    evidenceSequences: number[];
  }>;
  idempotentReplay: boolean;
  projectedPrecedentCount: number;
};

type VerifyRehearsalResult = {
  ok: true;
  verification: VerificationView;
};

type HistoryRecord = {
  kind: string;
  id: string;
  proposalId?: string;
  proposalDigest8?: string;
  baseRevision?: number;
  status?: string;
  action?: string;
  fromRevision?: number;
  toRevision?: number;
  revision?: number;
  source?: string;
  result?: string;
  projected?: boolean;
  behavior?: string;
  outcomeKey?: string;
  state?: string;
  environment?: string;
  code?: string;
  correlationId?: string;
  occurredAt: number;
};

type HistoryResult = {
  ok: true;
  activeRevision: number;
  records: HistoryRecord[];
};

type ApplyResult = {
  ok: true;
  receipt: {
    receiptId: string;
    proposalId: string;
    proposalDigest8: string;
    fromRevision: number;
    toRevision: number;
    result: 'applied';
    createdAt: string;
    replayed: boolean;
  };
};

type ResetResult = {
  ok: true;
  data: { generation: number; csrfToken: string; replayed: boolean };
};

type ToolState = 'registered' | 'unsupported' | 'error';
type ToolDocument = Document & { modelContext?: ModelContextLike };

const toolCopy: Record<ToolState, string> = {
  registered: 'Two bounded Site tools are registered for this page.',
  unsupported: 'Site tools are unavailable here. The complete review still works on this page.',
  error: 'Site tools could not be registered. The complete review still works on this page.',
};

const checkLabels: Record<VerificationView['checks'][number]['behavior'], string> = {
  initialFocus: 'Initial focus',
  focusOrder: 'Focus order',
  trapTab: 'Forward Tab wrap',
  trapShiftTab: 'Backward Shift+Tab wrap',
  escapeAction: 'Escape action',
  returnFocus: 'Return focus',
};

type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      csrfToken: string;
      review: ActiveFocusReviewResult;
    };

function safeMessage(value: unknown, fallback: string): string {
  if (
    value &&
    typeof value === 'object' &&
    'error' in value &&
    value.error &&
    typeof value.error === 'object' &&
    'message' in value.error &&
    typeof value.error.message === 'string'
  ) {
    return value.error.message;
  }
  return fallback;
}

async function jsonResponse<T>(response: Response, fallback: string): Promise<T> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error(fallback);
  }
  if (!response.ok) throw new Error(safeMessage(value, fallback));
  return value as T;
}

function mutationMessage(error: unknown, fallback: string): string {
  return error instanceof TypeError
    ? fallback
    : error instanceof Error
      ? error.message
      : fallback;
}

function targetLabel(value: string | null): string {
  if (!value) return 'NONE';
  return value.replace(/-(button|input)$/u, '').replace(/-/gu, ' ').toUpperCase();
}

function titleCaseTarget(value: string): string {
  const label = value.replace(/-(button|input)$/u, '').replace(/-/gu, ' ');
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function fullTargetLabel(value: string): string {
  const label = value.replace(/-/gu, ' ');
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

async function fetchReview(signal?: AbortSignal): Promise<ActiveFocusReviewResult> {
  return jsonResponse<ActiveFocusReviewResult>(
    await fetch('/api/focus-review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    }),
    'The current review could not be loaded.',
  );
}

async function fetchHistory(signal?: AbortSignal): Promise<HistoryResult> {
  return jsonResponse<HistoryResult>(
    await fetch('/api/focus-history', {
      method: 'GET', credentials: 'same-origin', cache: 'no-store', signal,
    }),
    'The durable history could not be loaded.',
  );
}

export function FocusContractStudio() {
  const [page, setPage] = useState<PageState>({ kind: 'loading' });
  const [proposal, setProposal] = useState<ProposalView | null>(null);
  const [observedTarget, setObservedTarget] = useState<string | null>(null);
  const [activity, setActivity] = useState('No proposal has changed the implemented revision.');
  const [proposalBusy, setProposalBusy] = useState(false);
  const [novelResponsibilityAccepted, setNovelResponsibilityAccepted] = useState(false);
  const [recoveringProposal, setRecoveringProposal] = useState(false);
  const [rehearsalBusy, setRehearsalBusy] = useState(false);
  const [verification, setVerification] = useState<VerificationView | null>(null);
  const [toolState, setToolState] = useState<ToolState>('unsupported');
  const [history, setHistory] = useState<HistoryResult | null>(null);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | 'revoke' | 'edit' | 'apply' | 'undo' | 'reset' | null>(null);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [applicationReceipt, setApplicationReceipt] = useState<ApplyResult['receipt'] | null>(null);
  const pendingProposalKey = useRef<string | null>(null);
  const pendingMutation = useRef<{ action: string; key: string } | null>(null);
  const receiptDialog = useRef<HTMLDialogElement>(null);
  const receiptCancel = useRef<HTMLButtonElement>(null);
  const confirmationButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const bootstrap = await jsonResponse<BootstrapResult>(
          await fetch('/api/session/bootstrap', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{}',
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          }),
          'The isolated demo could not be prepared.',
        );
        const review = await fetchReview(controller.signal);
        const loadedHistory = await fetchHistory(controller.signal).catch(() => null);
        if (controller.signal.aborted) return;
        setProposal(review.proposal);
        setObservedTarget(review.review.observation?.observedInitialFocus ?? null);
        setHistory(loadedHistory);
        setPage({
          kind: 'ready',
          csrfToken: bootstrap.data.csrfToken,
          review,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setPage({
          kind: 'error',
          message: error instanceof Error ? error.message : 'The review could not be loaded.',
        });
      }
    })();
    return () => controller.abort();
  }, []);

  const toolCsrfToken = page.kind === 'ready' ? page.csrfToken : null;
  useEffect(() => {
    if (!toolCsrfToken) return;
    const modelContext = (document as ToolDocument).modelContext;
    if (typeof modelContext?.registerTool !== 'function') return;
    const registry = new Package2ToolRegistry({
      csrfToken: toolCsrfToken,
      fetcher: window.fetch.bind(window),
    });
    let mounted = true;
    void registry
      .install(modelContext)
      .then(() => {
        if (mounted) setToolState('registered');
      })
      .catch(() => {
        if (mounted) setToolState('error');
      });
    return () => {
      mounted = false;
      registry.dispose();
    };
  }, [toolCsrfToken]);

  useEffect(() => {
    if (applicationReceipt && !receiptDialog.current?.open) {
      receiptDialog.current?.showModal();
      receiptCancel.current?.focus();
    }
  }, [applicationReceipt]);

  useEffect(() => {
    if (confirmAction) confirmationButton.current?.focus();
  }, [confirmAction]);

  if (page.kind === 'loading') {
    return (
      <main className="loading-shell">
        <p aria-live="polite" role="status">
          Preparing an isolated demo and loading its current review…
        </p>
      </main>
    );
  }

  if (page.kind === 'error') {
    return (
      <main className="loading-shell">
        <h1>Focus Contract Studio</h1>
        <p role="alert">{page.message}</p>
        <p>No implemented revision changed. Reload to create a new isolated demo.</p>
      </main>
    );
  }

  const { review, csrfToken } = page;
  const evidence = review.retrieval.records;
  const precedentOutcome = review.review.precedentComparison.precedentOutcome;
  const canCreate =
    !proposal &&
    review.retrieval.disposition === 'results' &&
    evidence.some(
      ({ recordId, outcomeKey }) =>
        recordId === 'D001' && outcomeKey === 'cancel-button',
    );
  const canCreateReviewerNovel =
    !proposal && review.retrieval.disposition !== 'results' && novelResponsibilityAccepted;

  async function recordInitialFocus(
    targetId: InitialFocusTargetId,
    clientOffsetMs: number,
    manifest: InitialFocusManifest,
  ) {
    setActivity(`Browser reported opening focus: ${targetLabel(targetId)}. Saving bounded telemetry…`);
    try {
      await jsonResponse(
        await fetch('/api/observations/initial-focus', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-fcs-csrf': csrfToken,
          },
              body: JSON.stringify({
                firstTargetId: targetId,
                clientOffsetMs,
                manifest,
          }),
          credentials: 'same-origin',
          cache: 'no-store',
        }),
        'The opening observation was not saved.',
      );
      setObservedTarget(targetId);
      const refreshed = await fetchReview();
      setPage({ kind: 'ready', csrfToken, review: refreshed });
      setProposal(refreshed.proposal);
      setActivity(`Browser report recorded: ${targetLabel(targetId)}. Typed values were not captured.`);
    } catch (error) {
      setActivity(error instanceof Error ? error.message : 'The observation was not saved.');
    }
  }

  async function startCompleteRehearsal(): Promise<FocusRehearsalBinding> {
    setVerification(null);
    setActivity('Starting one bounded raw browser rehearsal…');
    const result = await jsonResponse<StartRehearsalResult>(
      await fetch('/api/rehearsals/start', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-fcs-csrf': csrfToken,
        },
        body: JSON.stringify({ environment: 'browser' }),
        credentials: 'same-origin',
        cache: 'no-store',
      }),
      'The raw rehearsal could not be started.',
    );
    setActivity(
      'Rehearsal recording is active. Complete forward wrap, backward wrap, then Escape.',
    );
    return result.rehearsal;
  }

  async function finalizeCompleteRehearsal(capture: CapturedFocusRehearsal) {
    setRehearsalBusy(true);
    setActivity('Freezing allowlisted browser facts without typed values…');
    try {
      const result = await jsonResponse<FinalizeRehearsalResult>(
        await fetch(`/api/rehearsals/${capture.rehearsalSessionId}/finalize`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-fcs-csrf': csrfToken,
          },
          body: JSON.stringify({
            manifest: capture.manifest,
            events: capture.events,
          }),
          credentials: 'same-origin',
          cache: 'no-store',
        }),
        'The raw rehearsal could not be finalized.',
      );
      setActivity(
        `Raw rehearsal finalized with ${result.rehearsal.eventCount} allowlisted events. Running independent verification…`,
      );
      const verified = await jsonResponse<VerifyRehearsalResult>(
        await fetch('/api/verifications', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-fcs-csrf': csrfToken,
          },
          body: JSON.stringify({
            rehearsalSessionId: result.rehearsal.rehearsalSessionId,
            implementedRevision: result.rehearsal.implementedRevision,
          }),
          credentials: 'same-origin',
          cache: 'no-store',
        }),
        'The raw rehearsal could not be verified.',
      );
      setVerification(verified.verification);
      const nextHistory = await fetchHistory().catch(() => null);
      if (nextHistory) setHistory(nextHistory);
      setActivity(
        `Verification ${verified.verification.overallResult}. Implemented revision ${verified.verification.implementedRevision} did not change.`,
      );
    } catch (error) {
      setActivity(
        error instanceof Error
          ? error.message
          : 'The raw rehearsal could not be finalized.',
      );
    } finally {
      setRehearsalBusy(false);
    }
  }

  async function createCancelProposal() {
    if (!canCreate || proposalBusy) return;
    setProposalBusy(true);
    pendingProposalKey.current ??= crypto.randomUUID();
    setRecoveringProposal(true);
    setActivity('Staging one immutable Cancel-first proposal…');
    try {
      const result = await jsonResponse<ProposalResult>(
        await fetch('/api/focus-proposals', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-fcs-csrf': csrfToken,
          },
          body: JSON.stringify({
            baseImplementedRevision: review.review.implementedRevision,
            configuration: CANCEL_CONFIGURATION,
            evidenceQueryToken: review.retrieval.queryToken,
            evidenceRecordIds: ['D001'],
            summary: 'Focus Cancel first for this destructive confirmation dialog.',
            idempotencyKey: pendingProposalKey.current,
          }),
          credentials: 'same-origin',
          cache: 'no-store',
        }),
        'The proposal outcome is uncertain. Retry recovers it with the same key.',
      );
      setProposal(result.proposal);
      pendingProposalKey.current = null;
      setRecoveringProposal(false);
      setActivity('Proposal saved for exact UI review. Revision 1 remains implemented.');
    } catch (error) {
      setActivity(mutationMessage(
        error,
        'The proposal outcome is uncertain. Retry recovers it with the same key.',
      ));
    } finally {
      setProposalBusy(false);
    }
  }

  async function createReviewerNovelProposal() {
    if (!canCreateReviewerNovel || proposalBusy) return;
    setProposalBusy(true);
    pendingProposalKey.current ??= crypto.randomUUID();
    setRecoveringProposal(true);
    setActivity('Staging one reviewer-authored novel proposal without precedent support…');
    try {
      await jsonResponse(
        await fetch('/api/focus-proposals/reviewer', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-fcs-csrf': csrfToken },
          body: JSON.stringify({
            configuration: CANCEL_CONFIGURATION,
            summary: 'Reviewer-authored novel Cancel-first proposal without supporting precedent.',
            responsibilityAccepted: true,
            idempotencyKey: pendingProposalKey.current,
          }),
          credentials: 'same-origin', cache: 'no-store',
        }),
        'The reviewer proposal outcome is uncertain. Retry recovers it with the same key.',
      );
      await refreshCommittedState();
      pendingProposalKey.current = null;
      setRecoveringProposal(false);
      setNovelResponsibilityAccepted(false);
      setActivity('Reviewer-authored novel proposal saved. No precedent is presented as support.');
    } catch (error) {
      setActivity(mutationMessage(
        error,
        'The reviewer proposal outcome is uncertain. Retry recovers it with the same key.',
      ));
    } finally {
      setProposalBusy(false);
    }
  }

  async function refreshCommittedState(nextCsrfToken = csrfToken) {
    const [nextReview, nextHistory] = await Promise.all([
      fetchReview(), fetchHistory(),
    ]);
    setPage({ kind: 'ready', csrfToken: nextCsrfToken, review: nextReview });
    setProposal(nextReview.proposal);
    setObservedTarget(nextReview.review.observation?.observedInitialFocus ?? null);
    setHistory(nextHistory);
  }

  function beginMutation(action: NonNullable<typeof confirmAction>) {
    if (mutationBusy) return;
    if (pendingMutation.current?.action !== action) {
      pendingMutation.current = { action, key: crypto.randomUUID() };
    }
    setConfirmAction(action);
    setActivity(`Confirmation opened for ${action}. Focus moved to the deliberate confirm action.`);
  }

  async function executeReview(action: 'approve' | 'reject' | 'revoke' | 'edit') {
    if (!proposal || mutationBusy) return;
    beginMutation(action);
    const pending = pendingMutation.current;
    if (!pending) return;
    setMutationBusy(true);
    setActivity(`Committing exact ${action} authority…`);
    try {
      await jsonResponse(
        await fetch(`/api/focus-proposals/${proposal.proposalId}/review`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-fcs-csrf': csrfToken },
          body: JSON.stringify(action === 'edit' ? {
            action,
            configuration: { ...CANCEL_CONFIGURATION, initialFocus: 'reason-input' },
            summary: 'Reviewer-authored reason-first child proposal.',
            idempotencyKey: pending.key,
          } : { action, idempotencyKey: pending.key }),
          credentials: 'same-origin', cache: 'no-store',
        }),
        `The ${action} outcome is uncertain. Retry recovers it with the same key.`,
      );
      await refreshCommittedState();
      pendingMutation.current = null;
      setConfirmAction(null);
      setActivity(`${action.charAt(0).toUpperCase() + action.slice(1)} committed. The implemented revision did not change.`);
    } catch (error) {
      setActivity(mutationMessage(error, `The ${action} outcome is uncertain. Retry recovers it with the same key.`));
    } finally {
      setMutationBusy(false);
    }
  }

  async function executeApply() {
    if (!proposal || mutationBusy) return;
    beginMutation('apply');
    const pending = pendingMutation.current;
    if (!pending) return;
    setMutationBusy(true);
    setActivity('Applying the exact current approval…');
    try {
      const result = await jsonResponse<ApplyResult>(
        await fetch(`/api/focus-proposals/${proposal.proposalId}/apply`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-fcs-csrf': csrfToken },
          body: JSON.stringify({
            expectedImplementedRevision: review.review.implementedRevision,
            idempotencyKey: pending.key,
          }),
          credentials: 'same-origin', cache: 'no-store',
        }),
        'The application outcome is uncertain. Retry recovers the receipt with the same key.',
      );
      setApplicationReceipt(result.receipt);
      await refreshCommittedState();
      pendingMutation.current = null;
      setConfirmAction(null);
      setActivity(`Application committed as implemented revision ${result.receipt.toRevision}. Run a fresh rehearsal and verification.`);
    } catch (error) {
      setActivity(mutationMessage(
        error,
        'The application outcome is uncertain. Retry recovers the receipt with the same key.',
      ));
    } finally {
      setMutationBusy(false);
    }
  }

  async function executeUndo() {
    if (!history || history.activeRevision <= 1 || mutationBusy) return;
    beginMutation('undo');
    const pending = pendingMutation.current;
    if (!pending) return;
    setMutationBusy(true);
    setActivity('Creating a later restoration revision…');
    try {
      await jsonResponse(
        await fetch('/api/focus-revisions/1/undo', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-fcs-csrf': csrfToken },
          body: JSON.stringify({
            expectedImplementedRevision: history.activeRevision,
            idempotencyKey: pending.key,
          }),
          credentials: 'same-origin', cache: 'no-store',
        }),
        'The undo outcome is uncertain. Retry recovers it with the same key.',
      );
      await refreshCommittedState();
      pendingMutation.current = null;
      setConfirmAction(null);
      setActivity('Undo committed as a later revision. Earlier approval remains invalid.');
    } catch (error) {
      setActivity(mutationMessage(error, 'The undo outcome is uncertain. Retry recovers it with the same key.'));
    } finally {
      setMutationBusy(false);
    }
  }

  async function executeReset() {
    if (mutationBusy) return;
    beginMutation('reset');
    const pending = pendingMutation.current;
    if (!pending) return;
    setMutationBusy(true);
    setActivity('Resetting only this anonymous workspace…');
    try {
      const reset = await jsonResponse<ResetResult>(
        await fetch('/api/session/reset', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-fcs-csrf': csrfToken },
          body: JSON.stringify({ idempotencyKey: pending.key }),
          credentials: 'same-origin', cache: 'no-store',
        }),
        'The reset outcome is uncertain. Retry recovers it with the same key.',
      );
      await refreshCommittedState(reset.data.csrfToken);
      pendingMutation.current = null;
      setConfirmAction(null);
      setApplicationReceipt(null);
      setVerification(null);
      setActivity(`Workspace reset recovered generation ${reset.data.generation}.`);
    } catch (error) {
      setActivity(mutationMessage(error, 'The reset outcome is uncertain. Retry recovers it with the same key.'));
    } finally {
      setMutationBusy(false);
    }
  }

  return (
    <main className="studio-shell">
      <header className="top-rail">
        <div>
          <a className="brand" href="#review">
            Focus Contract Studio
          </a>
          <p>Human precedent guides the next repair. Exact review controls permission.</p>
        </div>
        <p className="demo-label">Demo · Anonymous</p>
      </header>

      <section aria-labelledby="review-heading" className="hero" id="review">
        <div className="hero-heading">
          <div>
            <p className="eyebrow">Package 5 · Observe → Review → Apply → Verify → Undo</p>
            <h1 id="review-heading">Review one real focus decision</h1>
          </div>
          <div className="state-chips" aria-label="Current decision state">
            <span>IMPLEMENTED REVISION {review.review.implementedRevision}</span>
            <span>
              OBSERVED: {observedTarget ? targetLabel(observedTarget) : 'NOT YET CAPTURED'}
            </span>
            <span>PRECEDENT: {targetLabel(precedentOutcome)}</span>
          </div>
        </div>

        {proposal ? <ProposalBanner activeRevision={review.review.implementedRevision} proposal={proposal} /> : null}

        <div className="review-grid">
          <section aria-labelledby="observe-heading" className="panel dialog-panel">
            <p className="stage-number">01 · Observe</p>
            <h2 id="observe-heading">Live delete-account dialog</h2>
            <p className="panel-copy">
              Revision {review.review.implementedRevision} renders the committed focus
              configuration. Open the native dialog to capture the browser&apos;s actual
              first focus target.
            </p>
            <div className="configuration-card">
              <span>Active variant</span>
              <strong>{review.review.variant.replace(/-/gu, ' ')}</strong>
              <span>Configured initial focus</span>
              <strong>{titleCaseTarget(review.review.implemented.initialFocus)}</strong>
            </div>
            <DeleteAccountDialog
              busy={rehearsalBusy}
              configuration={review.review.implemented}
              onFirstFocus={(target, offset, manifest) =>
                void recordInitialFocus(target, offset, manifest)
              }
              onSyntheticDelete={() =>
                setActivity('Synthetic demo only: no account or private data was changed.')
              }
              onStartRehearsal={startCompleteRehearsal}
              onRehearsalComplete={(capture) =>
                void finalizeCompleteRehearsal(capture)
              }
              onRehearsalError={setActivity}
            />
            <p className="privacy-note">
              This synthetic demo stores untrusted browser-reported target IDs, bounded
              timing, and allowlisted dialog facts only. It never records text entered in
              the reason field and the report cannot approve or apply a change.
            </p>
          </section>

          <section aria-labelledby="precedent-heading" className="panel precedent-panel">
            <p className="stage-number">02 · Precedent</p>
            <h2 id="precedent-heading">{review.review.precedentComparison.label.replace(/_/gu, ' ')}</h2>
            <div className="comparison">
              <div>
                <span>Implemented / observed</span>
                <strong>{titleCaseTarget(review.review.implemented.initialFocus)}</strong>
              </div>
              <span aria-hidden="true">≠</span>
              <div>
                <span>Applicable precedent</span>
                <strong>{titleCaseTarget(precedentOutcome ?? 'none')}</strong>
              </div>
            </div>
            <p className="evidence-warning">EVIDENCE ONLY — NOT APPROVAL</p>
            {evidence.length > 0 ? (
              <div className="evidence-list">
                {evidence.map((record) => (
                  <article className="evidence-card" key={record.recordId}>
                    <div className="evidence-title">
                      <code>{record.recordId}</code>
                      <strong>{titleCaseTarget(record.outcomeKey)}</strong>
                    </div>
                    <p>{record.rationaleExcerpt}</p>
                    <dl>
                      <div><dt>Scope</dt><dd>{record.applicability}</dd></div>
                      <div><dt>Ranks</dt><dd>{record.ranks.map((rank) => rank ?? '—').join(' · ')}</dd></div>
                      <div><dt>RRF</dt><dd>{record.rrf}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            ) : (
              <p>No eligible precedent was returned. No agent proposal can be created; a reviewer may accept responsibility for a novel proposal.</p>
            )}
            <button
              className="button button-primary"
              disabled={!canCreate || proposalBusy}
              onClick={() => void createCancelProposal()}
              type="button"
            >
              {proposalBusy
                ? 'Saving proposal…'
                : recoveringProposal
                  ? 'Recover proposal outcome'
                  : 'Create Cancel proposal'}
            </button>
            {review.retrieval.disposition !== 'results' && !proposal ? (
              <div className="reviewer-novel-path">
                <label>
                  <input
                    checked={novelResponsibilityAccepted}
                    onChange={(event) => setNovelResponsibilityAccepted(event.currentTarget.checked)}
                    type="checkbox"
                  />
                  I accept responsibility for a novel Cancel-first proposal without supporting precedent.
                </label>
                <button
                  className="button button-secondary"
                  disabled={!canCreateReviewerNovel || proposalBusy}
                  onClick={() => void createReviewerNovelProposal()}
                  type="button"
                >
                  {recoveringProposal ? 'Recover reviewer proposal outcome' : 'Create reviewer novel proposal'}
                </button>
              </div>
            ) : null}
          </section>
        </div>

        {verification ? <VerificationResult verification={verification} /> : null}

        {proposal ? (
          <ProposalReview
            busy={mutationBusy}
            implemented={review.review.implemented}
            onAction={beginMutation}
            proposal={proposal}
          />
        ) : null}

        {confirmAction ? (
          <section aria-labelledby="confirmation-heading" className="confirmation-panel">
            <h2 id="confirmation-heading">Confirm {confirmAction}</h2>
            <p>
              This deliberate visible action uses one recoverable key. Evidence and
              verification cannot authorize it.
            </p>
            <div className="rehearsal-actions">
              <button
                className="button button-primary"
                disabled={mutationBusy}
                onClick={() => {
                  if (confirmAction === 'apply') void executeApply();
                  else if (confirmAction === 'undo') void executeUndo();
                  else if (confirmAction === 'reset') void executeReset();
                  else void executeReview(confirmAction);
                }}
                ref={confirmationButton}
                type="button"
              >
                {mutationBusy ? `Recovering ${confirmAction}…` : `Confirm ${confirmAction}`}
              </button>
              <button
                className="button button-secondary"
                disabled={mutationBusy}
                onClick={() => {
                  pendingMutation.current = null;
                  setConfirmAction(null);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        <section aria-labelledby="history-heading" className="boundary-panel">
          <p className="stage-number">05 · Durable history and recovery</p>
          <h2 id="history-heading">Chronological committed state</h2>
          {history?.records.length ? (
            <ol className="history-list">
              {history.records.map((record) => (
                <li key={`${record.kind}-${record.id}`}>
                  <strong>{record.kind}</strong>{' '}
                  <span>{historyLabel(record)}</span>
                </li>
              ))}
            </ol>
          ) : <p>No committed Package 5 history is available yet.</p>}
          <div className="rehearsal-actions">
            <button
              className="button button-secondary"
              disabled={!history || history.activeRevision <= 1 || mutationBusy}
              onClick={() => beginMutation('undo')}
              type="button"
            >
              Undo to revision 1
            </button>
            <button
              className="button button-danger"
              disabled={mutationBusy}
              onClick={() => beginMutation('reset')}
              type="button"
            >
              Reset this workspace
            </button>
          </div>
        </section>

        <dialog aria-labelledby="receipt-heading" className="receipt-dialog" ref={receiptDialog}>
          <h2 id="receipt-heading">Application committed</h2>
          {applicationReceipt ? (
            <p>
              Receipt <code>{applicationReceipt.receiptId}</code> advanced revision{' '}
              {applicationReceipt.fromRevision} to {applicationReceipt.toRevision}.
            </p>
          ) : null}
          <p>Run a fresh raw rehearsal before independent verification can project precedent.</p>
          <div className="rehearsal-actions">
            <button
              autoFocus
              className="button button-secondary"
              onClick={() => receiptDialog.current?.close()}
              ref={receiptCancel}
              type="button"
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              onClick={() => receiptDialog.current?.close()}
              type="button"
            >
              Rehearse revision {applicationReceipt?.toRevision ?? ''}
            </button>
          </div>
        </dialog>

        <p aria-live="polite" className="activity-status" id="rehearsal-status" role="status">
          {activity}
        </p>
        <p className="tool-status" data-tool-state={toolState}>
          {toolCopy[toolState]}
        </p>
      </section>
    </main>
  );
}

function VerificationResult({ verification }: { verification: VerificationView }) {
  return (
    <section
      aria-labelledby="verification-heading"
      className={`verification-result verification-${verification.overallResult}`}
      role="region"
    >
      <p className="stage-number">03 · Independent verification</p>
      <h2 id="verification-heading">Raw rehearsal verification</h2>
      <p className="verification-overall">
        Overall result: <strong>{verification.overallResult}</strong>
      </p>
      <p>
        Runtime precedent projected: <strong>{verification.projectedPrecedentCount ?? 0}</strong>
      </p>
      <div className="verification-manifest">
        <p>
          Implemented revision {verification.implementedRevision} · Environment:{' '}
          {verification.environment}
        </p>
        <p>
          {verification.manifest.role.charAt(0).toUpperCase() + verification.manifest.role.slice(1)}
          {' · '}{verification.manifest.open ? 'open' : 'closed'}
          {' · '}{verification.manifest.ariaModal ? 'modal' : 'non-modal'}
        </p>
        <p><strong>{verification.manifest.dialogName}</strong></p>
        <p>{verification.manifest.dialogDescription}</p>
        <p className="verification-digests">
          Manifest <code>{verification.manifestDigest8}</code> · Events{' '}
          <code>{verification.eventDigest8}</code>
        </p>
      </div>
      <ol className="verification-checks">
        {verification.checks.map((check) => (
          <li className={`verification-check check-${check.result}`} key={check.behavior}>
            <strong>{checkLabels[check.behavior]}</strong>
            <span>{check.result.replace('_', ' ')}</span>
            <span>
              Sequences: {check.evidenceSequences.length > 0
                ? check.evidenceSequences.join(', ')
                : 'none'}
            </span>
          </li>
        ))}
      </ol>
      <p className="verification-boundary">
        This verification compares one raw rehearsal with the named implemented
        revision. It does not prove approval, general conformance, or human operation.
      </p>
    </section>
  );
}

function historyLabel(record: HistoryRecord): string {
  if (record.kind === 'proposal') return `${record.proposalDigest8 ?? record.id.slice(0, 8)} · ${record.status}`;
  if (record.kind === 'decision') return `${record.action} · proposal ${record.proposalId?.slice(0, 8)}`;
  if (record.kind === 'application') return `revision ${record.fromRevision} → ${record.toRevision}`;
  if (record.kind === 'revision') return `revision ${record.revision} · ${record.source}`;
  if (record.kind === 'verification') return `revision ${record.revision} · ${record.result}${record.projected ? ' · projected' : ''}`;
  if (record.kind === 'projection') return `${record.behavior} → ${record.outcomeKey}`;
  if (record.kind === 'rehearsal') return `revision ${record.revision} · ${record.state} · ${record.environment}`;
  if (record.kind === 'reset' || record.kind === 'failure') return `${record.code ?? record.kind} · ${record.correlationId?.slice(0, 8) ?? record.id.slice(0, 8)}`;
  return record.id.slice(0, 8);
}

function ProposalBanner({
  activeRevision,
  proposal,
}: {
  activeRevision: number;
  proposal: ProposalView;
}) {
  return (
    <section aria-label="Proposal state" className="proposal-banner">
      <div>
        <p className="proposal-label">{proposal.label}</p>
        <p>Proposal {proposal.proposalDigest8} is staged for exact UI review.</p>
      </div>
      <strong>
        {proposal.applied
          ? `Implemented revision ${activeRevision}`
          : `Implemented revision remains ${activeRevision}`}
      </strong>
    </section>
  );
}

function ProposalReview({
  busy,
  implemented,
  onAction,
  proposal,
}: {
  busy: boolean;
  implemented: ActiveFocusReviewResult['review']['implemented'];
  onAction: (action: 'approve' | 'reject' | 'revoke' | 'edit' | 'apply' | 'undo' | 'reset') => void;
  proposal: ProposalView;
}) {
  return (
    <section aria-labelledby="proposal-heading" className="proposal-section">
      <p className="stage-number">03 · Immutable proposal review</p>
      <h2 id="proposal-heading">Complete exact authority</h2>
      <dl className="proposal-authority">
        <div><dt>Status</dt><dd>{proposal.label} · {proposal.status}</dd></div>
        <div><dt>Digest</dt><dd><code>{proposal.proposalDigest ?? proposal.proposalDigest8}</code></dd></div>
        <div><dt>Base revision</dt><dd>{proposal.baseImplementedRevision}</dd></div>
        <div><dt>Author</dt><dd>{proposal.authorKind ?? 'agent'}</dd></div>
        <div><dt>Parent</dt><dd>{proposal.parentProposalId ?? 'None'}</dd></div>
        <div><dt>Created</dt><dd>{proposal.createdAt ?? 'Committed time unavailable'}</dd></div>
        <div><dt>Summary</dt><dd>{proposal.summary ?? 'Focus Cancel first.'}</dd></div>
      </dl>
      <div className="table-scroll">
        <table aria-label="Proposed focus change">
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Implemented revision {proposal.baseImplementedRevision}</th>
              <th scope="col">Proposed</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Initial focus</th>
              <td>{fullTargetLabel(implemented.initialFocus)}</td>
              <td>{fullTargetLabel(proposal.configuration?.initialFocus ?? 'cancel-button')}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="support-note">
        {proposal.fieldEvidence.length > 0
          ? proposal.fieldEvidence.map((entry) =>
              `Supported by ${entry.recordId} · outcome ${fullTargetLabel(entry.outcomeKey)}`,
            ).join(' · ')
          : 'Reviewer-authored novel change · no precedent supports this proposed value.'}
        {' '}EVIDENCE ONLY — NEVER APPROVAL.
      </p>
      <div className="rehearsal-actions" aria-label="Visible proposal decisions">
        {proposal.status === 'proposed' ? (
          <>
            <button className="button button-primary" disabled={busy} onClick={() => onAction('approve')} type="button">Approve exact proposal</button>
            <button className="button button-secondary" disabled={busy} onClick={() => onAction('reject')} type="button">Reject proposal</button>
            <button className="button button-secondary" disabled={busy} onClick={() => onAction('edit')} type="button">Edit as child proposal</button>
          </>
        ) : null}
        {proposal.status === 'approved' ? (
          <>
            <button className="button button-primary" disabled={busy} onClick={() => onAction('apply')} type="button">Apply approved proposal</button>
            <button className="button button-secondary" disabled={busy} onClick={() => onAction('revoke')} type="button">Revoke approval</button>
          </>
        ) : null}
      </div>
    </section>
  );
}
