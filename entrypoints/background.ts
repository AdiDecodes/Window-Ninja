import {
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  WN_COMMAND_MESSAGE,
  type WnCommand,
} from '../utils/constants';
import { getSettings } from '../utils/storage';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    const stored = await browser.storage.sync.get(STORAGE_KEY);
    if (!stored[STORAGE_KEY]) {
      await browser.storage.sync.set({ [STORAGE_KEY]: structuredClone(DEFAULT_SETTINGS) });
    }
  });

  browser.commands.onCommand.addListener(async (command: string) => {
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
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) void refreshBadge(tab.id, tab.url);
  });

  browser.action.setBadgeBackgroundColor({ color: '#16a34a' });
});
