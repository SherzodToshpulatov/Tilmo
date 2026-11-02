# Changelog

All notable changes to Tilmo are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). While the major version is 0, any
release may change behaviour.

## [0.1.0] - Unreleased

First public beta.

### Added

- **Inline translation on Telegram Web** (`web.telegram.org`, K and A): a
  Translate button next to the message box, with support for Telegram's
  Tiptap/ProseMirror composer.
- **Instagram Direct** (`www.instagram.com/direct/…`) and Instagram's **floating
  chat panels** over Reels, posts and profiles, with support for the Lexical
  composer and textarea composers.
- **Translation panel** with source and target language selection, swapping,
  detected-language display, preview, **Replace**, **Copy**, **Undo**, loading
  and error states, and light/dark themes that follow the page.
- **Languages:** Uzbek, English, Russian.
- **Translators:** MyMemory (default, no setup), Google Cloud Translation through
  an optional self-hosted Cloudflare Worker (`apps/api`), and an offline demo.
- **Settings popup** for the translator, default languages, MyMemory contact email
  and server connection.
- **Safety protections:** Replace is offered only for plain-text drafts; it is
  refused if the draft changed or the chat changed while translating; the result
  is verified after replacement and the original restored if it did not stick;
  messages are never sent automatically; unchanged translations are flagged
  instead of offered for replacement.
- **Backend (optional):** access-token authentication, per-token rate limiting,
  a monthly character budget, input validation, and no logging of text.
- Tilmo name, logo and icons; `PRIVACY.md`; MIT license; contributor documents;
  CI and release workflows; third-party license notices bundled in the package.

### Known limitations

- Instagram support has been tested against simulated markup and a real Lexical
  editor, but not yet in a signed-in Instagram session.
- MyMemory accepts at most 500 bytes per translation and cannot detect the
  source language.
- Tested in desktop Google Chrome only.

[0.1.0]: https://github.com/SherzodToshpulatov/Tilmo/releases/tag/v0.1.0
