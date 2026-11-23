# Privacy Policy — Window Ninja

_Last updated: November 18, 2026_

Window Ninja is a browser utility that restores native browser behavior (right-click, clipboard actions, text selection, developer shortcuts) on websites that block them, and provides local page-cleanup tools (element eraser, input unlock, password reveal).

**Window Ninja never collects page content, browsing history, passwords, clipboard data, or anything that identifies you.** An optional, anonymous usage-statistics feature (on by default, one click to turn off) is described below — it can be disabled in the extension options at any time.

## What the extension accesses

- **Page content (DOM):** to remove event blockers, unlock form fields, hide elements you erase, and reveal password fields, the extension reads and modifies the pages you visit. This happens entirely inside your browser.
- **Clipboard:** when you press Ctrl+C / Ctrl+X while focused on a password field (and clipboard unlocking is enabled), the extension writes your selected text to the system clipboard on your behalf. Clipboard contents are used for this action only and are never read, stored, logged, or transmitted by the extension.
- **Passwords:** password fields are shown or manipulated only in your browser at your request. Passwords are never saved, copied to extension storage, or sent anywhere.

## What is stored

- Your settings (which sites are enabled, feature toggles, erased-element selectors) are saved in `chrome.storage.sync`, which syncs through your own signed-in Chrome profile. This data contains only your preferences — never page content, clipboard data, or passwords.
- A random identifier (UUID) for anonymous usage statistics is saved in `chrome.storage.local`. It is not linked to your name, email, account, or identity in any way, and removing the extension deletes it.
- Uninstalling the extension removes this data.

## Anonymous usage statistics (optional)

If enabled (default), the extension sends occasional counts of feature usage — for example "the element eraser was used" or "a site was enabled" — together with:

- The extension version.
- Your browser language.
- The random UUID described above.
- A timestamp and a coarse country, derived from your IP address by the server. Your IP address itself is not stored.

What is **never** sent: page content, URLs, hostnames or site names, erased selectors, passwords, clipboard data, or anything about which sites you use Window Ninja on.

You can turn this off any time in **Options → Anonymous usage stats**. When disabled, the extension makes no network requests of any kind.

## What is NOT done

- No page content, URLs, browsing history, passwords, or clipboard data ever leaves your browser.
- No advertising, no profiling, no data sold or shared with third parties.
- No remote code; all code is bundled in the extension package.

## Permissions

- `storage` — save your preferences locally / via Chrome sync.
- `clipboardWrite` — perform cut/copy on password fields when you request it.
- Host access to all sites (`<all_urls>`) — required so the restore features work on any website you choose to enable them on. Features are off by default; you enable Window Ninja per site.

## Contact

Questions or concerns: open an issue at https://github.com/AdiDecodes/Window-Ninja/issues
