# Site integrations

How Tilmo finds the message box and replaces drafts on each supported site.
For manual test steps, see [manual-testing.md](manual-testing.md).

## Telegram Web

Works in Telegram Web K and A, with the Tiptap/ProseMirror composer and
Telegram's plain editor. Languages: Oʻzbekcha, English, Русский.

## Instagram Direct

Open a conversation at `https://www.instagram.com/direct/…` and type a
message: the same Translate button appears above the message bar (never over
the emoji, attachment or Send buttons).

The same controls work in the floating DM panels that open over Reels, posts,
profiles and other pages. They follow whichever panel's message box you focus,
hide when a panel is closed or minimized, and sit above that panel's message bar
(never over its emoji, microphone, attachment or Send buttons).

The content script runs on all `www.instagram.com` pages because Instagram
navigates without reloading. It activates only for a genuine conversation
composer, decided by the page structure rather than the URL:

- The field must be a message box: a textarea or Lexical textbox labelled as a
  message, never a search, comment, caption, note, name or story-reply field.
- On the main `/direct/` page, that is enough.
- In a dialog or fixed-position overlay (a floating panel), the overlay must
  also contain a message thread (an element with role `grid`, `log` or `row`,
  or a label mentioning messages, conversation or chat) and must not be a
  recipient picker (search box or checkboxes, as in Share, Forward and New
  message).
- Anywhere else, it stays inactive.

How replacement works: the composer is Instagram's Lexical editor (or a
textarea on older layouts). The extension selects the draft and uses the
browser's own `insertText` editing command for a single line, or a plain-text
paste for several lines, so Instagram's editor updates its own state. It then
reads the composer back; if the text did not stick exactly, the original draft is
put back and only **Copy** is offered. A draft that contains anything besides
plain text, emoji and line breaks (mentions, links, stickers, unknown
structure) is never overwritten — use **Copy**.

Privacy: only the active draft is read, and only after you press Translate.
Chat history and received messages are never read, nothing is
stored, and Instagram's network requests and private APIs are not touched.

Known limitations:

- Instagram changes its DOM often. If the button does not appear or Replace
  stays unavailable, use Copy and report the DOM structure using the diagnostic in
  [manual-testing.md](manual-testing.md).
- Floating DM panels are recognised by the structure described above. If a
  panel's composer gets no Translate button, run the floating-panel diagnostic in
  [manual-testing.md](manual-testing.md).
- A panel minimized by an animation that keeps its boxes on screen is only
  detected once focus leaves it (clicking elsewhere hides the controls).
