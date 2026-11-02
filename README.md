<p align="center">
  <img src="assets/brand/tilmo-wordmark.svg" alt="Tilmo" width="280">
</p>

<p align="center"><strong>Translate where you type.</strong></p>

<p align="center">
  <a href="https://github.com/SherzodToshpulatov/browser-translator/actions/workflows/ci.yml"><img src="https://github.com/SherzodToshpulatov/browser-translator/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
</p>

# Tilmo

Tilmo is an open-source browser extension that translates the message you are
writing — right inside the message box on Telegram Web and Instagram — so you
can check the translation, put it in place, and send it yourself.

> **Beta (0.1.0).** Tilmo works, but it is early software. Read
> [Supported websites](#supported-websites) for what has and has not been tested.

## Why Tilmo?

Writing to someone in another language usually means copying your message into
a translator, copying the result back, and fixing the formatting. Tilmo removes
that round trip: a small button next to the message box translates your draft in
place, shows you the result first, and lets you undo it.

## Features

- **Translate button** next to the message box, in a compact floating panel.
- **Preview first:** nothing changes in your message until you press **Replace**.
- **Replace, Copy, and Undo**, with the original draft restored by **Undo**.
- **Language selection** with a swap button and saved defaults; the detected
  language is shown when the translator reports it.
- **Languages:** Uzbek, English, Russian.
- **Translators:** MyMemory (free, no setup), Google Cloud Translation through
  your own server (optional), and an offline demo.
- **Safety:** Tilmo never sends messages. Replace is offered only for plain-text
  drafts, is refused if the draft or chat changed while translating, and is
  checked after it runs.
- **Light and dark themes** that follow the website.

## Supported websites

| Website | Where Tilmo appears | Testing status |
| --- | --- | --- |
| Telegram Web | `web.telegram.org` (K and A versions) | Translate and Replace checked manually by the maintainer in desktop Chrome on Linux during development; automated tests against a real Tiptap/ProseMirror editor. |
| Instagram Direct | `www.instagram.com/direct/…` | Automated tests against simulated Instagram markup and a real Lexical editor. **Not yet verified in a signed-in session.** |
| Instagram floating chats | Chat panels opened over Reels, posts and profiles | Automated tests only. **Not yet verified in a signed-in session.** |

**Browser:** built for Google Chrome (Manifest V3) and checked only in desktop
Chrome. Other Chromium-based browsers may work but are untested; Firefox and
Safari are not supported.

### Current limitations

- Drafts that contain mentions, links, or other rich content can be translated and
  copied, but not replaced.
- MyMemory accepts at most 500 bytes per translation (about 250 Cyrillic
  characters), cannot detect the source language, and its quality varies.
- Instagram changes its page structure often; if the button does not appear, see
  [docs/manual-testing.md](docs/manual-testing.md) for a privacy-safe diagnostic.
- Only three languages so far.

## Screenshots

> Screenshots will be added before the first release. They must come from test
> accounts with no private conversations.

| Telegram Web | Translate panel | Instagram floating chat | Settings |
| --- | --- | --- | --- |
| *coming soon* | *coming soon* | *coming soon* | *coming soon* |

## Install

### From a GitHub release (beta)

Tilmo is not yet in the Chrome Web Store. To install a release build:

1. Download `tilmo-<version>-chrome.zip` from the
   [Releases page](https://github.com/SherzodToshpulatov/browser-translator/releases).
2. Unzip it into a folder you will keep (Chrome loads the extension from there).
3. Open `chrome://extensions` and turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder (the one containing
   `manifest.json`).
5. Optionally pin Tilmo from the puzzle-piece menu, then open Telegram Web or
   Instagram and click a message box.

Updates are not automatic: to update, replace the folder's contents with the
new release and click the reload icon on Tilmo's card in `chrome://extensions`.

### From source (developers)

Requirements: [Node.js](https://nodejs.org/) 26 (see `.nvmrc`) and npm.

```bash
git clone https://github.com/SherzodToshpulatov/browser-translator.git
cd browser-translator
npm ci
npm run build
```

Then load `.output/chrome-mv3` with **Load unpacked** as described above.

## Development

```bash
npm ci          # install exact dependency versions from the lockfile
npm run dev     # development build with live reload
```

`npm run dev` builds `.output/chrome-mv3-dev`; load it with **Load unpacked** if
WXT does not open a browser for you, and keep the command running while you use
that build.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development build with live reload |
| `npm run build` | Production build in `.output/chrome-mv3` |
| `npm run zip` | Production build packaged as `.output/tilmo-<version>-chrome.zip` |
| `npm run compile` | TypeScript type check |
| `npm test` | Unit tests (translation APIs are mocked) |
| `npm run test:live` | Optional: real MyMemory requests with fixed sample sentences |
| `npm run icons` | Regenerate `public/icon/*.png` from the brand SVG (needs local Chrome) |

See [CONTRIBUTING.md](CONTRIBUTING.md) for conventions and the pull request
process. Maintainers: the release process is in
[docs/release-checklist.md](docs/release-checklist.md), and the draft Chrome Web
Store listing in [docs/chrome-web-store.md](docs/chrome-web-store.md).

## Architecture

```text
Telegram / Instagram tab                         Extension service worker              Translator
┌──────────────────────────────┐   message    ┌──────────────────────────┐   HTTPS   ┌─────────────────────┐
│ content script               │ ───────────▶ │ background.ts            │ ────────▶ │ MyMemory (default)  │
│ • site adapter finds the     │              │ • reads settings         │           │ or your own server  │
│   message box                │ ◀─────────── │ • calls the selected     │ ◀──────── │ (apps/api → Google) │
│ • Shadow DOM panel (React)   │   result     │   translator             │           └─────────────────────┘
│ • Replace / Undo with checks │              └──────────────────────────┘
└──────────────────────────────┘                      ▲ popup.html: settings (chrome.storage)
```

| Path | Responsibility |
| --- | --- |
| `entrypoints/telegram.content.tsx`, `entrypoints/instagram.content.tsx` | Content scripts; each passes its site adapter to the shared controller |
| `src/adapters/telegram.ts`, `src/adapters/instagram.ts` | Find the message box, read plain-text drafts, and replace them safely |
| `src/content/floating-translator.tsx` | Shared controller: Shadow DOM host, positioning, translate → preview → Replace/Undo, navigation and draft-change protection |
| `src/components/TranslatePanel.tsx` | The floating button and translation panel |
| `src/core/draft-manager.ts` | Snapshot, replace and undo with change detection |
| `entrypoints/background.ts` | Receives translation requests and calls the selected translator; holds connection settings |
| `src/services/` | Translator implementations (`mymemory-translation.ts`, `remote-translation.ts`, demo) behind one interface |
| `entrypoints/popup/` | Settings popup |
| `apps/api/` | Optional self-hosted Cloudflare Worker for Google Cloud Translation |

More detail: [docs/site-integrations.md](docs/site-integrations.md).

## Translation providers

| Translator | Setup | Source language | Notes |
| --- | --- | --- | --- |
| **MyMemory (Free)** — default | None; optional contact email for a higher daily limit | Must be chosen | Third-party service by Translated srl. 500-byte limit per request. |
| **Google Cloud (your server)** | Deploy [`apps/api`](apps/api/README.md) to your Cloudflare account and add a Google Cloud API key | Auto-detect or chosen | You run and pay for this yourself; Tilmo has no hosted server. |
| **Demo (offline)** | None | Auto or chosen | Labelled placeholder output for trying the interface. |

## Privacy

Tilmo reads your draft only when you ask for a translation, and sends it to the
translator you selected — MyMemory by default, which is a third-party service
with its own terms. Tilmo has no servers of its own, stores settings but not
your drafts, includes no analytics, and never sends messages for you. Full
details, including exactly what each translator receives: [PRIVACY.md](PRIVACY.md).

## Roadmap

Ideas under consideration, not commitments:

- Verify and harden Instagram support in real signed-in sessions.
- Publish to the Chrome Web Store.
- More languages.
- Keep drafts out of request URLs where providers allow it (MyMemory currently
  uses GET requests).
- Support for more messaging websites.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md). Please report security problems privately
as described in [SECURITY.md](SECURITY.md). Changes are listed in
[CHANGELOG.md](CHANGELOG.md).

## License

Tilmo is released under the [MIT License](LICENSE). The extension package also
includes third-party open-source code; see
[public/THIRD_PARTY_NOTICES.txt](public/THIRD_PARTY_NOTICES.txt). Brand assets
are described in [docs/brand.md](docs/brand.md).
