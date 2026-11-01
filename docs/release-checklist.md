# Release checklist

Use for every public release. Items marked ⚠ need a human with real browser
sessions or store access.

## Code and build

- [ ] `npm ci` (extension) and `npm ci --prefix apps/api` on a clean checkout.
- [ ] `npm run compile` — no TypeScript errors.
- [ ] `npm test` — all tests pass.
- [ ] `npm run test:live` — MyMemory still answers for uz↔en and ru↔en.
- [ ] `npm --prefix apps/api run typecheck` and `npm --prefix apps/api test` (if the backend is part of the release).
- [ ] Bump `version` in `package.json` (it becomes the manifest version) and update `PRIVACY.md` if data handling changed.
- [ ] `npm run build`, then inspect `.output/chrome-mv3/manifest.json`:
  - [ ] Only `storage` in `permissions`; content scripts limited to `web.telegram.org` and `www.instagram.com`; optional hosts unchanged.
  - [ ] No `localhost` defaults or dev-only code in the bundle: `grep -r "localhost:8787\|floating UI geometry" .output/chrome-mv3` finds nothing.
  - [ ] No `commands`, `tabs`, `scripting`, or `<all_urls>`.
- [ ] `npm run zip` and check the archive contains only the built extension.

## ⚠ Manual browser checks (Chrome stable, signed-in test accounts)

Use test accounts and conversations without private content.

- [ ] Fresh profile install: the popup defaults to MyMemory and translating works without setup.
- [ ] Telegram Web K and A, light and dark themes: button position, translate, Replace, Undo, Copy; the message is never sent.
- [ ] Telegram: switch chats during a pending translation — no stale preview, Replace refused.
- [ ] Instagram Direct (`/direct/t/…`), light and dark: same checks.
- [ ] Instagram floating chat panels over a Reel, a post, and a profile; two panels; minimize and close.
- [ ] Comment boxes, search fields and the Share dialog never show the button.
- [ ] Browser zoom 80%, 100%, 150% and a narrow window (~500 px): the panel stays on screen and does not cover Send.
- [ ] Errors: offline (DevTools → Network → Offline), MyMemory with a > 500-byte draft, an unchanged word such as a name.
- [ ] Keyboard: Tab to the button, Enter opens the panel with focus inside, Escape closes it. Screen reader announces "Translate message".
- [ ] Google Cloud provider (if supported in this release): save URL and token, permission prompt appears, translation works.

## ⚠ Store submission

- [ ] Privacy policy (`PRIVACY.md`) published at a stable public URL.
- [ ] Listing text, permission justifications and data disclosures from `docs/chrome-web-store.md`.
- [ ] Screenshots captured as specified there.
- [ ] A license chosen and added as `LICENSE` (the repository has none yet).
