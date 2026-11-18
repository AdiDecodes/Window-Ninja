export const BLOCKING_ATTRS = [
  'oncontextmenu',
  'oncopy',
  'oncut',
  'onpaste',
  'onbeforecopy',
  'onbeforecut',
  'onselectstart',
  'ondragstart',
] as const;

const BLOCKING_ATTR_SELECTOR = BLOCKING_ATTRS.map((attr) => `[${attr}]`).join(',');

function clearBlockingHandlers(el: HTMLElement | Document): void {
  const holder = el as HTMLElement & Record<string, unknown>;
  for (const attr of BLOCKING_ATTRS) {
    if (el instanceof Element) {
      if (el.hasAttribute(attr)) {
        // Overwrite with a benign handler first: Chrome keeps the parser-compiled
        // handler active after removeAttribute, but re-setting the attribute evicts it.
        el.setAttribute(attr, 'void 0');
        el.removeAttribute(attr);
      }
      holder[attr] = null;
    } else {
      holder[attr] = null;
    }
  }
}

export function stripBlockingHandlers(root: ParentNode): void {
  const targets = root.querySelectorAll<HTMLElement>(BLOCKING_ATTR_SELECTOR);
  for (const el of targets) clearBlockingHandlers(el);
  if (root === document) {
    const doc = document as Document;
    for (const el of [doc.documentElement, doc.body, doc]) {
      if (el) clearBlockingHandlers(el as HTMLElement | Document);
    }
  }
}

const FORM_UNLOCK_SELECTOR = [
  'input[readonly]',
  'input[disabled]',
  'textarea[readonly]',
  'textarea[disabled]',
  'select[disabled]',
  'button[disabled]',
].join(',');

const FORM_CLIPBOARD_ATTRS = ['onpaste', 'oncopy', 'oncut', 'oncontextmenu', 'ondrop'] as const;

export function unlockFormFields(root: ParentNode): void {
  const locked = root.querySelectorAll(FORM_UNLOCK_SELECTOR);
  for (const el of locked) {
    el.removeAttribute('readonly');
    el.removeAttribute('disabled');
    el.removeAttribute('aria-disabled');
  }
  const fields = root.querySelectorAll('input, textarea, select');
  for (const field of fields) {
    for (const attr of FORM_CLIPBOARD_ATTRS) field.removeAttribute(attr);
  }
}

export function revealPasswords(root: ParentNode): void {
  const inputs = root.querySelectorAll<HTMLInputElement>('input[type="password"]');
  for (const input of inputs) {
    if (input.dataset.wnOrigType) continue;
    input.dataset.wnOrigType = 'password';
    input.type = 'text';
  }
}

export function restorePasswords(root: ParentNode): void {
  const inputs = root.querySelectorAll<HTMLInputElement>('input[data-wn-orig-type]');
  for (const input of inputs) {
    input.type = input.dataset.wnOrigType ?? 'password';
    delete input.dataset.wnOrigType;
  }
}

export function findOverlays(): HTMLElement[] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw === 0 || vh === 0) return [];

  const overlays: HTMLElement[] = [];
  const candidates = document.body?.querySelectorAll<HTMLElement>('body *') ?? [];

  for (const el of candidates) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;

    const zIndex = Number.parseInt(cs.zIndex, 10);
    if (Number.isNaN(zIndex) || zIndex < 500) continue;

    if (/^(HTML|BODY|VIDEO|CANVAS|DIALOG)$/.test(el.tagName)) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) continue;

    const coverage = (Math.min(rect.width, vw) * Math.min(rect.height, vh)) / (vw * vh);
    if (coverage >= 0.6) overlays.push(el);
  }

  return overlays;
}
