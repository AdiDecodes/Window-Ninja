// Minimal anonymous usage stats. Only the background service worker imports
// this module, so telemetry fetches are never subject to page CSP.
//
// Sent per event: event name, extension version, a random per-install UUID
// (not linked to any identity), browser language, timestamp. Never page
// content, URLs, hostnames, or erased selectors (see PRIVACY.md).
//
// To activate: deploy scripts/telemetry-worker.js (or any collector accepting
// the JSON payload), then set WN_TELEMETRY_ENDPOINT and WN_TELEMETRY_TOKEN in
// a gitignored .env file (see .env.example). Vite inlines them at build time.
// Until the endpoint is set, track() is a no-op and the extension makes no
// network requests.

const TELEMETRY_ENDPOINT = import.meta.env.WN_TELEMETRY_ENDPOINT ?? '';
const TELEMETRY_TOKEN = import.meta.env.WN_TELEMETRY_TOKEN ?? '';

const INSTALL_ID_KEY = 'telemetryInstallId';

let enabled = true;

export function setTelemetryEnabled(value: boolean): void {
  enabled = value;
}

let installId: Promise<string> | null = null;

const getInstallId = (): Promise<string> => {
  installId ??= (async () => {
    const stored = await browser.storage.local.get(INSTALL_ID_KEY);
    const id = stored[INSTALL_ID_KEY];
    if (typeof id === 'string') return id;
    const fresh = crypto.randomUUID();
    await browser.storage.local.set({ [INSTALL_ID_KEY]: fresh });
    return fresh;
  })();
  return installId;
};

export function track(event: string, props: Record<string, unknown> = {}): void {
  if (!enabled || !TELEMETRY_ENDPOINT) return;
  void (async () => {
    const payload = JSON.stringify({
      event,
      props,
      token: TELEMETRY_TOKEN,
      version: browser.runtime.getManifest().version,
      installId: await getInstallId(),
      locale: navigator.language,
      ts: Date.now(),
    });
    // text/plain keeps this a CORS-simple request, so no preflight and no
    // extra host permission is needed for the collector.
    await fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  })();
}
