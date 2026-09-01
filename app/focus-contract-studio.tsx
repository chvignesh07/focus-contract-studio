'use client';

import { useEffect, useRef, useState } from 'react';

import {
  CANCEL_CONFIGURATION,
} from '../lib/domain/focus-configuration';
import {
  derivePackage6Stages,
  operationState,
  stateKindForPublicCode,
  type Package6OperationKind,
  type Package6OperationState,
  type Package6Variant,
  type RevisionChange,
} from '../lib/domain/package6';
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
      slug: Package6Variant;
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

type ActiveVariantResult = {
  ok: true;
  data: {
    variant: Package6Variant;
    viewRevision: number;
  };
};

type ApplicationReceiptView = {
  receiptId: string;
  proposalId?: string;
  proposalDigest8?: string;
  fromRevision: number;
  toRevision: number;
  createdAt?: string;
};

type ToolState = 'registered' | 'unsupported' | 'error';
type ToolDocument = Document & { modelContext?: ModelContextLike };

const toolCopy: Record<ToolState, string> = {
  registered: 'Two bounded Site tools are registered for this page.',
  unsupported: 'Site tools are unavailable; the complete human workflow remains available.',
  error: 'Site tools could not be registered; the complete human workflow remains available.',
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
  | { kind: 'error'; operation: Package6OperationState }
  | {
      kind: 'ready';
      csrfToken: string;
      generation: number;
      activeVariant: {
        slug: Package6Variant;
        viewRevision: number;
      };
      review: ActiveFocusReviewResult;
    };

class PublicOperationError extends Error {
  readonly code: string;
  readonly correlationId: string;
  readonly retryable: boolean;

  constructor(input: {
    code: string;
    message: string;
    correlationId: string;
    retryable: boolean;
  }) {
    super(input.message);
    this.name = 'PublicOperationError';
    this.code = input.code;
    this.correlationId = input.correlationId;
    this.retryable = input.retryable;
  }
}

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
  if (!response.ok) {
    const publicError =
      value &&
      typeof value === 'object' &&
      'error' in value &&
      value.error &&
      typeof value.error === 'object' &&
      'code' in value.error &&
      typeof value.error.code === 'string' &&
      'correlationId' in value.error &&
      typeof value.error.correlationId === 'string'
        ? value.error as {
            code: string;
            message?: unknown;
            correlationId: string;
            retryable?: unknown;
          }
        : null;
    if (publicError) {
      throw new PublicOperationError({
        code: publicError.code,
        message:
          typeof publicError.message === 'string'
            ? publicError.message
            : fallback,
        correlationId: publicError.correlationId,
        retryable: publicError.retryable === true,
      });
    }
    throw new Error(safeMessage(value, fallback));
  }
  return value as T;
}

function operationForError(
  error: unknown,
  fallback: string,
): Package6OperationState {
  if (error instanceof PublicOperationError) {
    return operationState(stateKindForPublicCode(error.code), {
      happened: error.message,
      code: error.code,
      correlationId: error.correlationId,
    });
  }
  return operationState(
    error instanceof TypeError ? 'uncertainNetwork' : 'validationFailure',
    {
      happened: error instanceof Error ? error.message : fallback,
      correlationId: crypto.randomUUID(),
    },
  );
}

function activityKind(message: string): Package6OperationKind {
  if (/verification pass/iu.test(message)) return 'verifiedPass';
  if (/verification fail/iu.test(message)) return 'verifiedFailure';
  if (/outcome is uncertain|uncertain response/iu.test(message)) {
    return 'uncertainNetwork';
  }
  if (/recover|starting|staging|freezing|running|committing|applying|resetting|creating/iu.test(message)) {
    return 'recovery';
  }
  if (/could not|not saved|failed|invalid/iu.test(message)) {
    return 'validationFailure';
  }
  return 'success';
}

