# Security policy

Tilmo handles the text people type into messaging websites, so security reports
are taken seriously. Thank you for helping keep users safe.

## Supported versions

Tilmo is in beta. Security fixes are made on the `main` branch and released in
the next version; only the latest release is supported.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Report them privately instead, using either:

1. **GitHub private vulnerability reporting** — on the repository's **Security**
   tab, choose **Report a vulnerability**. *(Maintainer: enable this under
   Settings → Code security → Private vulnerability reporting.)*
2. **Email:** **to5hpulatov@yandex.ru**

You should receive an acknowledgement within a few days. Please give the
maintainers a reasonable time to fix the problem before disclosing it publicly.

## What to include

- A description of the issue and its impact (for example: draft text sent
  somewhere unexpected, a message sent without the user's action, script
  injection through a translation, a leaked access token).
- The affected version or commit, browser and operating system.
- Clear steps to reproduce, ideally with a minimal proof of concept.
- Any suggested fix or mitigation.

## What not to share

In reports — private or public — and in any proof of concept:

- Do not include real private messages, chat screenshots, or personal data.
  Use test accounts and made-up text.
- Do not include working credentials: Google Cloud API keys, Tilmo server access
  tokens, Chrome Web Store or GitHub tokens, or extension signing keys (`.pem`).
  If you find a leaked secret, report where it is rather than copying it.
- Do not test against other people's accounts or conversations.

## Scope

In scope: the extension in this repository (content scripts, background service
worker, popup) and the optional backend in `apps/api`.

Out of scope: vulnerabilities in Telegram, Instagram, MyMemory, Google Cloud, or
Cloudflare themselves — please report those to the respective vendor — and
issues that require an already compromised browser or computer.
