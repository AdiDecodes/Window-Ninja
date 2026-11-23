import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  outDir: 'dist',
  vite: () => ({
    envPrefix: ['WN_', 'VITE_', 'WXT_'],
  }),
  manifest: {
    name: 'Window Ninja',
    description:
      'Restore right-click, clipboard, selection and dev shortcuts on restrictive sites, plus eraser, input unlock and password reveal.',
    permissions: ['storage', 'clipboardWrite'],
    host_permissions: ['<all_urls>'],
    minimum_chrome_version: '111',
    commands: {
      'erase-mode': {
        suggested_key: { default: 'Alt+Shift+E' },
        description: 'Toggle element eraser',
      },
      'select-mode': {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Toggle text select mode',
      },
      'toggle-unlock-inputs': {
        suggested_key: { default: 'Alt+Shift+U' },
        description: 'Toggle input un-locker',
      },
      'toggle-reveal-passwords': {
        suggested_key: { default: 'Alt+Shift+P' },
        description: 'Toggle password reveal',
      },
      // Chrome allows at most 4 commands with suggested keys; the rest are
      // assignable at chrome://extensions/shortcuts and via the popup.
      'remove-overlays': {
        description: 'Remove overlay layers',
      },
    },
  },
});
