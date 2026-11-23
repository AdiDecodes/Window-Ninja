import {
  DEFAULT_SETTINGS,
  FEATURE_KEYS,
  STORAGE_KEY,
  WN_COMMAND_MESSAGE,
  type Settings,
  type WnCommand,
} from '../utils/constants';
import { getSettings, normalizeSettings } from '../utils/storage';
import { setTelemetryEnabled, track } from '../utils/telemetry';

const countEnabledSites = (settings: Settings): number =>
  Object.values(settings.sites).filter((site) => site.enabled).length;

const diffSettingsForTelemetry = (oldSettings: Settings, newSettings: Settings): void => {
  setTelemetryEnabled(newSettings.telemetry);
  for (const key of FEATURE_KEYS) {
    if (oldSettings.defaults[key] !== newSettings.defaults[key]) {
      track('defaults_changed', { feature: key, enabled: newSettings.defaults[key] });
    }
  }
  const before = countEnabledSites(oldSettings);
  const after = countEnabledSites(newSettings);
  if (after > before) track('sites_enabled', { count: after - before });
  if (after < before) track('sites_disabled', { count: before - after });
};

export default defineBackground(() => {
  void getSettings().then((settings) => setTelemetryEnabled(settings.telemetry));

  browser.runtime.onInstalled.addListener(async (details) => {
    const stored = await browser.storage.sync.get(STORAGE_KEY);
    if (!stored[STORAGE_KEY]) {
      await browser.storage.sync.set({ [STORAGE_KEY]: structuredClone(DEFAULT_SETTINGS) });
    }
    if (details.reason === 'install' || details.reason === 'update') {
      setTelemetryEnabled((await getSettings()).telemetry);
      track(details.reason, { previousVersion: details.previousVersion });
    }
  });

  browser.commands.onCommand.addListener(async (command: string) => {
    track('command', { command });
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    try {
      await browser.tabs.sendMessage(tab.id, {
        type: WN_COMMAND_MESSAGE,
        command: command as WnCommand,
      });
    } catch {
      // no content script on this page (chrome:// etc.)
    }
  });

  const hostFromUrl = (url: string | undefined): string | null => {
    if (!url) return null;
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  };

  const refreshBadge = async (tabId: number, url?: string): Promise<void> => {
    let text = '';
    const host = hostFromUrl(url);
    if (host) {
      const settings = await getSettings();
      if (settings.sites[host]?.enabled) text = 'ON';
    }
    await browser.action.setBadgeText({ tabId, text });
  };

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' || changeInfo.status === 'complete' || changeInfo.url) {
      void refreshBadge(tabId, changeInfo.url ?? tab.url);
    }
  });

  browser.tabs.onActivated.addListener(async ({ tabId }) => {
    try {
      const tab = await browser.tabs.get(tabId);
      void refreshBadge(tabId, tab.url);
    } catch {
      // tab closed
    }
  });

  browser.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'sync' || !changes[STORAGE_KEY]) return;
    const change = changes[STORAGE_KEY];
    diffSettingsForTelemetry(normalizeSettings(change.oldValue), normalizeSettings(change.newValue));
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) void refreshBadge(tab.id, tab.url);
  });

  browser.action.setBadgeBackgroundColor({ color: '#16a34a' });
});
