import {
  DEFAULT_SETTINGS,
  FEATURE_KEYS,
  MAX_ERASED_SELECTORS,
  STORAGE_KEY,
  type FeatureKey,
  type Features,
  type Settings,
  type SiteSettings,
} from './constants';

export function normalizeSettings(stored: unknown): Settings {
  if (!stored || typeof stored !== 'object') return structuredClone(DEFAULT_SETTINGS);
  const raw = stored as Partial<Settings>;
  return {
    defaults: { ...DEFAULT_SETTINGS.defaults, ...raw.defaults },
    sites: raw.sites && typeof raw.sites === 'object' ? raw.sites : {},
    telemetry: raw.telemetry !== false,
  };
}

export async function getSettings(): Promise<Settings> {
  const result = await browser.storage.sync.get(STORAGE_KEY);
  return normalizeSettings(result[STORAGE_KEY]);
}

export async function setSettings(settings: Settings): Promise<void> {
  await browser.storage.sync.set({ [STORAGE_KEY]: settings });
}

export async function updateSettings(mutate: (settings: Settings) => void): Promise<Settings> {
  const settings = await getSettings();
  mutate(settings);
  await setSettings(settings);
  return settings;
}

export function emptySite(): SiteSettings {
  return { enabled: false, features: {}, erasedSelectors: [], overlaysRemoved: false };
}

export function getSiteSettings(settings: Settings, host: string): SiteSettings {
  return settings.sites[host] ?? emptySite();
}

export async function updateSite(host: string, mutate: (site: SiteSettings) => void): Promise<void> {
  await updateSettings((settings) => {
    const site = settings.sites[host] ?? emptySite();
    mutate(site);
    settings.sites[host] = site;
  });
}

export function getEffectiveFeatures(settings: Settings, host: string): Features {
  const site = settings.sites[host];
  if (!site?.enabled) {
    return Object.fromEntries(FEATURE_KEYS.map((key) => [key, false])) as Features;
  }
  return { ...settings.defaults, ...site.features };
}

function pushErased(site: SiteSettings, selector: string): void {
  if (site.erasedSelectors.includes(selector)) return;
  site.erasedSelectors.push(selector);
  if (site.erasedSelectors.length > MAX_ERASED_SELECTORS) {
    site.erasedSelectors = site.erasedSelectors.slice(-MAX_ERASED_SELECTORS);
  }
}

export async function addErasedSelectors(host: string, selectors: readonly string[]): Promise<void> {
  if (selectors.length === 0) return;
  await updateSite(host, (site) => {
    for (const selector of selectors) pushErased(site, selector);
  });
}

export async function saveRemovedOverlays(host: string, selectors: readonly string[]): Promise<void> {
  await updateSite(host, (site) => {
    site.overlaysRemoved = true;
    for (const selector of selectors) pushErased(site, selector);
  });
}

export async function popErasedSelector(host: string): Promise<void> {
  await updateSite(host, (site) => {
    site.erasedSelectors.pop();
  });
}

export function onSettingsChanged(cb: (settings: Settings) => void): () => void {
  const listener = (changes: Record<string, Browser.storage.StorageChange>): void => {
    const change = changes[STORAGE_KEY];
    if (change) cb(normalizeSettings(change.newValue));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(value);
}
