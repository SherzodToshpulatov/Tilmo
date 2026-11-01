# Browser Translator

An in-browser translation assistant built with WXT, React, and TypeScript. It
translates your message draft in place on Telegram Web and Instagram Direct,
inspired by Gboard Translate.

## Supported sites

| Site | URLs | Composer |
| --- | --- | --- |
| Telegram Web (K and A) | `https://web.telegram.org/*` | Tiptap/ProseMirror or plain editor |
| Instagram Direct | `https://www.instagram.com/direct/*` (inbox and conversations) | Lexical editor or textarea |

## Telegram Web

The Telegram Web content script detects the message composer and shows a
floating **Translate** button with source and target language menus (Oʻzbekcha,
English, Русский). Translators that can detect languages also offer **Auto** as
the source. Press **Translate** or `Ctrl+Shift+Y` to preview a translation, then
**Replace** the draft, **Undo** it, or **Copy** the text.

## Instagram Direct

Open a conversation at `https://www.instagram.com/direct/…`, type a message,
and the same **Translate** controls appear above the message bar (they never
cover the emoji, attachment or Send buttons). Press **Translate** or
`Ctrl+Shift+Y` (`Command+Shift+Y` on macOS), check the preview, press
**Replace**, and send the message yourself. **Undo** restores your draft.

The content script is injected on all `www.instagram.com` pages because
Instagram navigates without reloading, but it does nothing outside `/direct/`
routes. Only the focused conversation composer is used — never search, comment,
caption, note, group-name, or share/forward dialog fields.

How replacement works: the composer is Instagram's Lexical editor (or a
textarea on older layouts). The extension selects the draft and uses the
browser's own `insertText` editing command for a single line, or a plain-text
paste for several lines, so Instagram's editor updates its own state. It then
reads the composer back; if the text did not stick exactly, the original draft is
put back and only **Copy** is offered. A draft that contains anything besides
plain text, emoji and line breaks (mentions, links, stickers, unknown
structure) is never overwritten — use **Copy**.

Privacy: only the active draft is read, and only after you press Translate or
the shortcut. Chat history and received messages are never read, nothing is
stored, and Instagram's network requests and private APIs are not touched.

Known limitations:

- Tested against a real Lexical editor and simulated Instagram markup, not yet
  in a signed-in Instagram session. Instagram changes its DOM often; if the
  button does not appear or Replace stays unavailable, use Copy and report the
  DOM structure (see the checklist below).
- The mini chat window that opens over other Instagram pages is not supported;
  open the conversation at `/direct/`.
- The panel follows the system light/dark preference, which can differ from
  Instagram's own theme setting.

## Translators

Choose one in the extension popup:

| Translator | Setup | Source language | Limits |
| --- | --- | --- | --- |
| **MyMemory (Free)** | none; optional contact email | must be chosen (no auto-detect) | 500 bytes per translation; free daily allowance, higher with an email |
| **Google Cloud (your server)** | deploy `apps/api`, add URL + access token | Auto or chosen | set by your Worker and Google quotas |
| **Demo (offline, not real)** | none | Auto or chosen | labelled demo output, for development |

