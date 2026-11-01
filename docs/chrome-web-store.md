# Chrome Web Store listing (draft)

Prepared for a future submission. Nothing here has been submitted, and no
developer account has been registered.

## Listing

**Name:** Tilmo

**Summary** (132 characters max):

> Translate where you type: translate your drafts on Telegram Web and Instagram before you send them. Preview, replace, undo.

**Category:** Productivity (alternative: Communication)

**Language:** English

**Description:**

> Write in one language, send in another — without leaving the chat.
>
> Tilmo adds a small Translate button next to the message box on
> Telegram Web and Instagram Direct (including the chat panels that open over
> Reels, posts and profiles).
>
> • Press Translate to preview a translation of your draft.
> • Choose the languages: Uzbek, English and Russian.
> • Replace your draft with the translation, or copy it. Undo restores your text.
> • You always press Send yourself — the extension never sends messages.
>
> Translators:
> • MyMemory (free, no account needed) — the default.
> • Google Cloud Translation through your own server (advanced, see the project README).
>
> Privacy: your draft is read only when you press Translate and is sent to the
> translator you chose. Drafts are not stored, and there are no analytics.
> MyMemory is a third-party service that processes text under its own terms.
> Do not translate secrets. Full details: <privacy policy URL>.
>
> Open source: <repository URL>

## Single purpose

Translate the message the user is writing on supported messaging websites,
in place, after the user asks for it.

## Permission justifications

| Permission | Justification |
| --- | --- |
| `storage` | Saves the user's chosen translator, languages, and optional connection settings. |
| Host access: `https://web.telegram.org/*` | Content script shows the Translate button next to the Telegram Web message box and replaces the draft when the user presses Replace. |
| Host access: `https://www.instagram.com/*` | Same, for Instagram Direct and Instagram's floating chat panels, which can open on any Instagram page. |
| Optional host access: `https://*/*`, `http://localhost/*`, `http://127.0.0.1/*` | Requested at runtime only for the single server URL the user enters when choosing the self-hosted Google Cloud translator. Not requested for the default MyMemory translator. |

**Remote code:** No. All code is bundled in the package.

## Data usage disclosures

For the "Privacy practices" tab (answer from `PRIVACY.md`):

- **Data handled:** Personal communications (the draft the user asks to translate).
  The optional MyMemory contact email the user may enter (personally identifiable information).
- **Purpose:** Core functionality only — translating the user's draft.
- **Transfer:** Sent to the translation provider the user selected (MyMemory by
  default) when the user presses Translate. Not sold, not used for advertising,
  creditworthiness, or unrelated purposes.
- **Storage:** Drafts are not stored. Settings are kept in `chrome.storage`.
- **Privacy policy URL:** host `PRIVACY.md` at a stable public URL (for example the
  GitHub file view or a GitHub Pages page) before submitting.

## Assets

| Asset | Status | Specification |
| --- | --- | --- |
| Store icon | Done: `public/icon/128.png` | 128×128 PNG, 96×96 artwork with 16 px transparent padding. Source: `assets/brand/tilmo-icon-dark.svg`, rendered with `npm run icons`. |
| Toolbar/extension icons | Done: `public/icon/{16,32,48,96}.png` | Same source; thicker strokes at 16 and 32 px. |
| Screenshots | **Needed** | 1–5 images, 1280×800 (or 640×400) PNG/JPEG. Capture from real signed-in sessions with **test accounts and non-private conversations**: (1) Telegram Web with the Translate button next to the composer, (2) the open panel with a preview, (3) Instagram Direct after Replace showing Undo, (4) a floating Instagram chat panel over a Reel, (5) the settings popup. Blur names and avatars. |
| Small promo tile | Optional, needed for featuring | 440×280 PNG/JPEG. `tilmo-wordmark.svg` on navy `#0F172A` (light variant) with the tagline "Translate where you type." |
| Marquee promo tile | Optional | 1400×560 PNG/JPEG. |

No branded artwork beyond the icon has been produced; screenshots must come from
real sessions so they reflect the product accurately.
