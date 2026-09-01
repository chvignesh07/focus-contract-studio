'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ImplementedFocusConfiguration } from '../lib/domain/focus-configuration';
import type {
  ObservationEvent,
  RehearsalTargetId,
  RenderedManifest,
} from '../lib/domain/focus-rehearsal';
import type {
  InitialFocusManifest,
  InitialFocusTargetId,
} from '../lib/domain/initial-focus-manifest';

export type FocusRehearsalBinding = {
  rehearsalSessionId: string;
  variantId: string;
  implementedRevision: number;
  expiresAt: number;
};

export type CapturedFocusRehearsal = {
  rehearsalSessionId: string;
  manifest: RenderedManifest;
  events: ObservationEvent[];
};

type DeleteAccountDialogProps = {
  busy?: boolean;
  configuration: ImplementedFocusConfiguration;
  onFirstFocus?: (
    targetId: InitialFocusTargetId,
    clientOffsetMs: number,
    manifest: InitialFocusManifest,
  ) => void;
  onStartRehearsal?: () => Promise<FocusRehearsalBinding>;
  onRehearsalComplete?: (capture: CapturedFocusRehearsal) => void;
  onRehearsalError?: (message: string) => void;
  onSyntheticDelete: () => void;
};

type CompleteCapture = {
  binding: FocusRehearsalBinding;
  triggerId: 'delete-trigger';
  startedAt: number;
  events: ObservationEvent[];
  manifest: RenderedManifest | null;
  closeRecorded: boolean;
};

const allowedTargets = new Set<InitialFocusTargetId>([
  'dialog-title',
  'reason-input',
  'cancel-button',
  'delete-button',
]);
const rehearsalTargets = new Set<RehearsalTargetId>([
  'delete-trigger',
  ...allowedTargets,
]);

function referencedText(dialog: HTMLDialogElement, attribute: string): string {
  return (dialog.getAttribute(attribute) ?? '')
    .split(/\s+/u)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
    .normalize('NFC')
    .replace(/\s+/gu, ' ')
    .trim();
}

function isRenderedTabbable(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  return (
    element.id.length > 0 &&
    element.tabIndex >= 0 &&
    !element.hidden &&
    element.getAttribute('aria-hidden') !== 'true' &&
    style.display !== 'none' &&
    style.visibility !== 'hidden'
  );
}

export function deriveInitialFocusManifest(
  dialog: HTMLDialogElement,
): InitialFocusManifest {
  return {
    targetIds: Array.from(
      dialog.querySelectorAll<HTMLElement>('[data-focus-target][id]'),
      ({ id }) => id,
    ),
    tabbableOrder: Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button, textarea, input, select, a[href], [tabindex]',
      ),
    )
      .filter(isRenderedTabbable)
      .map(({ id }) => id),
    dialogName: referencedText(dialog, 'aria-labelledby'),
    dialogDescription: referencedText(dialog, 'aria-describedby'),
    role: dialog.getAttribute('role') ?? 'dialog',
    ariaModal: dialog.getAttribute('aria-modal') === 'true',
    open: dialog.open,
  };
}

function deriveFocusRehearsalManifest(
  dialog: HTMLDialogElement,
  binding: FocusRehearsalBinding,
  triggerId: 'delete-trigger',
): RenderedManifest {
  const legacy = deriveInitialFocusManifest(dialog);
  return {
    manifestVersion: 'focus-manifest-v1',
    targetIds: [triggerId, ...legacy.targetIds] as RenderedManifest['targetIds'],
    tabbableOrder: legacy.tabbableOrder as RenderedManifest['tabbableOrder'],
    dialogName: legacy.dialogName as RenderedManifest['dialogName'],
    dialogDescription: legacy.dialogDescription as RenderedManifest['dialogDescription'],
    role: legacy.role as RenderedManifest['role'],
    ariaModal: legacy.ariaModal as true,
    open: legacy.open as true,
    variantId: binding.variantId,
    implementedRevision: binding.implementedRevision,
  };
}

function elapsed(startedAt: number): number {
  return Math.max(0, Math.min(30_000, Math.round(performance.now() - startedAt)));
}

