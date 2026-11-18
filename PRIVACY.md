# Privacy Policy — Window Ninja

_Last updated: November 18, 2026_

Window Ninja is a browser utility that restores native browser behavior (right-click, clipboard actions, text selection, developer shortcuts) on websites that block them, and provides local page-cleanup tools (element eraser, input unlock, password reveal).

**Window Ninja does not collect, transmit, sell, or share any user data.**

## What the extension accesses

- **Page content (DOM):** to remove event blockers, unlock form fields, hide elements you erase, and reveal password fields, the extension reads and modifies the pages you visit. This happens entirely inside your browser.
- **Clipboard:** when you press Ctrl+C / Ctrl+X while focused on a password field (and clipboard unlocking is enabled), the extension writes your selected text to the system clipboard on your behalf. Clipboard contents are used for this action only and are never read, stored, logged, or transmitted by the extension.
- **Passwords:** password fields are shown or manipulated only in your browser at your request. Passwords are never saved, copied to extension storage, or sent anywhere.

## What is stored

- Your settings (which sites are enabled, feature toggles, erased-element selectors) are saved in `chrome.storage.sync`, which syncs through your own signed-in Chrome profile. This data contains only your preferences — never page content, clipboard data, or passwords.
- Uninstalling the extension removes this data.

## What is NOT done

- No analytics, tracking, or telemetry.
- No network requests of any kind.
- No remote code; all code is bundled in the extension package.
- No data sold or shared with third parties.
- No ads.

## Permissions

- `storage` — save your preferences locally / via Chrome sync.
- `clipboardWrite` — perform cut/copy on password fields when you request it.
- Host access to all sites (`<all_urls>`) — required so the restore features work on any website you choose to enable them on. Features are off by default; you enable Window Ninja per site.

## Contact

Questions or concerns: open an issue at https://github.com/AdiDecodes/Window-Ninja/issues
