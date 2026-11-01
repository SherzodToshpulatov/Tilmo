# Privacy

Browser Translator helps you translate a message draft before you send it on
Telegram Web or Instagram. Translating text requires sending it to a
translation service, so this document explains exactly what is read, where it
goes, and what is stored.

Last updated: 2026-11-01. This describes version 0.1.0.

## Summary

- The extension reads your draft **only when you press Translate**.
- The draft is sent to **the translation provider you selected** — by default
  MyMemory, a third-party service. It is not end-to-end encrypted to the
  provider, and the provider processes it under its own terms.
- The extension does **not** store drafts or translations, read chat history or
  received messages, send messages for you, or include analytics or telemetry.

## What the extension reads

On `web.telegram.org` and `www.instagram.com`, content scripts look for the
message box you are typing in. To find it they inspect element types, roles and
labels, and they read background colours to match the page's light or dark
theme. They do not read message text while doing this.

The text of your draft is read only when you press **Translate** in the
extension's panel. Only the focused message box is read — never other fields,
chat history, or messages you received.

## Where your text goes

| Translator (popup setting) | Recipient | How |
| --- | --- | --- |
| **MyMemory (Free)** — default | MyMemory, operated by Translated srl (`api.mymemory.translated.net`) | HTTPS GET request. The draft and language pair are part of the request URL, which servers commonly record in logs. If you enter a contact email, it is sent too (as `de`). |
| **Google Cloud (your server)** | The Browser Translator server you deploy (`apps/api`), which forwards the text to Google Cloud Translation | HTTPS POST with your access token. The server code in this repository does not log or store text; Google processes it under the Google Cloud terms of your project. |
| **Demo (offline, not real)** | Nobody | Placeholder output is produced locally. |

Requests are made by the extension's background service worker, not by the
Telegram or Instagram pages, and without cookies.

How MyMemory or Google handle, retain, or use submitted text is governed by
their own terms and privacy policies, which this extension cannot control.
Review them before translating sensitive content:

- MyMemory: <https://mymemory.translated.net/>
- Google Cloud Translation: <https://cloud.google.com/translate/data-usage>

Do not translate passwords, codes, or other secrets.

## What is stored

| Data | Where | Why |
| --- | --- | --- |
| Source and target language | `chrome.storage.sync` (synced by your browser if sync is on) | Remember your languages |
| Selected translator, MyMemory contact email, server URL, access token | `chrome.storage.local` (this browser only, not encrypted) | Connect to the translator you chose |
| The most recent translation for the open tab | Memory only | Avoid sending the same draft twice; cleared on navigation, reload, or tab close |

Drafts and translations are never written to storage. The extension writes to
your clipboard only when you press **Copy**.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Save the settings listed above |
| Access to `web.telegram.org` and `www.instagram.com` | Show the Translate controls next to the message box and replace the draft when you press Replace |
| Optional access to your server's address | Requested only if you choose the Google Cloud translator, for the server URL you enter |

MyMemory accepts requests from any website, so it needs no extra permission.

## What the extension does not do

- Send messages: Replace only changes the draft; you always press Send yourself.
- Read chat history, received messages, or other fields.
- Collect analytics, usage statistics, or crash reports.
- Load or run remote code.
- Sell or share data, apart from sending your draft to the provider you chose
  when you press Translate.

## Contact

Questions or concerns: open an issue in this project's GitHub repository.