export function DeleteAccountDialog({
  busy = false,
  configuration,
  onFirstFocus,
  onStartRehearsal,
  onRehearsalComplete,
  onRehearsalError,
  onSyntheticDelete,
}: DeleteAccountDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const legacyTriggerRef = useRef<HTMLButtonElement>(null);
  const returnTargetRef = useRef<HTMLButtonElement | null>(null);
  const openingRef = useRef<{ startedAt: number; captured: boolean } | null>(null);
  const completeRef = useRef<CompleteCapture | null>(null);
  const [starting, setStarting] = useState(false);
  const [activeTrigger, setActiveTrigger] = useState<'legacy' | 'complete'>('complete');

  const finishReturnedFocus = useCallback((target: HTMLElement) => {
    const dialog = dialogRef.current;
    const complete = completeRef.current;
    if (
      !dialog ||
      dialog.open ||
      !complete ||
      !complete.closeRecorded ||
      !complete.manifest ||
      document.activeElement !== target
    ) {
      return;
    }
    complete.events.push({
      eventType: 'focus_return',
      targetId: target.id as RehearsalTargetId,
      clientOffsetMs: elapsed(complete.startedAt),
    });
    completeRef.current = null;
    onRehearsalComplete?.({
      rehearsalSessionId: complete.binding.rehearsalSessionId,
      manifest: complete.manifest,
      events: complete.events,
    });
  }, [onRehearsalComplete]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    for (const target of dialog.querySelectorAll<HTMLElement>('[data-focus-target]')) {
      target.removeAttribute('autofocus');
    }
    dialog
      .querySelector<HTMLElement>(`#${configuration.initialFocus}`)
      ?.setAttribute('autofocus', '');
  }, [configuration.initialFocus]);

  useEffect(() => {
    const observeExternalOrReturnedFocus = (event: FocusEvent) => {
      const target = event.target;
      const dialog = dialogRef.current;
      const complete = completeRef.current;
      if (
        !(target instanceof HTMLElement) ||
        !dialog ||
        !complete ||
        !rehearsalTargets.has(target.id as RehearsalTargetId)
      ) {
        return;
      }
      if (dialog.open) {
        if (dialog.contains(target)) return;
        complete.events.push({
          eventType: 'focusin',
          targetId: target.id as RehearsalTargetId,
          clientOffsetMs: elapsed(complete.startedAt),
        });
        return;
      }
      finishReturnedFocus(target);
    };
    document.addEventListener('focusin', observeExternalOrReturnedFocus);
    return () => document.removeEventListener('focusin', observeExternalOrReturnedFocus);
  }, [finishReturnedFocus]);

  function returnFocus() {
    requestAnimationFrame(() => {
      const target = returnTargetRef.current;
      target?.focus({ preventScroll: true });
      if (target) finishReturnedFocus(target);
    });
  }

  function closeDialog(returnValue: 'escape' | 'cancel' | 'delete') {
    const dialog = dialogRef.current;
    if (!dialog?.open) return;
    dialog.close(returnValue);
  }

  function openLegacyDialog() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    setActiveTrigger('legacy');
    returnTargetRef.current = legacyTriggerRef.current ?? triggerRef.current;
    completeRef.current = null;
    openingRef.current = { startedAt: performance.now(), captured: false };
    dialog.showModal();
  }

  async function openCompleteDialog() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open || !onStartRehearsal || starting || busy) return;
    setActiveTrigger('complete');
    returnTargetRef.current = triggerRef.current;
    setStarting(true);
    try {
      const binding = await onStartRehearsal();
      if (triggerRef.current?.id !== 'delete-trigger') {
        throw new Error('The rehearsal trigger is unavailable.');
      }
      const startedAt = performance.now();
      openingRef.current = null;
      completeRef.current = {
        binding,
        triggerId: triggerRef.current.id,
        startedAt,
        events: [
          {
            eventType: 'dialog_open',
            targetId: triggerRef.current.id,
            clientOffsetMs: 0,
          },
        ],
        manifest: null,
        closeRecorded: false,
      };
      dialog.showModal();
    } catch (error) {
      onRehearsalError?.(
        error instanceof Error ? error.message : 'The rehearsal could not be started.',
      );
    } finally {
      setStarting(false);
    }
  }

  function recordFocus(target: HTMLElement, dialog: HTMLDialogElement) {
    const complete = completeRef.current;
    if (complete) {
      if (!rehearsalTargets.has(target.id as RehearsalTargetId)) return;
      complete.manifest ??= deriveFocusRehearsalManifest(
        dialog,
        complete.binding,
        complete.triggerId,
      );
      complete.events.push({
        eventType: 'focusin',
        targetId: target.id as RehearsalTargetId,
        clientOffsetMs: elapsed(complete.startedAt),
      });
      return;
    }
    if (!allowedTargets.has(target.id as InitialFocusTargetId)) return;
    const opening = openingRef.current;
    if (!opening || opening.captured || !onFirstFocus) return;
    opening.captured = true;
    onFirstFocus(
      target.id as InitialFocusTargetId,
      elapsed(opening.startedAt),
      deriveInitialFocusManifest(dialog),
    );
  }

  function recordKey(event: React.KeyboardEvent<HTMLDialogElement>) {
    const complete = completeRef.current;
    if (
      !complete ||
      !(event.target instanceof HTMLElement) ||
      !allowedTargets.has(event.target.id as InitialFocusTargetId) ||
      (event.key !== 'Tab' && event.key !== 'Escape')
    ) {
      return;
    }
    complete.events.push({
      eventType: 'keydown',
      targetId: event.target.id as InitialFocusTargetId,
      keyName: event.key,
      shiftKey: event.shiftKey,
      clientOffsetMs: elapsed(complete.startedAt),
    });
  }

  function handleTabBoundary(event: React.KeyboardEvent<HTMLDialogElement>) {
    recordKey(event);
    if (event.key !== 'Tab' || !(event.target instanceof HTMLElement)) return;
    const order = configuration.focusOrder;
    const index = order.indexOf(
      event.target.id as (typeof configuration.focusOrder)[number],
    );
    const destination = event.shiftKey
      ? index === 0
        ? order.at(-1)
        : null
      : index === order.length - 1
        ? order[0]
        : null;
    if (!destination) return;
    const target = dialogRef.current?.querySelector<HTMLElement>(`#${destination}`);
    if (!target) return;
    event.preventDefault();
    target.focus({ preventScroll: true });
  }

  function recordClose(dialog: HTMLDialogElement) {
    const complete = completeRef.current;
    if (!complete || complete.closeRecorded) return;
    const reason = dialog.returnValue;
    if (reason !== 'escape' && reason !== 'cancel' && reason !== 'delete') return;
    complete.closeRecorded = true;
    complete.events.push({
      eventType: 'dialog_close',
      targetId: 'dialog-title',
      closeReason: reason,
      clientOffsetMs: elapsed(complete.startedAt),
    });
  }

  return (
    <>
      <div className="rehearsal-actions">
        {onFirstFocus ? (
          <button
            className="button button-secondary"
            id={activeTrigger === 'legacy' ? 'delete-trigger' : undefined}
            onClick={openLegacyDialog}
            ref={legacyTriggerRef}
            type="button"
          >
            Run opening rehearsal
          </button>
        ) : null}
        {onStartRehearsal ? (
          <button
            aria-describedby="rehearsal-status"
            aria-disabled={starting || busy}
            className="button button-primary"
            id={activeTrigger === 'complete' ? 'delete-trigger' : undefined}
            onClick={() => void openCompleteDialog()}
            ref={triggerRef}
            type="button"
          >
            {starting
              ? 'Starting rehearsal…'
              : busy
                ? 'Finalizing and verifying…'
                : 'Run complete rehearsal'}
          </button>
        ) : (
          <button
            className="button button-primary"
            id="delete-trigger"
            onClick={openLegacyDialog}
            ref={triggerRef}
            type="button"
          >
            Run opening rehearsal
          </button>
        )}
      </div>
      <dialog
        aria-describedby="delete-dialog-description"
        aria-labelledby="dialog-title"
        aria-modal="true"
        className="delete-dialog"
        onCancel={(event) => {
          event.preventDefault();
          closeDialog('escape');
        }}
        onClose={(event) => {
          recordClose(event.currentTarget);
          returnFocus();
        }}
        onFocusCapture={(event) => {
          if (event.target instanceof HTMLElement) {
            recordFocus(event.target, event.currentTarget);
          }
        }}
        onKeyDown={handleTabBoundary}
        ref={dialogRef}
      >
        <div className="dialog-heading-row">
          <div>
            <p className="eyebrow">Synthetic account demo</p>
            <h2 data-focus-target id="dialog-title" tabIndex={-1}>
              Delete account
            </h2>
          </div>
        </div>
        <p id="delete-dialog-description">
          Deleting your account is permanent. You can optionally tell us why.
        </p>
        <label className="field-label" htmlFor="reason-input">
          Reason (optional)
        </label>
        <textarea
          autoComplete="off"
          data-focus-target
          id="reason-input"
          maxLength={280}
          rows={3}
        />
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            data-focus-target
            id="cancel-button"
            onClick={() => closeDialog('cancel')}
            type="button"
          >
            Cancel
          </button>
          <button
            className="button button-danger"
            data-focus-target
            id="delete-button"
            onClick={() => {
              onSyntheticDelete();
              closeDialog('delete');
            }}
            type="button"
          >
            Delete account
          </button>
        </div>
      </dialog>
    </>
  );
}
