# Window Ninja

A dev utility Chrome extension (Manifest V3) that restores default browsing behaviors on restrictive websites and adds DOM power tools.

## Features

- **Unblockers** — right-click, copy/cut/paste, text selection, dev shortcuts (F12, Ctrl/Cmd+U/S/P, Ctrl/Cmd+Shift+I/J/C)
- **Element eraser** — hover + click to hide any element; persisted per-site (`Alt+Shift+E`)
- **Input un-locker** — remove `readonly`/`disabled` and clipboard blockers from form fields (`Alt+Shift+U`)
- **Password reveal** — show password fields as text (`Alt+Shift+P`)
- **Overlay remover** — one-shot removal of full-screen modal/overlay layers and scroll locks (`Alt+Shift+O`)

Everything is opt-in per site via the popup. The extension is dormant on sites you haven't enabled.

## How the unblocking works

Event listeners can't be enumerated once registered, so Window Ninja intercepts at the prototype level in the page's MAIN world before site scripts run: `Event.prototype.preventDefault` (and the legacy `returnValue` path) become no-ops for blocked event types, keyboard `preventDefault` is neutralized for dev shortcuts, `document.on*` handler assignments are guarded, and inline `on*="return false"` attributes are stripped by the content script with a MutationObserver.

## Development

```bash
npm install
npm run icons      # regenerate public/icon/*.png
npm run dev        # wxt dev server, load .output/chrome-mv3 unpacked
npm run compile    # typecheck
npm run build      # production build
npm run zip        # store-ready zip
npm run test:serve # serve test pages on localhost:8000
```

`test/fully-loaded.html` is a self-testing harness for every feature (JS + inline blockers, re-blocker loop, dynamic locked inputs/passwords, overlays with z-threshold checks, eraser targets) — open it, run the self-test, and the results rail shows PASS/FAIL per check.

Load the extension: `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome-mv3`.

## Verification

1. Run `npm run test:serve` and open http://localhost:8000/blockers.html
2. Enable the site in the popup — right-click, copy, selection should work; the event log shows the site's attempts being defeated
3. Toggle features off — blocking returns without a reload
