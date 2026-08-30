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
import { DeleteAccountDialog } from './delete-account-dialog';
import { WebMcpTools } from './webmcp-tools';

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

function targetLabel(value: string | null): string {
  if (!value) return 'NONE';
  return value.replace(/-(button|input)$/u, '').replace(/-/gu, ' ').toUpperCase();
}

function titleCaseTarget(value: string): string {
  const label = value.replace(/-(button|input)$/u, '').replace(/-/gu, ' ');
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

export function FocusContractStudio() {
  const [page, setPage] = useState<PageState>({ kind: 'loading' });
  const [proposal, setProposal] = useState<ProposalView | null>(null);
  const [observedTarget, setObservedTarget] = useState<string | null>(null);
  const [activity, setActivity] = useState('No proposal has changed the implemented revision.');
  const [proposalBusy, setProposalBusy] = useState(false);
  const [recoveringProposal, setRecoveringProposal] = useState(false);
  const pendingProposalKey = useRef<string | null>(null);

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
        if (controller.signal.aborted) return;
        setProposal(review.proposal);
        setObservedTarget(review.review.observation?.observedInitialFocus ?? null);
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
      setActivity(`Browser report recorded: ${targetLabel(targetId)}. Typed values were not captured.`);
      const refreshed = await fetchReview();
      setPage({ kind: 'ready', csrfToken, review: refreshed });
      setProposal(refreshed.proposal);
    } catch (error) {
      setActivity(error instanceof Error ? error.message : 'The observation was not saved.');
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
      setActivity(
        error instanceof Error
          ? error.message
          : 'The proposal outcome is uncertain. Retry recovers it with the same key.',
      );
    } finally {
      setProposalBusy(false);
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
            <p className="eyebrow">Package 2 · Observe → Precedent → Proposal</p>
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

        {proposal ? <ProposalBanner proposal={proposal} /> : null}

        <div className="review-grid">
          <section aria-labelledby="observe-heading" className="panel dialog-panel">
            <p className="stage-number">01 · Observe</p>
            <h2 id="observe-heading">Live delete-account dialog</h2>
            <p className="panel-copy">
              Revision {review.review.implementedRevision} intentionally focuses the
              destructive Delete action first. Open the native dialog to capture the
              browser&apos;s actual first focus target.
            </p>
            <div className="configuration-card">
              <span>Active variant</span>
              <strong>{review.review.variant.replace(/-/gu, ' ')}</strong>
              <span>Configured initial focus</span>
              <strong>{titleCaseTarget(review.review.implemented.initialFocus)}</strong>
            </div>
            <DeleteAccountDialog
              configuration={review.review.implemented}
              onFirstFocus={(target, offset, manifest) =>
                void recordInitialFocus(target, offset, manifest)
              }
              onSyntheticDelete={() =>
                setActivity('Synthetic demo only: no account or private data was changed.')
              }
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
              <p>No eligible precedent was returned. No agent proposal can be created.</p>
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
          </section>
        </div>

        {proposal ? <ProposalDiff /> : null}

        <section aria-labelledby="boundary-heading" className="boundary-panel">
          <p className="stage-number">03 · Proposal boundary</p>
          <h2 id="boundary-heading">Review is visible; apply is intentionally unavailable</h2>
          <p>
            Package 2 may stage an immutable proposal. It cannot approve or apply one.
            The native dialog continues to render implemented revision 1 and focus Delete.
          </p>
        </section>

        <p aria-live="polite" className="activity-status" role="status">
          {activity}
        </p>
        <WebMcpTools csrfToken={csrfToken} />
      </section>
    </main>
  );
}

function ProposalBanner({ proposal }: { proposal: ProposalView }) {
  return (
    <section aria-label="Proposal state" className="proposal-banner">
      <div>
        <p className="proposal-label">{proposal.label}</p>
        <p>Proposal {proposal.proposalDigest8} is staged for exact UI review.</p>
      </div>
      <strong>Implemented revision remains {proposal.baseImplementedRevision}</strong>
    </section>
  );
}

function ProposalDiff() {
  return (
    <section aria-labelledby="proposal-heading" className="proposal-section">
      <p className="stage-number">03 · Proposal</p>
      <h2 id="proposal-heading">Exact field change</h2>
      <div className="table-scroll">
        <table aria-label="Proposed focus change">
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Implemented revision 1</th>
              <th scope="col">Proposed</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Initial focus</th>
              <td>Delete button</td>
              <td>Cancel button</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="support-note">
        Supported by D001 · outcome Cancel button · evidence only, never approval.
      </p>
    </section>
  );
}
