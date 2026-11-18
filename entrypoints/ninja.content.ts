import {
  WN_COMMAND_MESSAGE,
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
  addErasedSelector,
  getEffectiveFeatures,
  getSettings,
  onSettingsChanged,
  popErasedSelector,
  updateSite,
} from '../utils/storage';
import {
  BLOCKING_ATTRS,
  copyPasswordSelection,
  findOverlays,
  isPasswordClipboardTarget,
  restorePasswords,
  revealPasswords,
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
    let initialized = false;
    let prevFeatures: Features = { ...features };

    // ---------- event gatekeeper ----------
    // Registered synchronously at document_start so these run before any page
    // listener. stopImmediatePropagation in the capture phase keeps site code
    // from ever running on these events, which defeats blockers regardless of
    // how they were registered (including pristine cross-realm references).
    const isGatekeptType = (type: string, event: Event): boolean => {
      switch (type) {
        case 'contextmenu':
          return features.contextMenu;
        case 'copy':
        case 'cut':
        case 'paste':
        case 'beforecopy':
        case 'beforecut':
          return features.copyPaste;
        case 'selectstart':
        case 'dragstart':
          return features.selection;
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
        if (eraseMode) {
          rules.push(
            `.${WN_HOVER_CLASS} { outline: 2px solid #ffffff !important; outline-offset: -2px !important; box-shadow: 0 0 0 1px #000000 !important; cursor: crosshair !important; }`,
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
        features.unlockInputs ||
        features.revealPasswords);

    const maintain = (): void => {
      if (!siteEnabled) return;
      if (features.selection || features.contextMenu || features.copyPaste) {
        stripBlockingHandlers(document);
      }
      if (features.copyPaste) unlockPasswordClipboard(document);
      if (features.unlockInputs) unlockFormFields(document);
      if (features.revealPasswords) revealPasswords(document);
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
      erasedSelectors = site?.erasedSelectors ?? [];

      if (initialized && prevFeatures.revealPasswords && !features.revealPasswords) {
        restorePasswords(document);
      }
      initialized = true;
      prevFeatures = { ...features };

      if (!siteEnabled && eraseMode) stopEraseMode();

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

    const onEraseHover = (event: Event): void => {
      const target = event.target;
      if (!(target instanceof Element) || target === hovered) return;
      hovered?.classList.remove(WN_HOVER_CLASS);
      hovered = target;
      hovered.classList.add(WN_HOVER_CLASS);
    };

    const onEraseClick = (event: MouseEvent): void => {
      event.preventDefault();
      event.stopImmediatePropagation();
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
      if (selector) await addErasedSelector(host, selector);
    };

    // ---------- overlays ----------

    const removeOverlays = (): void => {
      for (const el of findOverlays()) {
        el.style.setProperty('display', 'none', 'important');
      }
      overlayRemoved = true;
      rebuildStyles();
    };
  },
});
