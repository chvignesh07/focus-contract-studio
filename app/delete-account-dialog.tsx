'use client';

import { useEffect, useRef } from 'react';

import type { ImplementedFocusConfiguration } from '../lib/domain/focus-configuration';
import type {
  InitialFocusManifest,
  InitialFocusTargetId,
} from '../lib/domain/initial-focus-manifest';

type DeleteAccountDialogProps = {
  configuration: ImplementedFocusConfiguration;
  onFirstFocus: (
    targetId: InitialFocusTargetId,
    clientOffsetMs: number,
    manifest: InitialFocusManifest,
  ) => void;
  onSyntheticDelete: () => void;
};

const allowedTargets = new Set<InitialFocusTargetId>([
  'dialog-title',
  'reason-input',
  'cancel-button',
  'delete-button',
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

export function DeleteAccountDialog({
  configuration,
  onFirstFocus,
  onSyntheticDelete,
}: DeleteAccountDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openingRef = useRef<{ startedAt: number; captured: boolean } | null>(null);

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

  function returnFocus() {
    requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }

  function closeDialog(returnValue: string) {
    const dialog = dialogRef.current;
    if (!dialog?.open) return;
    dialog.close(returnValue);
    returnFocus();
  }

  function openDialog() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    openingRef.current = { startedAt: performance.now(), captured: false };
    dialog.showModal();
  }

  function handleTabBoundary(event: React.KeyboardEvent<HTMLDialogElement>) {
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

  return (
    <>
      <button
        className="button button-primary"
        id="delete-trigger"
        onClick={openDialog}
        ref={triggerRef}
        type="button"
      >
        Run opening rehearsal
      </button>
      <dialog
        aria-describedby="delete-dialog-description"
        aria-labelledby="dialog-title"
        aria-modal="true"
        className="delete-dialog"
        onCancel={(event) => {
          event.preventDefault();
          closeDialog('escape');
        }}
        onClose={returnFocus}
        onFocusCapture={(event) => {
          const opening = openingRef.current;
          const target = event.target;
          if (!opening || opening.captured || !(target instanceof HTMLElement)) return;
          if (!allowedTargets.has(target.id as InitialFocusTargetId)) return;
          opening.captured = true;
          const elapsed = Math.max(
            0,
            Math.min(30_000, Math.round(performance.now() - opening.startedAt)),
          );
          onFirstFocus(
            target.id as InitialFocusTargetId,
            elapsed,
            deriveInitialFocusManifest(event.currentTarget),
          );
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
              closeDialog('synthetic-delete');
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
