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

const PASSWORD_CLIPBOARD_ATTRS = ['oncopy', 'oncut', 'onpaste', 'onbeforecopy', 'onbeforecut'] as const;

export function isPasswordClipboardTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && target.type === 'password';
}

// Chromium never dispatches cut/copy events for password inputs, so the default
// clipboard action never runs. We perform it manually instead.
export async function copyPasswordSelection(input: HTMLInputElement, isCut: boolean): Promise<boolean> {
  const { selectionStart, selectionEnd, value } = input;
  if (selectionStart === null || selectionEnd === null || selectionStart === selectionEnd) return false;
  const text = value.slice(selectionStart, selectionEnd);

  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    // Classic fallback: expose the field as text so execCommand's copy path is allowed.
    const origType = input.type;
    input.type = 'text';
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    input.type = origType;
  }
  if (!ok) return false;

  if (isCut) {
    input.value = value.slice(0, selectionStart) + value.slice(selectionEnd);
    input.setSelectionRange(selectionStart, selectionStart);
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }
  return true;
}

export function unlockPasswordClipboard(root: ParentNode): void {
  const inputs = root.querySelectorAll<HTMLInputElement>('input[type="password"]');
  for (const input of inputs) {
    for (const attr of PASSWORD_CLIPBOARD_ATTRS) {
      if (input.hasAttribute(attr)) {
        // Overwrite with a benign handler first: Chrome keeps the parser-compiled
        // handler active after removeAttribute, but re-setting the attribute evicts it.
        input.setAttribute(attr, 'void 0');
        input.removeAttribute(attr);
      }
      (input as unknown as HTMLElement & Record<string, unknown>)[attr] = null;
    }
  }
}

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

// Reveal via CSS instead of swapping input.type: the type attribute stays
// "password", so site event handlers and framework re-renders that reset it
// can't undo the reveal, and fields added later are covered automatically.
export const REVEAL_PASSWORDS_RULE =
  'input[type="password"] { -webkit-text-security: none !important; }';

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
