// Values generated at runtime (React ":r1:", CSS modules, ad slot ids) put
// digits next to letters inside the token; hand-written names keep them apart
// or use separators. Only the latter survive a reload, so prefer them.
const GENERATED_VALUE = /[0-9][a-z]|[a-z][0-9]/i;

const isStable = (value: string): boolean => !GENERATED_VALUE.test(value);

export function isShadowElement(el: Element): boolean {
  return el.getRootNode() instanceof ShadowRoot;
}

export function getStableSelector(el: Element): string {
  if (el.id && isStable(el.id)) return `#${CSS.escape(el.id)}`;

  const parts: string[] = [];
  let node: Element | null = el;

  while (node && node.nodeType === Node.ELEMENT_NODE) {
    const tag = node.localName;
    const parent: Element | null = node.parentElement;

    let positional = tag;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((c) => c.localName === tag);
      if (sameTag.length > 1) positional = `${tag}:nth-of-type(${sameTag.indexOf(node) + 1})`;
    }

    // Class hooks beat positional ones: they survive layout shifts between
    // page loads, which nth-of-type paths do not.
    const hooks: string[] = [];
    for (const cls of node.classList) {
      if (isStable(cls)) hooks.push(`${tag}.${CSS.escape(cls)}`);
    }
    hooks.push(positional);

    for (const hook of hooks) {
      const candidate = [...parts, hook].join(' > ');
      try {
        if (document.querySelectorAll(candidate).length === 1) return candidate;
      } catch {
        // invalid selector; keep walking up
      }
    }

    parts.push(positional);
    if (parts.length >= 10 || !parent) break;
    node = parent;
  }

  return parts.join(' > ');
}
