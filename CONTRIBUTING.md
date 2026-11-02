# Contributing to Tilmo

Thanks for your interest in Tilmo! Bug reports, fixes, translations of the UI,
and support for new languages are all welcome. By participating you agree to
follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- For anything larger than a small fix, open an issue first so the approach can
  be discussed.
- Security problems must be reported privately — see [SECURITY.md](SECURITY.md).
- Tilmo handles private message drafts. Changes that alter what is read, sent,
  or stored need a clear justification and an update to [PRIVACY.md](PRIVACY.md).

## Set up a development environment

1. **Fork** the repository on GitHub, then clone your fork:

   ```bash
   git clone https://github.com/<your-username>/<your-fork>.git
   cd <your-fork>
   git remote add upstream https://github.com/SherzodToshpulatov/browser-translator.git
   ```

2. Install **Node.js 26** (the version in `.nvmrc`; with nvm: `nvm use`) and npm.
3. Install dependencies from the lockfile:

   ```bash
   npm ci
   ```

4. Start the development build:

   ```bash
   npm run dev
   ```

   Load `.output/chrome-mv3-dev` at `chrome://extensions` (Developer mode → **Load
   unpacked**) if WXT does not open a browser for you. Keep `npm run dev` running
   while using the dev build.

The optional Google Cloud backend has its own setup in
[apps/api/README.md](apps/api/README.md); you do not need it to work on the
extension.

## Create a feature branch

```bash
git fetch upstream
git switch -c fix/short-description upstream/main
```

Use a short, descriptive branch name, e.g. `fix/instagram-anchor` or
`feat/kazakh-language`. Keep each pull request focused on one change.

## Code style

- **TypeScript strict mode** is on. Avoid `any`; prefer precise types and type
  guards. `npm run compile` must pass.
- Match the surrounding code: 2-space indentation, single quotes, semicolons,
  small functions, and comments that explain *why* rather than *what*.
- Keep site-specific logic in `src/adapters/<site>.ts`; shared behaviour belongs
  in `src/content/floating-translator.tsx` and `src/core/`.
- UI lives in a Shadow DOM and uses the extension's own design tokens. Render
  text with React, never with `innerHTML`.
- **Privacy rules (required):**
  - Never log draft text, translations, or tokens (`console.*`), even in development.
  - Never store drafts or translations in `chrome.storage` or anywhere else on disk.
  - Read the draft only in response to an explicit user action.
  - Never send a message on the user's behalf.
  - Do not add permissions, host access, analytics, or remote code without discussion.
- Do not add runtime dependencies unless there is no reasonable alternative.

### Adding a language

Add it to `LANGUAGES` in `src/core/languages.ts` and, for the optional backend,
to `SUPPORTED_LANGUAGES` in `apps/api/wrangler.jsonc`. Check that MyMemory
supports the pair.

## Run the checks

```bash
npm run compile      # TypeScript
npm test             # unit tests (network calls are mocked)
npm run build        # production build in .output/chrome-mv3
```

Optional:

```bash
npm run test:live    # calls the real MyMemory API with fixed sample sentences
npm --prefix apps/api run typecheck && npm --prefix apps/api test   # backend
```

There is no linter configured yet; follow the style above.

Unit tests cannot sign in to Telegram or Instagram. If you change site detection
or replacement, also follow the relevant steps in
[docs/manual-testing.md](docs/manual-testing.md) with a test account, and
describe what you checked in your pull request.

## Submit a pull request

1. Commit with clear messages that explain the change.
2. Push your branch to your fork and open a pull request against `main`.
3. Fill in the pull request template: what changed, how you tested it,
   screenshots for UI changes, and any privacy or permission impact.
4. Make sure CI passes. A maintainer will review and may ask for changes.

## Reporting bugs

Use the **Bug report** issue template. A useful report includes:

- Tilmo version (from `chrome://extensions`) or commit.
- Browser and version, and operating system.
- The website and page (e.g. Telegram Web K, Instagram Direct, an Instagram
  floating chat over a Reel), and light or dark theme.
- The selected translator and languages.
- Steps to reproduce, what you expected, and what happened.
- Screenshots or console errors, **with private information removed**.

Never include private messages, chat screenshots with real content, access
tokens, or API keys in an issue.