**MyMemory** ([api.mymemory.translated.net](https://mymemory.translated.net/doc/spec.php))
is called directly from the extension's background service worker with a GET
request: no API key, no account, and no extra host permission (the API allows
any origin). Notes:

- Drafts go to MyMemory (Translated srl) only when you press Translate. Read
  their terms before translating sensitive text.
- Drafts over 500 UTF-8 bytes are refused before sending (about 500 Latin or
  250 Cyrillic characters; emoji count as 4 bytes).
- The optional contact email is sent as MyMemory's `de` parameter for the
  higher daily allowance described in their
  [usage limits](https://mymemory.translated.net/doc/usagelimits.php). It is stored
  only in this browser.
- MyMemory reports errors inside normal-looking responses. The extension checks
  `responseStatus` and shows a clear message for unsupported language pairs,
  exhausted quota, empty results, or text returned unchanged — never the error
  text as a translation.
- Results can come from MyMemory's translation memory, so quality varies.

- Text leaves the browser only when you press Translate or the shortcut.
- Replace is offered only for plain-text drafts. Drafts with links, mentions or
  formatting can be copied but are never overwritten.
- If the draft changes or you switch chats while a translation is pending,
  Replace and Undo are refused.
- The extension never sends a Telegram message.

`Ctrl+Shift+Y` becomes `Command+Shift+Y` on macOS. If it conflicts with
another extension, change it at `chrome://extensions/shortcuts`.

## Architecture

```text
Telegram tab                    Extension service worker          Cloudflare Worker (apps/api)       Google
content script ── message ──▶   background.ts            ─HTTPS─▶ POST /v1/translate        ──────▶  Cloud Translation
(reads draft, shows preview)    (holds URL + access token)        auth → rate limit → validate        Basic (v2)
                                                                  → monthly budget (Durable Object)
```

- `src/services/translation.ts` – provider-independent `TranslationService`
  interface, error codes, and the offline `mockTranslationService`.
- `src/services/remote-translation.ts` – `RemoteTranslationService`, the HTTP
  client for the Worker. Used only by the background service worker.
- `src/services/mymemory-translation.ts` – `MyMemoryTranslationService`, which
  calls MyMemory directly. `src/services/providers.ts` lists the translators and
  whether each supports auto-detection.
- `entrypoints/background.ts` – receives translate requests from the content
  script, reads settings, and calls the selected translator. The content script
  never sees the access token.
- `src/content/floating-translator.tsx` – the shared floating controls: Shadow
  DOM host, positioning, translate/Replace/Undo flow, navigation and
  draft-change protection. Each site's content script
  (`entrypoints/telegram.content.tsx`, `entrypoints/instagram.content.tsx`)
  passes in its editor adapter and composer finders.
- `src/adapters/telegram.ts`, `src/adapters/instagram.ts` – site-specific
  `MessageEditorAdapter`s (detection, plain-text reading, safe replacement), with
  shared helpers in `src/adapters/editor-utils.ts`.
- `entrypoints/popup` – settings: translator, server URL, access token.
- `apps/api` – the Cloudflare Worker. `providers/google.ts` implements
  `GoogleCloudTranslationProvider`; other providers can implement the same
  `TranslationProvider` interface without touching the extension.

The Google API key exists only as a Worker secret. It is never in the extension,
in frontend environment variables, or in git.

### Adding a language

Add it to `LANGUAGES` in `src/core/languages.ts` and to `SUPPORTED_LANGUAGES` in
`apps/api/wrangler.jsonc`.

## API

`POST /v1/translate` with `Authorization: Bearer <access token>`:

```json
{ "text": "Salom, yaxshimisan?", "source": "auto", "target": "en" }
```

```json
{ "translatedText": "Hello, how are you?", "detectedSourceLanguage": "uz", "provider": "google" }
```

Errors are always `{ "error": { "code": "...", "message": "..." } }`:

| Status | Codes |
| --- | --- |
| 400 | `invalid_json`, `invalid_request`, `empty_text`, `unsupported_language` |
| 401 | `unauthorized` |
| 413 | `payload_too_large`, `text_too_long` |
| 415 | `unsupported_media_type` |
| 429 | `rate_limited` (per token), `quota_exceeded` (monthly budget) |
| 502 / 503 / 504 | `provider_error`, `provider_rate_limited`, `provider_timeout` |
| 500 | `server_misconfigured`, `internal_error` |

`GET /v1/health` returns `{ "status": "ok" }` without authentication.

## Security and cost controls

This is a **private developer MVP**. The Worker is not an open translation proxy:

1. **Access tokens.** Every request needs a bearer token. The Worker stores only
   SHA-256 hashes of allowed tokens (`API_ACCESS_TOKEN_HASHES`), compares them in
   constant time, and fails closed if none are configured. Each tester gets their
   own token and pastes it into the popup; nothing secret ships in the extension.
   CORS and the extension ID are *not* used as authentication.
2. **Throttling.** A Cloudflare Rate Limiting binding allows 20 requests per
   minute per token (`wrangler.jsonc` → `ratelimits`). It is approximate and
   enforced per Cloudflare location, so it limits bursts, not spending.
3. **Monthly character budget.** A single SQLite-backed Durable Object reserves
   characters before every Google call and refuses requests once
   `MONTHLY_CHARACTER_LIMIT` (default 400,000) is reached for the UTC month.
   Durable Objects handle requests one at a time, so this cap is strict for this
   Worker. Characters are returned when Google rejects a request, but kept when it
   times out (it may still have been billed). Counting uses UTF-16 length, which
   is never less than Google's character count.
4. **Input limits.** JSON only, at most `MAX_BODY_BYTES` (16 KiB) read from the
   body, at most `MAX_TEXT_CHARS` (2,000) characters, supported languages only,
   well-formed Unicode only, and an 8 s timeout on Google calls.
5. **No sensitive logging.** The Worker logs only error kinds and HTTP statuses —
   never message text, tokens, or Google response bodies. Responses carry
   `Cache-Control: no-store`.
6. **Google-side limits (strongly recommended).** The Worker budget does not
   replace Google's own controls: set a daily character quota on the Cloud
   Translation API and a billing budget with alerts (see setup below). Budgets
   only alert; they do not stop charges.

### Before a public release

A shared-token model does not work for a public extension: anything shipped in
the extension can be extracted. A public version needs per-user identity (for
example Google sign-in via `chrome.identity`, exchanged for short-lived tokens
issued by the Worker), per-user quotas keyed by that identity in the Durable
Object, abuse monitoring, and a privacy policy. Rotate any MVP tokens at that point.

## Setup

### 1. Google Cloud

1. In the [Google Cloud console](https://console.cloud.google.com/), create or
   select a project and link a billing account. Cloud Translation requires
   billing even within the free tier; check the current
   [pricing](https://cloud.google.com/translate/pricing) before enabling it.
2. Enable the **Cloud Translation API**: *APIs & Services → Library → Cloud
   Translation API → Enable* (or `gcloud services enable translate.googleapis.com`).
3. Create an API key: *APIs & Services → Credentials → Create credentials → API
   key*. Edit it and under **API restrictions** choose *Restrict key → Cloud
   Translation API*. Leave application restrictions unset; Workers have no fixed
   egress IP. Keep the key private.
4. Limit usage: *APIs & Services → Cloud Translation API → Quotas & system
   limits*, and lower the per-day character quota to what you are willing to pay
   for.
5. Add a budget: *Billing → Budgets & alerts → Create budget*, with email alerts
   at e.g. 50%, 90%, and 100%.

### 2. Backend (local)

```bash
cd apps/api
npm install
cp .dev.vars.example .dev.vars
npm run token:create        # prints a new access token and its hash
```

Edit `.dev.vars` (git-ignored): set `GOOGLE_TRANSLATE_API_KEY` to your key and
`API_ACCESS_TOKEN_HASHES` to the printed hash. Then:

```bash
npm run dev                 # http://localhost:8787
```

Requests to the local server call the real Google API and count toward billing.

### 3. Extension

```bash
npm install
npm run dev                 # loads .output/chrome-mv3-dev
```

Load `.output/chrome-mv3-dev` at `chrome://extensions` (Developer mode → *Load
unpacked*) if WXT did not open a browser for you. Keep `npm run dev` running
while you use the dev build; it connects to the dev server on port 3000.

Open the extension popup, choose **Google Cloud (your server)**, enter
`http://localhost:8787` and the access token, press **Save**, and allow access
to the server when Chrome asks. Choose **Demo (offline, not real)** to try the
UI without a server; demo results are labelled as such.

### 4. Deploy the Worker

```bash
cd apps/api
npx wrangler login
npx wrangler secret put GOOGLE_TRANSLATE_API_KEY
npx wrangler secret put API_ACCESS_TOKEN_HASHES   # comma-separated hashes
npm run deploy
```

Put the deployed `https://<name>.<subdomain>.workers.dev` URL into the popup.
Adjust limits in `wrangler.jsonc` → `vars` and `ratelimits`, then redeploy.
To revoke a tester, remove their hash from `API_ACCESS_TOKEN_HASHES`.

## Testing

```bash
npm run compile             # extension type check
npm test                    # extension unit tests (offline; MyMemory is mocked)
npm run test:live           # optional: real MyMemory calls with fixed sample sentences
npm run build               # production build in .output/chrome-mv3

cd apps/api
npm run typecheck
npm test                    # Worker tests; Google is mocked, no paid requests
```

Manual check against a running backend:

```bash
curl -s http://localhost:8787/v1/translate \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $TOKEN" \
  -d '{"text":"Salom, yaxshimisan?","source":"auto","target":"en"}'
```

In Telegram Web: type a draft, pick a target language, press **Translate**,
check the detected language and preview, press **Replace**, then **Undo**. Send
the message yourself.

### Manual checklist: Instagram Direct

1. `npm run build`, reload the extension at `chrome://extensions`, then reload
   the Instagram tab.
2. Open `https://www.instagram.com/direct/inbox/` and pick a conversation.
3. Click the message box and type `Salom, yaxshimisan?`. The controls appear
   above the message bar without covering Send, emoji, or attachment buttons.
4. Choose a source (Oʻzbekcha for MyMemory) and target, press **Translate**:
   a preview appears and the message is **not** sent.
5. Press **Replace**: the message box shows the translation. Type one letter to
   check Instagram still accepts input, delete it, then press **Undo**.
6. Repeat with `Ctrl+Shift+Y`, a two-line draft (Shift+Enter), and emoji.
7. Edit the draft after pressing Translate, then press Replace: it is refused.
8. Press Translate, then switch to another conversation before it finishes: no
   stale preview appears in the new conversation.
9. Click the Instagram search box, a post's comment field, and the
   share/forward dialog: no Translate controls appear.
10. Open the home feed or a profile: no controls appear.

If the controls do not appear or Replace is unavailable for plain text, run this
in DevTools on the conversation (it prints structure and text lengths only):

```js
(function () {
  var ed = document.activeElement;
  var out = [];
  (function walk(n, d) {
    var pad = new Array(d + 1).join('  ');
    if (n.nodeType === 3) { out.push(pad + '#text len=' + n.data.length); return; }
    if (n.nodeType !== 1) return;
    out.push(pad + '<' + n.tagName.toLowerCase() + '> attrs=[' + n.getAttributeNames().join(',') + ']');
    for (var i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i], d + 1);
  })(ed, 0);
  console.log(out.join('\n'));
})();
```

Run `npm run cf-typegen` in `apps/api` after changing `wrangler.jsonc` bindings
or vars.
