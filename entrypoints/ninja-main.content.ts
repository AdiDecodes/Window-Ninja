import { WN_EVENT, WN_FEATURES_ATTR } from '../utils/constants';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    const w = window as typeof window & { __windowNinjaInstalled?: boolean };
    if (w.__windowNinjaInstalled) return;
    w.__windowNinjaInstalled = true;

    type GuardState = {
      contextMenu: boolean;
      copyPaste: boolean;
      selection: boolean;
      devShortcuts: boolean;
    };

    const state: GuardState = {
      contextMenu: false,
      copyPaste: false,
      selection: false,
      devShortcuts: false,
    };

    const EVENT_FEATURE: Record<string, keyof GuardState> = {
      contextmenu: 'contextMenu',
      copy: 'copyPaste',
      cut: 'copyPaste',
      paste: 'copyPaste',
      beforecopy: 'copyPaste',
      beforecut: 'copyPaste',
      selectstart: 'selection',
      dragstart: 'selection',
    };

    const isCancelableType = (event: Event): boolean => {
      const feature = EVENT_FEATURE[event.type];
      return feature !== undefined && state[feature];
    };

    const isDevShortcut = (e: KeyboardEvent): boolean => {
      if (!state.devShortcuts) return false;
      if (e.key === 'F12') return true;
      if (!(e.ctrlKey || e.metaKey)) return false;
      const key = e.key.toLowerCase();
      if (e.shiftKey) return key === 'i' || key === 'j' || key === 'c';
      if (key === 'u' || key === 's' || key === 'p') return true;
      if (state.copyPaste && (key === 'c' || key === 'x')) return true;
      return false;
    };

    try {
      const nativePreventDefault = Event.prototype.preventDefault;
      Event.prototype.preventDefault = function (this: Event) {
        if (isCancelableType(this)) return;
        if (this instanceof KeyboardEvent && isDevShortcut(this)) return;
        nativePreventDefault.call(this);
      } as typeof Event.prototype.preventDefault;

      const returnValueDesc = Object.getOwnPropertyDescriptor(Event.prototype, 'returnValue');
      const nativeSetReturnValue = returnValueDesc?.set;
      const nativeGetReturnValue = returnValueDesc?.get;
      if (nativeGetReturnValue && nativeSetReturnValue) {
        Object.defineProperty(Event.prototype, 'returnValue', {
          configurable: true,
          get: nativeGetReturnValue,
          set(this: Event, value: boolean) {
            if (!value && isCancelableType(this)) return;
            nativeSetReturnValue.call(this, value);
          },
        });
      }
    } catch {
      // page anti-tamper; fail soft
    }

    const HANDLER_FEATURE: Record<string, keyof GuardState> = {
      oncontextmenu: 'contextMenu',
      oncopy: 'copyPaste',
      oncut: 'copyPaste',
      onpaste: 'copyPaste',
      onselectstart: 'selection',
      ondragstart: 'selection',
    };

    const findHandlerDesc = (obj: object, prop: string): PropertyDescriptor | undefined => {
      let proto: object | null = obj;
      while (proto) {
        const desc = Object.getOwnPropertyDescriptor(proto, prop);
        if (desc?.get && desc.set) return desc;
        proto = Object.getPrototypeOf(proto);
      }
      return undefined;
    };

    const guardHandlerProps = (target: object): void => {
      for (const [prop, feature] of Object.entries(HANDLER_FEATURE)) {
        const desc = findHandlerDesc(target, prop);
        if (!desc) continue;
        try {
          Object.defineProperty(target, prop, {
            configurable: true,
            get(this: object) {
              if (state[feature]) return null;
              return desc.get!.call(this);
            },
            set(this: object, value: unknown) {
              if (!state[feature]) desc.set!.call(this, value);
            },
          });
        } catch {
          // fail soft
        }
      }
    };

    try {
      guardHandlerProps(Document.prototype);
    } catch {}
    try {
      guardHandlerProps(HTMLElement.prototype);
    } catch {}
    try {
      guardHandlerProps(window);
    } catch {}

    const applyFeaturePayload = (raw: unknown): void => {
      if (typeof raw !== 'string') return;
      try {
        Object.assign(state, JSON.parse(raw) as Partial<GuardState>);
      } catch {
        // malformed payload; ignore
      }
    };

    window.addEventListener(WN_EVENT, (event) => {
      applyFeaturePayload((event as CustomEvent<string>).detail);
    });

    const readDomState = (): void => {
      applyFeaturePayload(document.documentElement?.getAttribute(WN_FEATURES_ATTR));
    };
    readDomState();
    document.addEventListener('DOMContentLoaded', readDomState);
    new MutationObserver(readDomState).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: [WN_FEATURES_ATTR],
    });
  },
});
