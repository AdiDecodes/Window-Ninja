import {
  WN_COMMAND_MESSAGE,
  WN_ERASE_RELAY,
  WN_EVENT,
  WN_FEATURES_ATTR,
  WN_HOVER_CLASS,
  WN_OVERLAY_FIX_ID,
  WN_STYLE_ID,
  type FeatureKey,
  type Features,
  type Settings,
  type WnCommand,
} from '../utils/constants';
import {
  addErasedSelectors,
  getEffectiveFeatures,
  getSettings,
  onSettingsChanged,
  popErasedSelector,
  saveRemovedOverlays,
  updateSite,
} from '../utils/storage';
import {
  BLOCKING_ATTRS,
  copyPasswordSelection,
  findOverlays,
  isPasswordClipboardTarget,
  REVEAL_PASSWORDS_RULE,
  stripBlockingHandlers,
  unlockFormFields,
  unlockPasswordClipboard,
} from '../utils/dom';
import { getStableSelector, isShadowElement } from '../utils/selectors';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  allFrames: true,
  main() {
    const host = location.hostname;

    let siteEnabled = false;
    let features: Features = {
      contextMenu: false,
      copyPaste: false,
      selection: false,
      devShortcuts: false,
      unlockInputs: false,
      revealPasswords: false,
    };
    let erasedSelectors: string[] = [];
    let overlayRemoved = false;
    let eraseMode = false;
    let selectMode = false;

    // ---------- event gatekeeper ----------
    // Registered synchronously at document_start so these run before any page
    // listener. stopImmediatePropagation in the capture phase keeps site code
    // from ever running on these events, which defeats blockers regardless of
    // how they were registered (including pristine cross-realm references).
    const isGatekeptType = (type: string, event: Event): boolean => {
      switch (type) {
        case 'contextmenu':
          return features.contextMenu || selectMode;
        case 'copy':
        case 'cut':
        case 'paste':
        case 'beforecopy':
        case 'beforecut':
          return features.copyPaste || selectMode;
        case 'selectstart':
        case 'dragstart':
          return features.selection || selectMode;
        default:
          return false;
      }
    };
    const gatekeep = (event: Event): void => {
      if (isGatekeptType(event.type, event)) event.stopImmediatePropagation();
    };
    for (const type of ['contextmenu', 'copy', 'cut', 'paste', 'beforecopy', 'beforecut', 'selectstart', 'dragstart']) {
      window.addEventListener(type, gatekeep, true);
    }

    // Chromium never fires cut/copy for password inputs, so the native clipboard
    // action can't be unblocked — we have to perform it ourselves.
    const onKeyClipboardPassword = (event: KeyboardEvent): void => {
      if (!features.copyPaste) return;
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== 'c' && key !== 'x') return;
      const active = document.activeElement;
      if (!(active instanceof HTMLInputElement) || !isPasswordClipboardTarget(active)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void copyPasswordSelection(active, key === 'x');
    };
    window.addEventListener('keydown', onKeyClipboardPassword, true);

    // ---------- MAIN world bridge ----------

    const pushFeatures = (): void => {
      const payload = JSON.stringify({
        contextMenu: features.contextMenu,
        copyPaste: features.copyPaste,
        selection: features.selection,
        devShortcuts: features.devShortcuts,
        selectMode,
      });
      document.documentElement?.setAttribute(WN_FEATURES_ATTR, payload);
      window.dispatchEvent(new CustomEvent(WN_EVENT, { detail: payload }));
    };

    // ---------- styles ----------

    const ensureStyleEl = (id: string): HTMLStyleElement | null => {
      const parent = document.head ?? document.documentElement;
      if (!parent) return null;
      let el = document.getElementById(id) as HTMLStyleElement | null;
      if (!el) {
        el = document.createElement('style');
        el.id = id;
        parent.appendChild(el);
      }
      return el;
    };

    const rebuildStyles = (): void => {
      const style = ensureStyleEl(WN_STYLE_ID);
      if (style) {
        const rules: string[] = [];
        if (siteEnabled && features.selection) {
          rules.push('*, *::before, *::after { user-select: text !important; -webkit-user-select: text !important; }');
        }
        if (siteEnabled && features.revealPasswords) {
          rules.push(REVEAL_PASSWORDS_RULE);
        }
        if (eraseMode) {
          rules.push(
            `.${WN_HOVER_CLASS} { outline: 2px solid #ffffff !important; outline-offset: -2px !important; box-shadow: 0 0 0 1px #000000 !important; cursor: crosshair !important; }`,
          );
        }
        if (selectMode) {
          rules.push(
            '*, *::before, *::after { cursor: text !important; user-select: text !important; -webkit-user-select: text !important; }',
            '::selection { background: highlight !important; color: highlighttext !important; }',
          );
        }
        for (const selector of erasedSelectors) {
          rules.push(`${selector} { display: none !important; }`);
        }
        style.textContent = rules.join('\n');
      }

      const fix = document.getElementById(WN_OVERLAY_FIX_ID);
      if (overlayRemoved && !fix) {
        const created = ensureStyleEl(WN_OVERLAY_FIX_ID);
        if (created) {
          created.textContent =
            'html, body { overflow: auto !important; position: static !important; }';
        }
      } else if (!overlayRemoved && fix) {
        fix.remove();
      }
    };

    // ---------- DOM maintenance ----------

    let observer: MutationObserver | null = null;
    let scheduled = false;

    const needsMaintenance = (): boolean =>
      siteEnabled &&
      (features.selection ||
        features.contextMenu ||
        features.copyPaste ||
        features.unlockInputs);

    const maintain = (): void => {
      if (!siteEnabled) return;
      if (features.selection || features.contextMenu || features.copyPaste) {
        stripBlockingHandlers(document);
      }
      if (features.copyPaste) unlockPasswordClipboard(document);
      if (features.unlockInputs) unlockFormFields(document);
    };

    const scheduleMaintain = (): void => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        maintain();
      }, 0);
    };

    const syncObservers = (): void => {
      const needed = needsMaintenance();
      if (needed && !observer) {
        observer = new MutationObserver(scheduleMaintain);
        observer.observe(document, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: [...BLOCKING_ATTRS, 'disabled', 'readonly', 'type'],
        });
        maintain();
      } else if (!needed && observer) {
        observer.disconnect();
        observer = null;
      }
    };

    // ---------- settings application ----------

    const applySettings = (settings: Settings): void => {
      const site = settings.sites[host];
      siteEnabled = !!site?.enabled;
      features = getEffectiveFeatures(settings, host);
      erasedSelectors = siteEnabled ? (site?.erasedSelectors ?? []) : [];
      overlayRemoved = siteEnabled && site?.overlaysRemoved === true;

      if (!siteEnabled && eraseMode) stopEraseMode();
      if (!siteEnabled && selectMode) stopSelectMode();

      pushFeatures();
      rebuildStyles();
      syncObservers();
    };

    void getSettings().then(applySettings);
    onSettingsChanged(applySettings);
    document.addEventListener('DOMContentLoaded', () => {
      pushFeatures();
      rebuildStyles();
      maintain();
    });

    // ---------- commands ----------

    const toggleFeature = async (key: FeatureKey): Promise<void> => {
      await updateSite(host, (site) => {
        site.enabled = true;
        site.features[key] = !features[key];
      });
    };

    const handleCommand = async (command: WnCommand): Promise<void> => {
      switch (command) {
        case 'erase-mode':
          if (eraseMode) stopEraseMode();
          else startEraseMode();
          break;
        case 'select-mode':
          if (selectMode) stopSelectMode();
          else startSelectMode();
          break;
        case 'remove-overlays':
          removeOverlays();
          break;
        case 'restore-erased':
          await popErasedSelector(host);
          break;
        case 'toggle-unlock-inputs':
          await toggleFeature('unlockInputs');
          break;
        case 'toggle-reveal-passwords':
          await toggleFeature('revealPasswords');
          break;
      }
    };

    browser.runtime.onMessage.addListener((msg: { type?: string; command?: WnCommand }, _sender, sendResponse) => {
      if (msg?.type !== WN_COMMAND_MESSAGE || !msg.command) return;
      void handleCommand(msg.command);
      sendResponse({ ok: true });
    });

    // ---------- element eraser ----------

    let hovered: Element | null = null;
    let relayedHover: Element | null = null;

    // Clicks on cross-origin ad iframes land inside the frame, where nothing
    // we persist survives a reload. Those frames relay up so the hosting
    // iframe element gets erased in a frame whose selectors persist.
    const relayErase = ((): boolean => {
      if (window.top === window) return false;
      try {
        void window.parent.location.href;
        return false;
      } catch {
        return true;
      }
    })();

    const relayUp = (kind: 'hover' | 'erase'): void => {
      window.parent?.postMessage({ type: WN_ERASE_RELAY, kind }, '*');
    };

    const findFrameByWindow = (source: MessageEvent['source']): Element | null => {
      if (!source) return null;
      for (const frame of document.querySelectorAll('iframe, frame')) {
        if ((frame as HTMLIFrameElement).contentWindow === source) return frame;
      }
      return null;
    };

    const onEraseRelay = (event: MessageEvent): void => {
      if (!eraseMode) return;
      const data = event.data as { type?: string; kind?: string } | null;
      if (data?.type !== WN_ERASE_RELAY || (data.kind !== 'hover' && data.kind !== 'erase')) return;
      const frame = findFrameByWindow(event.source);
      if (!frame) return;
      if (relayErase) {
        // Nothing we persist in this frame's document survives a reload, so
        // pass the relay up until it reaches a frame that can persist.
        window.parent?.postMessage(data, '*');
        return;
      }
      if (data.kind === 'erase') {
        frame.classList.remove(WN_HOVER_CLASS);
        if (frame === hovered) hovered = null;
        void eraseElement(frame);
        return;
      }
      if (frame === hovered) return;
      hovered?.classList.remove(WN_HOVER_CLASS);
      hovered = frame;
      frame.classList.add(WN_HOVER_CLASS);
    };
    window.addEventListener('message', onEraseRelay);

    const onEraseHover = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof Element) || target === hovered) return;
      if (relayErase) {
        if (target === relayedHover) return;
        relayedHover = target;
        relayUp('hover');
        return;
      }
      hovered?.classList.remove(WN_HOVER_CLASS);
      hovered = target;
      hovered.classList.add(WN_HOVER_CLASS);
    };

    const onEraseClick = (event: MouseEvent): void => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (relayErase) {
        relayUp('erase');
        return;
      }
      const target = event.target;
      if (target instanceof Element) void eraseElement(target);
    };

    const onEraseKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      stopEraseMode();
    };

    const startEraseMode = (): void => {
      if (eraseMode) return;
      eraseMode = true;
      rebuildStyles();
      window.addEventListener('mouseover', onEraseHover, true);
      window.addEventListener('mousemove', onEraseHover, true);
      window.addEventListener('click', onEraseClick, true);
      window.addEventListener('keydown', onEraseKey, true);
    };

    const stopEraseMode = (): void => {
      if (!eraseMode) return;
      eraseMode = false;
      window.removeEventListener('mouseover', onEraseHover, true);
      window.removeEventListener('mousemove', onEraseHover, true);
      window.removeEventListener('click', onEraseClick, true);
      window.removeEventListener('keydown', onEraseKey, true);
      hovered?.classList.remove(WN_HOVER_CLASS);
      hovered = null;
      relayedHover = null;
      rebuildStyles();
    };

    const eraseElement = async (target: Element): Promise<void> => {
      target.classList.remove(WN_HOVER_CLASS);
      hovered = null;
      if (isShadowElement(target)) {
        (target as HTMLElement).style.setProperty('display', 'none', 'important');
        return;
      }
      const selector = getStableSelector(target);
      if (selector) await addErasedSelectors(host, [selector]);
    };

    // ---------- text select mode ----------

    // Sites defeat the caret with user-select: none, mousedown preventDefault
    // and click/selection-clearing handlers. While this mode is on we force a
    // text cursor and selectable text, and swallow the mouse events site code
    // uses to interfere — without preventDefault, so the browser's native
    // drag-select still works. The gatekeeper above also allows contextmenu,
    // selectstart and clipboard events so the selection can actually be copied.
    const onSelectMouse = (event: Event): void => {
      event.stopImmediatePropagation();
    };

    const onSelectKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      stopSelectMode();
    };

    const showSelectToast = (): HTMLElement | null => {
      const host = document.body ?? document.documentElement;
      if (!host) return null;
      const toast = document.createElement('div');
      toast.textContent = 'WN select mode - drag to select, Esc to exit';
      Object.assign(toast.style, {
        position: 'fixed',
        left: '50%',
        bottom: '18px',
        transform: 'translateX(-50%)',
        zIndex: '2147483647',
        padding: '6px 12px',
        borderRadius: '999px',
        background: 'rgba(17, 24, 39, 0.92)',
        color: '#f9fafb',
        font: '600 12px/1.4 system-ui, sans-serif',
        pointerEvents: 'none',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.35)',
      } satisfies Partial<CSSStyleDeclaration>);
      host.appendChild(toast);
      return toast;
    };

    let selectToast: HTMLElement | null = null;

    const startSelectMode = (): void => {
      if (selectMode) return;
      selectMode = true;
      rebuildStyles();
      pushFeatures();
      window.addEventListener('mousedown', onSelectMouse, true);
      window.addEventListener('mouseup', onSelectMouse, true);
      window.addEventListener('click', onSelectMouse, true);
      window.addEventListener('dblclick', onSelectMouse, true);
      window.addEventListener('keydown', onSelectKey, true);
      selectToast = showSelectToast();
    };

    const stopSelectMode = (): void => {
      if (!selectMode) return;
      selectMode = false;
      window.removeEventListener('mousedown', onSelectMouse, true);
      window.removeEventListener('mouseup', onSelectMouse, true);
      window.removeEventListener('click', onSelectMouse, true);
      window.removeEventListener('dblclick', onSelectMouse, true);
      window.removeEventListener('keydown', onSelectKey, true);
      selectToast?.remove();
      selectToast = null;
      rebuildStyles();
      pushFeatures();
    };

    // ---------- overlays ----------

    const removeOverlays = (): void => {
      const overlays = findOverlays();
      const selectors: string[] = [];
      for (const el of overlays) {
        // Shadow DOM nodes can't be matched by a document selector, so they
        // can only be hidden inline for this page load.
        const selector = isShadowElement(el) ? null : getStableSelector(el);
        if (selector) selectors.push(selector);
        else el.style.setProperty('display', 'none', 'important');
      }
      if (overlays.length > 0) void saveRemovedOverlays(host, selectors);
      overlayRemoved = true;
      rebuildStyles();
    };
  },
});
