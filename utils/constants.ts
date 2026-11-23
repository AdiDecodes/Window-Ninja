export const FEATURE_KEYS = [
  'contextMenu',
  'copyPaste',
  'selection',
  'devShortcuts',
  'unlockInputs',
  'revealPasswords',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type Features = Record<FeatureKey, boolean>;

export const FEATURE_LABELS: Record<FeatureKey, { title: string; hint: string }> = {
  contextMenu: { title: 'Right-click', hint: 'Restore the native context menu' },
  copyPaste: { title: 'Copy / cut / paste', hint: 'Allow clipboard actions, incl. password fields' },
  selection: { title: 'Text selection', hint: 'Override user-select: none' },
  devShortcuts: { title: 'Dev shortcuts', hint: 'F12, Ctrl/Cmd+U/S/P, Ctrl/Cmd+Shift+I/J/C' },
  unlockInputs: { title: 'Unlock inputs', hint: 'Remove readonly/disabled from form fields' },
  revealPasswords: { title: 'Reveal passwords', hint: 'Show password fields as text' },
};

export const DEFAULT_FEATURES: Features = {
  contextMenu: true,
  copyPaste: true,
  selection: true,
  devShortcuts: true,
  unlockInputs: false,
  revealPasswords: false,
};

export interface SiteSettings {
  enabled: boolean;
  features: Partial<Features>;
  erasedSelectors: string[];
  overlaysRemoved?: boolean;
}

export interface Settings {
  defaults: Features;
  sites: Record<string, SiteSettings>;
  telemetry: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  defaults: { ...DEFAULT_FEATURES },
  sites: {},
  telemetry: true,
};

export const STORAGE_KEY = 'settings';
export const MAX_ERASED_SELECTORS = 50;

export const WN_EVENT = 'window-ninja:features';
export const WN_FEATURES_ATTR = 'data-wn-features';
export const WN_COMMAND_MESSAGE = 'wn:command';
export const WN_STYLE_ID = 'window-ninja-styles';
export const WN_OVERLAY_FIX_ID = 'window-ninja-overlay-fix';
export const WN_HOVER_CLASS = 'wn-erase-hover';
export const WN_ERASE_RELAY = 'window-ninja:erase-relay';

export type WnCommand =
  | 'erase-mode'
  | 'remove-overlays'
  | 'restore-erased'
  | 'toggle-unlock-inputs'
  | 'toggle-reveal-passwords';

export interface WnCommandMessage {
  type: typeof WN_COMMAND_MESSAGE;
  command: WnCommand;
}
