'use client';

import { useState } from 'react';

import { interpretPlatformObservation } from '@/probes/hosted/presentation';

type ProbeAction =
  | 'observe_platform'
  | 'run_disposable_d1'
  | 'finalize_disposable_d1'
  | 'clear_probe_cookies';

type ProbeState = {
  busy: ProbeAction | null;
  message: string;
  tone: 'neutral' | 'pass' | 'fail';
};

const initialState: ProbeState = {
  busy: null,
  message: 'Hosted checks have not run in this browser.',
  tone: 'neutral',
};

export function Package0HostedProbePanel() {
  const [state, setState] = useState<ProbeState>(initialState);
  const [d1Armed, setD1Armed] = useState(false);

  async function run(action: ProbeAction) {
    setState({
      busy: action,
      message: 'Running one bounded Package 0 check…',
      tone: 'neutral',
    });

    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };
      if (action === 'observe_platform') {
        headers['oai-authenticated-user-email'] =
          'package0-spoof@invalid.example';
      }

      const response = await fetch('/api/package0-probe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action }),
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        setState({
          busy: null,
          message: safeFailureMessage(result),
          tone: 'fail',
        });
        return;
      }

      const completed = successResult(action, result);
      setState({ busy: null, ...completed });
      if (action === 'run_disposable_d1') setD1Armed(false);
    } catch {
      setState({
        busy: null,
        message: 'Probe request failed before a valid response was observed.',
        tone: 'fail',
      });
    }
  }

  return (
    <section
      aria-labelledby="hosted-probe-heading"
      className="mt-4 border-t border-stone-200 pt-4"
    >
      <h2
        id="hosted-probe-heading"
        className="text-xs font-semibold uppercase tracking-[0.08em] text-stone-500"
      >
        Hosted platform checks
      </h2>
      <p className="mt-1 text-xs leading-5 text-stone-500">
        Observation writes only short-lived hardened cookies. D1 mutation stays
        server-disabled unless an approved owner-only probe window explicitly
        enables its durable single-use gate.
      </p>
      <label className="mt-3 flex max-w-md items-start gap-2 text-xs leading-5 text-stone-600">
        <input
          checked={d1Armed}
          className="mt-1 h-4 w-4 accent-stone-700"
          disabled={state.busy !== null}
          onChange={(event) => setD1Armed(event.target.checked)}
          type="checkbox"
        />
        Arm this page&apos;s human confirmation only. Server admission separately
        requires proven owner-only access, an approved environment flag, and an
        unused durable D1 gate.
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <ProbeButton
          available
          busy={state.busy}
          label="Observe cookie and identity"
          onClick={() => run('observe_platform')}
          ownAction="observe_platform"
        />
        <ProbeButton
          available={d1Armed}
          busy={state.busy}
          label={d1Armed ? 'Run disposable D1 probe' : 'D1 probe locked'}
          onClick={() => run('run_disposable_d1')}
          ownAction="run_disposable_d1"
        />
        <ProbeButton
          available
          busy={state.busy}
          label="Finalize D1 cleanup"
          onClick={() => run('finalize_disposable_d1')}
          ownAction="finalize_disposable_d1"
        />
        <ProbeButton
          available
          busy={state.busy}
          label="Clear probe cookies"
          onClick={() => run('clear_probe_cookies')}
          ownAction="clear_probe_cookies"
        />
      </div>
      <p
        aria-live="polite"
        className={`mt-3 rounded-lg px-3 py-2 text-xs leading-5 ${
          state.tone === 'pass'
            ? 'bg-emerald-50 text-emerald-900'
            : state.tone === 'fail'
              ? 'bg-red-50 text-red-900'
              : 'bg-stone-50 text-stone-600'
        }`}
        role="status"
      >
        {state.message}
      </p>
    </section>
  );
}

function ProbeButton({
  available,
  busy,
  label,
  onClick,
  ownAction,
}: {
  available: boolean;
  busy: ProbeAction | null;
  label: string;
  onClick: () => void;
  ownAction: ProbeAction;
}) {
  return (
    <button
      className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-sm outline-none transition hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-55"
      disabled={busy !== null || !available}
      onClick={onClick}
      type="button"
    >
      {busy === ownAction ? 'Running…' : label}
    </button>
  );
}

function successResult(
  action: ProbeAction,
  result: unknown,
): Pick<ProbeState, 'message' | 'tone'> {
  if (action === 'clear_probe_cookies') {
    return {
      message: 'Package 0 probe cookies were expired.',
      tone: 'pass',
    };
  }

  if (action === 'run_disposable_d1') {
    return hasPassingD1Result(result)
      ? {
          message:
            'Hosted D1 behavior passed and zero work tables remain. Its durable single-use gate is sealed; disable the server flag, then finalize D1 cleanup.',
          tone: 'pass',
        }
      : {
          message:
            'The hosted D1 response did not contain the complete passing result.',
          tone: 'fail',
        };
  }

  if (action === 'finalize_disposable_d1') {
    return hasPassingD1FinalizeResult(result)
      ? {
          message:
            'Hosted D1 final cleanup passed; the work tables and durable single-use gate are all absent.',
          tone: 'pass',
        }
      : {
          message:
            'The hosted D1 finalization response did not prove zero residual probe tables.',
          tone: 'fail',
        };
  }

  return interpretPlatformObservation(result);
}

function safeFailureMessage(result: unknown): string {
  if (isRecord(result) && typeof result.code === 'string') {
    if (result.code === 'HOSTED_D1_PROBE_DISABLED') {
      return 'Hosted D1 mutation is disabled. It may run only during the approved owner-only probe window.';
    }
    if (result.code === 'HOSTED_D1_OWNER_ONLY_NOT_CONFIRMED') {
      return 'Hosted D1 stopped because owner-only access was not explicitly confirmed.';
    }
    if (result.code === 'HOSTED_D1_PROBE_STILL_ENABLED') {
      return 'Disable the hosted D1 probe flag before finalizing its durable gate.';
    }
    if (result.code === 'HOSTED_D1_PROBE_ALREADY_USED') {
      return 'The durable D1 gate rejected a repeat or concurrent probe run.';
    }
    return `Probe stopped with ${result.code}.`;
  }
  return 'Probe stopped without a valid bounded error response.';
}

function hasPassingD1Result(value: unknown): boolean {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.result)) {
    return false;
  }
  const result = value.result;
  const expectedKeys = [
    'migration',
    'preparedQuery',
    'strictTable',
    'uniqueConstraint',
    'foreignKeyConstraint',
    'checkConstraint',
    'batchRollback',
    'zeroRowGuard',
    'rollback',
  ];
  return (
    expectedKeys.every((key) => result[key] === 'PASS') &&
    result.residualWorkTableCount === 0 &&
    result.singleUseGate === 'SEALED'
  );
}

function hasPassingD1FinalizeResult(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.ok === true &&
    isRecord(value.result) &&
    value.result.rollback === 'PASS' &&
    value.result.gateCleanup === 'PASS' &&
    value.result.residualProbeTableCount === 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
