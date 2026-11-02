# Tilmo backend (optional)

A Cloudflare Worker that lets the Tilmo extension use **Google Cloud
Translation** without putting a Google API key in the extension. It is only
needed for the optional "Google Cloud (your server)" translator; the default
MyMemory translator does not use it. You deploy and operate it yourself — there
is no Tilmo-hosted server.

```text
Telegram tab                    Extension service worker          Cloudflare Worker (apps/api)       Google
content script ── message ──▶   background.ts            ─HTTPS─▶ POST /v1/translate        ──────▶  Cloud Translation
(reads draft, shows preview)    (holds URL + access token)        auth → rate limit → validate        Basic (v2)
                                                                  → monthly budget (Durable Object)
```

The Worker keeps the Google API key as a secret, requires an access token,
rate-limits each token, and enforces a monthly character budget.

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

### 1. Google Cloud project

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

### 2. Run the backend locally

```bash
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

### 3. Deploy the Worker

```bash
npx wrangler login
npx wrangler secret put GOOGLE_TRANSLATE_API_KEY
npx wrangler secret put API_ACCESS_TOKEN_HASHES   # comma-separated hashes
npm run deploy
```

Put the deployed `https://<name>.<subdomain>.workers.dev` URL into the popup.
Adjust limits in `wrangler.jsonc` → `vars` and `ratelimits`, then redeploy.
To revoke a tester, remove their hash from `API_ACCESS_TOKEN_HASHES`.

### 4. Connect the extension

Open the Tilmo popup, choose **Google Cloud (your server)**, enter the Worker URL
(`http://localhost:8787` locally) and your access token, press **Save**, and allow
access to the server when Chrome asks.

## Testing

```bash
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

Run `npm run cf-typegen` after changing `wrangler.jsonc` bindings or vars.
