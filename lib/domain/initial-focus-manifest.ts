export const INITIAL_FOCUS_MANIFEST = {
  targetIds: [
    'dialog-title',
    'reason-input',
    'cancel-button',
    'delete-button',
  ],
  tabbableOrder: ['reason-input', 'cancel-button', 'delete-button'],
  dialogName: 'Delete account',
  dialogDescription:
    'Deleting your account is permanent. You can optionally tell us why.',
  role: 'dialog',
  ariaModal: true,
  open: true,
} as const;

export type InitialFocusTargetId =
  (typeof INITIAL_FOCUS_MANIFEST.targetIds)[number];

export type InitialFocusManifest = {
  targetIds: string[];
  tabbableOrder: string[];
  dialogName: string;
  dialogDescription: string;
  role: string;
  ariaModal: boolean;
  open: boolean;
};
