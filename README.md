# Browser Translator

An in-browser translation assistant built with WXT, React, and TypeScript.

## Telegram Web MVP

The Telegram Web content script detects supported message composers and provides
a local demo translation preview. No message text is sent to a server. Replacement
is explicit and is offered only for plain-text drafts that the editor accepts;
the extension never submits a message.

The default `Ctrl+Shift+Y` extension command is translated by Chrome to
`Command+Shift+Y` on macOS. If the shortcut is unavailable or conflicts with
another extension, configure it at `chrome://extensions/shortcuts`.
