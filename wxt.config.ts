import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  outDir: 'dist',
  manifest: {
    name: 'Window Ninja',
    description:
      'Restore right-click, copy/paste, selection and dev shortcuts on restrictive sites, plus element eraser, input unlock, password reveal.',
    permissions: ['storage'],
    host_permissions: ['<all_urls>'],
    minimum_chrome_version: '111',
    commands: {
      'erase-mode': {
        suggested_key: { default: 'Alt+Shift+E' },
        description: 'Toggle element eraser',
      },
      'toggle-unlock-inputs': {
        suggested_key: { default: 'Alt+Shift+U' },
        description: 'Toggle input un-locker',
      },
      'toggle-reveal-passwords': {
        suggested_key: { default: 'Alt+Shift+P' },
        description: 'Toggle password reveal',
      },
      'remove-overlays': {
        suggested_key: { default: 'Alt+Shift+O' },
        description: 'Remove overlay layers',
      },
    },
  },
});