function activityRevisionChange(message: string): RevisionChange {
  if (/outcome is uncertain|recover/iu.test(message)) return 'unknown';
  if (/application committed as implemented revision|undo committed|workspace reset/iu.test(message)) {
    return 'yes';
  }
  return 'no';
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

function focusFieldLabel(field: ProposalView['changedFields'][number]): string {
  return {
    initialFocus: 'Initial focus',
    focusOrder: 'Focus order',
    trapTab: 'Forward Tab boundary',
    trapShiftTab: 'Backward Shift+Tab boundary',
    escapeAction: 'Escape action',
    returnFocus: 'Return focus',
  }[field];
}

function configurationValue(
  configuration: ActiveFocusReviewResult['review']['implemented'],
  field: ProposalView['changedFields'][number],
): string {
  const value = configuration[field];
  if (Array.isArray(value)) return value.map(fullTargetLabel).join(' → ');
  return field === 'initialFocus' || field === 'returnFocus'
    ? fullTargetLabel(value)
    : value.replace(/-/gu, ' ');
}

function receiptText(receipt: ApplicationReceiptView): string {
  return [
    'Focus Contract Studio application receipt',
    `Receipt: ${receipt.receiptId}`,
    `Revision: ${receipt.fromRevision} -> ${receipt.toRevision}`,
    receipt.proposalId ? `Proposal: ${receipt.proposalId}` : null,
    receipt.proposalDigest8 ? `Proposal digest: ${receipt.proposalDigest8}` : null,
    receipt.createdAt ? `Committed: ${receipt.createdAt}` : null,
  ].filter(Boolean).join('\n');
}

async function copyText(value: string): Promise<void> {
  if (typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // The API can exist while permission is denied; use the user-activated native fallback.
    }
  }
  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  const copied =
    typeof document.execCommand === 'function' && document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('The receipt could not be copied.');
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
  const [activity, setActivityState] = useState<Package6OperationState>(
    operationState('empty', {
      happened: 'No proposal has changed the implemented revision.',
    }),
  );
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
  const [reviewAcknowledgedKey, setReviewAcknowledgedKey] = useState<string | null>(null);
  const [variantBusy, setVariantBusy] = useState(false);
  const [rehearsalRequest, setRehearsalRequest] = useState(0);
  const pendingProposalKey = useRef<string | null>(null);
  const pendingMutation = useRef<{ action: string; key: string } | null>(null);
  const readController = useRef<AbortController | null>(null);
  const receiptDialog = useRef<HTMLDialogElement>(null);
  const receiptCancel = useRef<HTMLButtonElement>(null);
  const confirmationButton = useRef<HTMLButtonElement>(null);

  function setActivity(
    happened: string,
    kind = activityKind(happened),
    revisionChanged = activityRevisionChange(happened),
  ) {
    setActivityState(operationState(kind, {
      happened,
      revisionChanged,
      correlationId: crypto.randomUUID(),
    }));
  }

  function setActivityError(error: unknown, fallback: string) {
    setActivityState(operationForError(error, fallback));
  }

  useEffect(() => {
    const controller = new AbortController();
    readController.current = controller;
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
          generation: bootstrap.data.generation,
          activeVariant: {
            slug: bootstrap.data.activeVariant.slug,
            viewRevision: bootstrap.data.activeVariant.viewRevision,
          },
          review,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setPage({
          kind: 'error',
          operation: operationForError(error, 'The review could not be loaded.'),
        });
      }
    })();
    return () => {
      controller.abort();
      readController.current?.abort();
      readController.current = null;
    };
  }, []);

  const toolCsrfToken = page.kind === 'ready' ? page.csrfToken : null;
  const toolVariant = page.kind === 'ready' ? page.activeVariant.slug : null;
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
  }, [toolCsrfToken, toolVariant]);

  const acknowledgementKey =
    page.kind === 'ready' && proposal
      ? [
          page.generation,
          page.activeVariant.slug,
          proposal.proposalId,
          proposal.proposalDigest,
          proposal.baseImplementedRevision,
        ].join(':')
      : '';
  const reviewAcknowledged =
    acknowledgementKey.length > 0 && reviewAcknowledgedKey === acknowledgementKey;

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
        <h1>Focus Contract Studio</h1>
        <OperationPanel live state={operationState('loading')} />
      </main>
    );
  }

  if (page.kind === 'error') {
    return (
      <main className="loading-shell">
        <h1>Focus Contract Studio</h1>
        <OperationPanel live state={page.operation} />
      </main>
    );
  }

  const { review, csrfToken, activeVariant, generation } = page;
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
  const stages = derivePackage6Stages({
    observed: Boolean(review.review.observation),
    retrievalResolved: true,
    proposalStatus: proposal?.status ?? null,
    applied: proposal?.applied ?? false,
    verified: verification !== null,
    historyKinds: history?.records.map(({ kind }) => kind) ?? [],
  });
  const historyApplication = history?.records
    .filter((record) => record.kind === 'application')
    .at(-1);
  const durableReceipt: ApplicationReceiptView | null =
    applicationReceipt ??
    (historyApplication &&
    typeof historyApplication.fromRevision === 'number' &&
    typeof historyApplication.toRevision === 'number'
      ? {
          receiptId: historyApplication.id,
          proposalId: historyApplication.proposalId,
          fromRevision: historyApplication.fromRevision,
          toRevision: historyApplication.toRevision,
          createdAt: new Date(historyApplication.occurredAt * 1_000)
            .toISOString()
            .replace('.000Z', 'Z'),
        }
      : null);
  const firstSafeAction = !review.review.observation
    ? { label: 'Observe browser focus', target: '#observe' }
    : !proposal
      ? { label: 'Create the evidence-backed proposal', target: '#precedent' }
      : proposal.status === 'proposed'
        ? { label: 'Review the exact proposal', target: '#review-authority' }
        : proposal.status === 'approved'
          ? { label: 'Apply the exact approval', target: '#apply' }
          : review.review.implementedRevision > 1
            ? { label: 'Rehearse the rendered revision', target: '#observe' }
            : { label: 'Inspect durable history', target: '#verify-history' };

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
      await refreshCommittedState();
      setActivity(`Browser report recorded: ${targetLabel(targetId)}. Typed values were not captured.`);
    } catch (error) {
      setActivityError(error, 'The observation was not saved.');
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
      setActivityError(error, 'The raw rehearsal could not be finalized.');
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
      setActivityError(
        error,
        'The proposal outcome is uncertain. Retry recovers it with the same key.',
      );
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
      setActivityError(
        error,
        'The reviewer proposal outcome is uncertain. Retry recovers it with the same key.',
      );
    } finally {
      setProposalBusy(false);
    }
  }

  async function refreshCommittedState(
    nextCsrfToken = csrfToken,
    nextActiveVariant = activeVariant,
    nextGeneration = generation,
  ) {
    readController.current?.abort();
    const controller = new AbortController();
    readController.current = controller;
    const [nextReview, nextHistory] = await Promise.all([
      fetchReview(controller.signal), fetchHistory(controller.signal),
    ]);
    if (controller.signal.aborted) return;
    setPage({
      kind: 'ready',
      csrfToken: nextCsrfToken,
      generation: nextGeneration,
      activeVariant: nextActiveVariant,
      review: nextReview,
    });
    setProposal(nextReview.proposal);
    setObservedTarget(nextReview.review.observation?.observedInitialFocus ?? null);
    setHistory(nextHistory);
  }

  async function switchVariant(variant: Package6Variant) {
    if (
      variantBusy ||
      mutationBusy ||
      proposalBusy ||
      rehearsalBusy ||
      variant === activeVariant.slug
    ) {
      return;
    }
    setVariantBusy(true);
    setReviewAcknowledgedKey(null);
    setConfirmAction(null);
    setApplicationReceipt(null);
    setVerification(null);
    readController.current?.abort();
    setActivity(
      `Switching to ${variant === 'delete-account-standard' ? 'Standard' : 'Danger-emphasis'} and refreshing committed truth…`,
      'recovery',
      'no',
    );
    try {
      const result = await jsonResponse<ActiveVariantResult>(
        await fetch('/api/active-variant', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-fcs-csrf': csrfToken,
          },
          body: JSON.stringify({
            variant,
            expectedViewRevision: activeVariant.viewRevision,
          }),
          credentials: 'same-origin',
          cache: 'no-store',
        }),
        'The active variant could not be changed.',
      );
      await refreshCommittedState(
        csrfToken,
        {
          slug: result.data.variant,
          viewRevision: result.data.viewRevision,
        },
        generation,
      );
      setActivity(
        `${variant === 'delete-account-standard' ? 'Standard' : 'Danger-emphasis'} is active. The implemented revision did not change.`,
        'success',
        'no',
      );
    } catch (error) {
      setActivityError(error, 'The active variant could not be changed.');
    } finally {
      setVariantBusy(false);
    }
  }

  function beginMutation(action: NonNullable<typeof confirmAction>) {
    if (mutationBusy) return;
    if (
      ['approve', 'reject', 'revoke', 'edit'].includes(action) &&
      !reviewAcknowledged
    ) {
      setActivity(
        'Review acknowledgement is required before this exact decision can enter confirmation.',
        'validationFailure',
        'no',
      );
      return;
    }
    if (pendingMutation.current?.action !== action) {
      pendingMutation.current = { action, key: crypto.randomUUID() };
    }
    setConfirmAction(action);
    setActivity(`Confirmation opened for ${action}. Focus moved to the deliberate confirm action.`);
  }

  async function executeReview(action: 'approve' | 'reject' | 'revoke' | 'edit') {
    if (!proposal || mutationBusy) return;
    const pending = pendingMutation.current;
    if (
      !reviewAcknowledged ||
      confirmAction !== action ||
      pending?.action !== action
    ) {
      pendingMutation.current = null;
      setConfirmAction(null);
      setActivity(
        'Review acknowledgement changed. Re-open confirmation for this exact proposal and revision.',
        'validationFailure',
        'no',
      );
      return;
    }
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
      setActivityError(
        error,
        `The ${action} outcome is uncertain. Retry recovers it with the same key.`,
      );
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
      const failure = operationForError(
        error,
        'The application outcome is uncertain. Retry recovers the receipt with the same key.',
      );
      setActivityState(operationState('uncertainNetwork', {
        happened: `OUTCOME UNCERTAIN — RECOVERING RECEIPT. ${failure.happened}`,
        revisionChanged: 'unknown',
        code: failure.code,
        correlationId: failure.correlationId,
      }));
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
      setActivityError(
        error,
        'The undo outcome is uncertain. Retry recovers it with the same key.',
      );
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
      await refreshCommittedState(
        reset.data.csrfToken,
        {
          slug: 'delete-account-standard',
          viewRevision: 1,
        },
        reset.data.generation,
      );
      pendingMutation.current = null;
      setConfirmAction(null);
      setApplicationReceipt(null);
      setVerification(null);
      setActivity(`Workspace reset recovered generation ${reset.data.generation}.`);
    } catch (error) {
      setActivityError(
        error,
        'The reset outcome is uncertain. Retry recovers it with the same key.',
      );
    } finally {
      setMutationBusy(false);
    }
  }

  async function copyDurableReceipt() {
    if (!durableReceipt) return;
    try {
      await copyText(receiptText(durableReceipt));
      setActivity(
        'Application receipt copied. The implemented revision did not change.',
        'success',
        'no',
      );
    } catch (error) {
      setActivityError(error, 'The application receipt could not be copied.');
    }
  }

  function startReceiptRehearsal() {
    receiptDialog.current?.close();
    setRehearsalRequest((value) => value + 1);
    setActivity(
      `Starting a fresh raw rehearsal for implemented revision ${durableReceipt?.toRevision ?? review.review.implementedRevision}…`,
      'recovery',
      'no',
    );
  }

  return (
    <main className="studio-shell">
      <header className="top-rail">
        <div>
          <a className="brand" href="#review">
            Focus Contract Studio
          </a>
          <p>Observe browser truth. Review exact authority. Verify rendered behavior.</p>
        </div>
        <p className="demo-label">Isolated demo · No private data</p>
      </header>

      <section aria-labelledby="review-heading" className="hero" id="review">
        <div className="hero-heading">
          <div>
            <p className="eyebrow">One governed accessibility decision</p>
            <h1 id="review-heading">Govern one real focus decision</h1>
            <p className="hero-copy">
              Browser observation and precedent can inform a proposal. Only an exact
              human review can authorize apply.
            </p>
          </div>
          <div className="variant-control" id="variant-tabs">
            <span className="control-label">Active dialog variant</span>
            <div aria-label="Dialog variant" className="variant-tabs" role="tablist">
              {([
                ['delete-account-standard', 'Standard'],
                ['delete-account-danger-emphasis', 'Danger-emphasis'],
              ] as const).map(([variant, label]) => (
                <button
                  aria-selected={activeVariant.slug === variant}
                  className="variant-tab"
                  disabled={variantBusy || mutationBusy || proposalBusy || rehearsalBusy}
                  id={`tab-${variant}`}
                  key={variant}
                  onClick={() => void switchVariant(variant)}
                  role="tab"
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <section
          aria-label="Current focus decision truth"
          className="truth-strip"
          role="region"
        >
          <div>
            <span>Implemented now</span>
            <strong>IMPLEMENTED REVISION {review.review.implementedRevision} · {targetLabel(review.review.implemented.initialFocus)}</strong>
          </div>
          <div>
            <span>Browser observed</span>
            <strong>OBSERVED {observedTarget ? targetLabel(observedTarget) : 'NOT YET CAPTURED'}</strong>
          </div>
          <div>
            <span>Precedent says</span>
            <strong>{evidence[0]?.recordId ?? 'NO RECORD'} · {targetLabel(precedentOutcome)}</strong>
          </div>
          <div>
            <span>Proposal status</span>
            <strong>{proposal?.label ?? 'NOT APPLIED · NO PROPOSAL'}</strong>
          </div>
          <p>
            <strong>VERIFICATION SCOPE.</strong> Fresh finalized raw keyboard/focus
            events are compared with the named rendered revision. Evidence cannot
            authorize apply, manufacture events, or prove WCAG/general conformance.
          </p>
          <a className="truth-next" href={firstSafeAction.target}>
            Next safe action · {firstSafeAction.label}
          </a>
        </section>

        <nav aria-label="Governed workflow stages" className="stage-rail">
          <ol>
            {stages.map((stage, index) => (
              <li data-stage-state={stage.state} key={stage.id}>
                <a
                  aria-current={stage.state === 'current' ? 'step' : undefined}
                  href={stage.href}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{stage.label}</strong>
                  <small>{stage.state}</small>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {proposal ? <ProposalBanner activeRevision={review.review.implementedRevision} proposal={proposal} /> : null}

        <div className="review-grid">
          <section
            aria-labelledby="observe-heading"
            className={`panel dialog-panel ${activeVariant.slug === 'delete-account-danger-emphasis' ? 'danger-emphasis' : ''}`}
            id="observe"
          >
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
              startCompleteRequest={rehearsalRequest}
            />
            <p className="privacy-note">
              This synthetic demo stores untrusted browser-reported target IDs, bounded
              timing, and allowlisted dialog facts only. It never records text entered in
              the reason field and the report cannot approve or apply a change.
            </p>
          </section>

          <section
            aria-labelledby="precedent-heading"
            className="panel precedent-panel"
            id="precedent"
          >
            <p className="stage-number">02 · Precedent</p>
            <h2 id="precedent-heading">{review.review.precedentComparison.label.replace(/_/gu, ' ')}</h2>
            <div className="comparison">
              <div>
                <span>Implemented / observed</span>
                <strong>{titleCaseTarget(review.review.implemented.initialFocus)}</strong>
              </div>
              <span aria-hidden="true">≠</span>
              {review.retrieval.disposition === 'conflict' ? (
                <div aria-label="Conflicting precedent outcomes" className="conflict-outcomes">
                  {evidence.map(({ outcomeKey, recordId }) => (
                    <div key={recordId}>
                      <span>{recordId}</span>
                      <strong>{titleCaseTarget(outcomeKey)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <span>Applicable precedent</span>
                  <strong>{titleCaseTarget(precedentOutcome ?? 'none')}</strong>
                </div>
              )}
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
                    <dl className="evidence-detail">
                      <div><dt>Source</dt><dd>{record.sourceKind ?? 'synthetic-seed'}</dd></div>
                      <div><dt>Valid from</dt><dd><time dateTime={record.validFrom}>{record.validFrom ?? 'Unavailable'}</time></dd></div>
                      <div><dt>Valid until</dt><dd>{record.validUntil ? <time dateTime={record.validUntil}>{record.validUntil}</time> : 'Open-ended'}</dd></div>
                      <div><dt>Scope</dt><dd>{record.applicability}</dd></div>
                      <div><dt>Lexical rank</dt><dd>{record.lexicalRank ?? record.ranks[0] ?? '—'}</dd></div>
                      <div><dt>Structured rank</dt><dd>{record.structuredRank ?? record.ranks[1] ?? '—'}</dd></div>
                      <div><dt>Relationship rank</dt><dd>{record.relationshipRank ?? record.ranks[2] ?? '—'}</dd></div>
                      <div><dt>RRF contribution</dt><dd>{record.rrfContribution ?? record.rrf}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>
            ) : (
              <>
                <p>No eligible precedent was returned. No agent proposal can be created; a reviewer may accept responsibility for a novel proposal.</p>
                <OperationPanel state={operationState('abstention')} />
              </>
            )}
            {review.retrieval.disposition === 'conflict' ? (
              <OperationPanel state={operationState('conflict')} />
            ) : null}
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

        {proposal ? (
          <ProposalReview
            acknowledged={reviewAcknowledged}
            busy={mutationBusy}
            implemented={review.review.implemented}
            onAction={beginMutation}
            onAcknowledgedChange={(checked) => {
              setReviewAcknowledgedKey(checked ? acknowledgementKey : null);
              if (
                !checked &&
                confirmAction !== null &&
                ['approve', 'reject', 'revoke', 'edit'].includes(confirmAction)
              ) {
                pendingMutation.current = null;
                setConfirmAction(null);
                setActivity(
                  'Review acknowledgement changed. Confirmation was cancelled.',
                  'validationFailure',
                  'no',
                );
              }
            }}
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

        <section aria-labelledby="apply-heading" className="boundary-panel application-panel" id="apply">
          <p className="stage-number">05 · Apply</p>
          <h2 id="apply-heading">Guarded application receipt</h2>
          {durableReceipt ? (
            <ApplicationReceipt
              onCopy={() => void copyDurableReceipt()}
              onRehearse={startReceiptRehearsal}
              receipt={durableReceipt}
            />
          ) : (
            <p>
              No application receipt exists. A proposal changes nothing until an exact
              human approval passes the guarded application checks.
            </p>
          )}
        </section>

        <div className="verification-history" id="verify-history">
          {verification ? (
            <VerificationResult verification={verification} />
          ) : (
            <section aria-labelledby="verification-heading" className="boundary-panel">
              <p className="stage-number">06 · Verify & history</p>
              <h2 id="verification-heading">Fresh raw verification</h2>
              <p>
                Verification becomes available after a complete rehearsal of the named
                rendered revision. It creates no review authority.
              </p>
            </section>
          )}

          <section aria-labelledby="history-heading" className="boundary-panel">
            <p className="stage-number">06 · Verify & history</p>
            <h2 id="history-heading">Chronological committed state</h2>
            {history?.records.length ? (
              <ol className="history-list">
                {history.records.map((record) => {
                  const timestamp = new Date(record.occurredAt * 1_000)
                    .toISOString()
                    .replace('.000Z', 'Z');
                  return (
                    <li key={`${record.kind}-${record.id}`}>
                      <span className="timeline-marker" aria-hidden="true" />
                      <div>
                        <strong>{record.kind.replace('_', ' ')}</strong>
                        <time dateTime={timestamp}>{timestamp}</time>
                        <p>{historyLabel(record)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <OperationPanel state={operationState('empty')} />
            )}
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
        </div>

        <dialog
          aria-describedby="receipt-description"
          aria-labelledby="receipt-heading"
          aria-modal="true"
          className="receipt-dialog"
          ref={receiptDialog}
        >
          <h2 id="receipt-heading">Application committed</h2>
          {applicationReceipt ? (
            <p>
              Receipt <code>{applicationReceipt.receiptId}</code> advanced revision{' '}
              {applicationReceipt.fromRevision} to {applicationReceipt.toRevision}.
            </p>
          ) : null}
          <p id="receipt-description">
            The durable receipt remains on the page after this dialog closes.
          </p>
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
              className="button button-secondary"
              onClick={() => void copyDurableReceipt()}
              type="button"
            >
              Copy receipt
            </button>
            <button
              className="button button-primary"
              onClick={startReceiptRehearsal}
              type="button"
            >
              Start revision-{applicationReceipt?.toRevision ?? ''} rehearsal
            </button>
          </div>
        </dialog>

        <OperationPanel
          id="operation-state"
          live
          state={activity}
          statusId="rehearsal-status"
        />
        {toolState === 'registered' ? (
          <p className="tool-status" data-tool-state={toolState}>
            {toolCopy[toolState]}
          </p>
        ) : (
          <OperationPanel
            state={operationState('unsupportedWebMCP', {
              happened: toolCopy[toolState],
              code: toolState === 'error'
                ? 'WEBMCP_REGISTRATION_FAILED'
                : 'WEBMCP_UNSUPPORTED',
            })}
          />
        )}
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
      <p className="stage-number">06 · Verify & history</p>
      <h2 id="verification-heading">Fresh raw rehearsal verification</h2>
      <p className="verification-overall">
        Overall result: <strong>{verification.overallResult}</strong>
      </p>
      <p>
        Runtime precedent projected: <strong>{verification.projectedPrecedentCount ?? 0}</strong>
      </p>
      <p>
        Projection provenance: reviewed application → verification receipt{' '}
        <code>{verification.receiptId}</code> →{' '}
        {verification.projectedPrecedentCount ?? 0} allowlisted runtime precedent
        record(s).
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
              Raw event sequences: {check.evidenceSequences.length > 0
                ? check.evidenceSequences.map((sequence) => `#${sequence}`).join(', ')
                : 'none'}
            </span>
          </li>
        ))}
      </ol>
      <p className="verification-boundary">
        This verification compares one fresh raw rehearsal with the named rendered
        implemented revision. It does not prove approval, biological-human action,
        WCAG conformance, or general safety.
      </p>
      <OperationPanel
        state={operationState(
          verification.overallResult === 'pass' ? 'verifiedPass' : 'verifiedFailure',
          {
            correlationId: verification.receiptId,
          },
        )}
      />
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

function OperationPanel({
  id,
  live = false,
  state,
  statusId,
}: {
  id?: string;
  live?: boolean;
  state: Package6OperationState;
  statusId?: string;
}) {
  return (
    <section
      aria-label={`${state.code} state`}
      className={`operation-panel operation-${state.kind}`}
      data-operation-state={state.kind}
      id={id}
    >
      <p
        aria-live={live ? 'polite' : undefined}
        id={statusId}
        role={live ? 'status' : undefined}
      >
        {state.happened}
      </p>
      <dl>
        <div>
          <dt>Implemented revision changed</dt>
          <dd>{state.revisionChanged.toUpperCase()}</dd>
        </div>
        <div>
          <dt>Public code</dt>
          <dd><code>{state.code}</code></dd>
        </div>
        <div>
          <dt>Correlation</dt>
          <dd><code>{state.correlationId}</code></dd>
        </div>
      </dl>
      <a data-next-action href={state.nextAction.target}>
        Next safe action · {state.nextAction.label}
      </a>
    </section>
  );
}

function ApplicationReceipt({
  onCopy,
  onRehearse,
  receipt,
}: {
  onCopy: () => void;
  onRehearse: () => void;
  receipt: ApplicationReceiptView;
}) {
  return (
    <article aria-label="Permanent application receipt" className="permanent-receipt">
      <dl>
        <div>
          <dt>Receipt</dt>
          <dd><code>{receipt.receiptId}</code></dd>
        </div>
        <div>
          <dt>Implemented transition</dt>
          <dd>Revision {receipt.fromRevision} → {receipt.toRevision}</dd>
        </div>
        {receipt.proposalDigest8 ? (
          <div>
            <dt>Proposal digest</dt>
            <dd><code>{receipt.proposalDigest8}</code></dd>
          </div>
        ) : null}
        {receipt.createdAt ? (
          <div>
            <dt>Committed</dt>
            <dd><time dateTime={receipt.createdAt}>{receipt.createdAt}</time></dd>
          </div>
        ) : null}
      </dl>
      <p>
        This committed receipt is durable history. Verification still requires a
        fresh raw rehearsal of revision {receipt.toRevision}.
      </p>
      <div className="rehearsal-actions">
        <button className="button button-primary" onClick={onRehearse} type="button">
          Start revision-{receipt.toRevision} rehearsal
        </button>
        <button className="button button-secondary" onClick={onCopy} type="button">
          Copy receipt
        </button>
      </div>
    </article>
  );
}

function ProposalReview({
  acknowledged,
  busy,
  implemented,
  onAction,
  onAcknowledgedChange,
  proposal,
}: {
  acknowledged: boolean;
  busy: boolean;
  implemented: ActiveFocusReviewResult['review']['implemented'];
  onAction: (action: 'approve' | 'reject' | 'revoke' | 'edit' | 'apply' | 'undo' | 'reset') => void;
  onAcknowledgedChange: (checked: boolean) => void;
  proposal: ProposalView;
}) {
  return (
    <section
      aria-labelledby="proposal-heading"
      className="proposal-section"
      id="proposal"
    >
      <span className="anchor-target" id="review-authority" tabIndex={-1} />
      <p className="stage-number">03 · Proposal · 04 · Review</p>
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
      <div aria-label="Complete proposed focus change" className="table-scroll" role="region" tabIndex={0}>
        <table aria-label="Proposed focus change">
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Implemented revision {proposal.baseImplementedRevision}</th>
              <th scope="col">Proposed</th>
              <th scope="col">Supporting record / outcome</th>
            </tr>
          </thead>
          <tbody>
            {proposal.changedFields.map((field) => {
              const support = proposal.fieldEvidence.find((entry) => entry.field === field);
              return (
                <tr key={field}>
                  <th scope="row">{focusFieldLabel(field)}</th>
                  <td>{configurationValue(implemented, field)}</td>
                  <td>{configurationValue(proposal.configuration, field)}</td>
                  <td>
                    {support
                      ? `${support.recordId} · ${fullTargetLabel(support.outcomeKey)}`
                      : 'Reviewer-owned novel value · no precedent'}
                  </td>
                </tr>
              );
            })}
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
      {(proposal.status === 'proposed' || proposal.status === 'approved') ? (
        <label className="review-acknowledgement">
          <input
            aria-label="I reviewed this exact proposal and revision"
            checked={acknowledged}
            onChange={(event) =>
              onAcknowledgedChange(event.currentTarget.checked)
            }
            type="checkbox"
          />
          <span>
            <strong>I reviewed this exact proposal and revision</strong>
            <small>
              Digest {proposal.proposalDigest8} · base revision{' '}
              {proposal.baseImplementedRevision}. Retrieval, verification, and
              WebMCP cannot check this box.
            </small>
          </span>
        </label>
      ) : null}
      <div className="rehearsal-actions" aria-label="Visible proposal decisions" role="group">
        {proposal.status === 'proposed' ? (
          <>
            <button className="button button-primary" disabled={busy || !acknowledged} onClick={() => onAction('approve')} type="button">Approve exact proposal</button>
            <button className="button button-secondary" disabled={busy || !acknowledged} onClick={() => onAction('reject')} type="button">Reject proposal</button>
            <button className="button button-secondary" disabled={busy || !acknowledged} onClick={() => onAction('edit')} type="button">Edit as child proposal</button>
          </>
        ) : null}
        {proposal.status === 'approved' ? (
          <>
            <button className="button button-primary" disabled={busy} onClick={() => onAction('apply')} type="button">Apply approved proposal</button>
            <button className="button button-secondary" disabled={busy || !acknowledged} onClick={() => onAction('revoke')} type="button">Revoke approval</button>
          </>
        ) : null}
      </div>
    </section>
  );
}
