# Page Text Copier & Screenshot (Chrome Extension)

Press **Ctrl + [** to copy all visible text on the current webpage to your clipboard. Press **Ctrl + }** (Ctrl + Shift + ]) to capture a PNG screenshot of the visible tab and auto-download it. A small bottom-left overlay gives status feedback.

## Files
- `manifest.json` – Extension configuration (MV3).
- `background.js` – Service worker: handles screenshot capture requests.
- `contentScript.js` – Injected into pages; extracts visible text, copies it, triggers screenshot download via shortcuts.

## Setup
1. Open Chrome: `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder.

## Install Locally
1. Open Chrome: go to `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select this folder (`extention`).

## Usage
1. Navigate to any page.
2. Press **Ctrl + [** → overlay shows `copy…` then `copied` (✓). Text now in clipboard.
3. Press **Ctrl + }** (Ctrl + Shift + ]) → overlay shows `shot…` then `saved` (✓) and a PNG downloads.

## Notes
- Key capture is done in the content script; if the page traps the key combination you may not trigger the extension.
- Page text is extracted using a TreeWalker filtering hidden/script/style/etc nodes, with fallback to `innerText`.
- Overlay has high `z-index` and is non-interactive.

## Troubleshooting
- If copy fails (`copy?`) page may block clipboard without secure context (prefer https). Try clicking the page then reusing the shortcut.
- If screenshot fails (`shot?`) ensure the tab is active and extension has `tabs` + `<all_urls>` host permission. Reload extension & page.

## Security
No external calls for text or screenshot; data stays local. Beware copying very large pages (clipboard size limits in some environments).

## Future Improvements
- Options page with configurable shortcuts.
- Full-page (scroll) screenshot stitching.
- Automatic text file download alongside screenshot.
