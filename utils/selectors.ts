export function isShadowElement(el: Element): boolean {
  return el.getRootNode() instanceof ShadowRoot;
}

export function getStableSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;

  const parts: string[] = [];
  let node: Element | null = el;

  while (node && node.nodeType === Node.ELEMENT_NODE) {
    const tag = node.localName;
    let part = tag;
    const parent: Element | null = node.parentElement;

    if (parent) {
      const sameTag = Array.from(parent.children).filter((c) => c.localName === tag);
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
    }

    parts.unshift(part);
    const candidate = parts.join(' > ');
    try {
      if (document.querySelectorAll(candidate).length === 1) return candidate;
    } catch {
      // invalid selector; keep walking up
    }

    if (parts.length >= 10 || !parent) break;
    node = parent;
  }

  return parts.join(' > ');
}
