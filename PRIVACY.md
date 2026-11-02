# Privacy

Tilmo is a browser extension that translates a message draft before you send it
on Telegram Web or Instagram. Translating text means sending it to a translation
service, so this document describes exactly what Tilmo reads, what it sends and
to whom, and what it stores. It is based on the source code of version 0.1.0.

Last updated: 2026-11-02.

## In short

- Tilmo reads your draft **only when you ask it to translate**.
- The draft is sent to **the translation provider you selected** — by default
  MyMemory, a third-party service. Tilmo does not operate any server and does not
  receive your text itself.
- What the provider does with the text is governed by **the provider's** terms,
  not by Tilmo. Translations are not end-to-end encrypted to the provider.
- Tilmo stores your settings, but not your drafts or translations. It contains
  no analytics or telemetry, and it never sends messages for you.

## What Tilmo processes in your browser

Everything in this section happens locally, inside the extension.

**Finding the message box.** On `web.telegram.org` and `www.instagram.com`,
Tilmo's content scripts check the element you are typing in (its type, role and
labels, and nearby page structure) to decide whether it is a message box, and
read background colours to match the page's light or dark theme. They do not
read message text to do this, and they never read chat history or messages you
received.

**Reading your draft.** The text of the focused message box is read when you
press the Translate button, press **Try again**, or change a language in the open
Translate panel. Only that message box is read.

**Replacing your draft.** When you press **Replace**, Tilmo writes the
translation into the message box and checks that it was accepted. **Undo** puts
your original draft back. Tilmo never presses Send.

**Clipboard.** Tilmo writes the translation to your clipboard only when you press
**Copy**. It never reads your clipboard.

## What is sent, and to whom

Requests are made by the extension's background service worker over HTTPS,
without cookies. Like any web request, they reveal your IP address and browser
user agent to the recipient, and an `Origin` header that identifies the
extension.

| Translator (popup setting) | Recipient | Data sent |
| --- | --- | --- |
| **MyMemory (Free)** — default | MyMemory, a service of Translated srl (`api.mymemory.translated.net`) | Your draft, the source and target language codes, and — only if you entered one — your contact email. Sent as a GET request, so the draft is part of the request URL, which servers commonly record in logs. |
| **Google Cloud (your server)** — optional | A server **you** deploy from `apps/api` (not operated by Tilmo), which forwards the text to Google Cloud Translation | Your draft, the language codes and your access token are sent to your server. The server forwards the draft, the target language and (unless auto-detecting) the source language to Google, using your Google Cloud project. The server code in this repository logs only error types and status codes, never text. |
| **Demo (offline, not real)** | Nobody | Nothing leaves your browser. |

### Data processed by the provider

Once text reaches MyMemory or Google, its handling — including whether it is
logged, stored, or used to improve their services — is governed by that
provider's terms and privacy policy. Tilmo cannot control or verify it. Review
them before translating anything sensitive:

- MyMemory (Translated): <https://mymemory.translated.net/>
- Google Cloud Translation: <https://cloud.google.com/translate/data-usage>

Do not translate passwords, one-time codes, or other secrets.

## What Tilmo stores

| Data | Where | Shared |
| --- | --- | --- |
| Source and target language | `chrome.storage.sync` | Synced to your other browsers by your browser's sync, if enabled |
| Selected translator; MyMemory contact email; server URL and access token (Google Cloud option) | `chrome.storage.local` | This browser profile only. Not encrypted by Tilmo. |
| The most recent translation in the open tab | Memory only | Never written to disk; discarded on navigation, reload, or closing the tab |

Drafts and translations are never written to storage. Removing the extension
deletes its stored settings.

## What Tilmo does not do

- Operate servers, or receive your text or settings itself.
- Collect analytics, usage statistics, crash reports, or other telemetry.
- Read chat history, received messages, or fields other than the focused message box.
- Send messages, or modify Telegram's or Instagram's network requests.
- Load or execute remote code.
- Sell or share data. Your draft goes only to the provider you selected, when you ask for a translation.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Save the settings listed above. |
| Access to `https://web.telegram.org/*` and `https://www.instagram.com/*` | Run the content scripts that show the Translate button next to the message box and replace the draft when you press Replace. |
| Optional access to your server's address | Requested only when you choose the Google Cloud translator, for the one server URL you enter. |

MyMemory accepts requests from any origin, so it needs no host permission.

## Changes and contact

Changes to data handling will be recorded in this file and in
[CHANGELOG.md](CHANGELOG.md). For questions, open an issue in the project's GitHub
repository. Report security problems privately as described in
[SECURITY.md](SECURITY.md).
