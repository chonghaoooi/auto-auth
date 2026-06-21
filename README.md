<p align="center">
  <img src="OutlookAutoAuth-Extension/icons/auto-auth-128.png" width="96" alt="Auto Auth secure automatic sign-in icon">
</p>

<h1 align="center">Auto Auth</h1>

<p align="center">
  <em>Automatic Microsoft sign-in and GitHub TOTP completion for Chrome and Edge.</em>
</p>

<p align="center">
  <a href="https://github.com/chonghaoooi/auto-auth/releases/latest"><img src="https://img.shields.io/github/v/release/chonghaoooi/auto-auth?style=flat-square&color=0078d4" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/platform-Chrome%20%2F%20Edge-0078d4?style=flat-square" alt="Chrome and Edge">
  <img src="https://img.shields.io/badge/manifest-v3-0078d4?style=flat-square" alt="Manifest v3">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-0078d4?style=flat-square" alt="MIT license"></a>
  <img src="https://visitor-badge.laobi.icu/badge?page_id=chonghaoooi.auto-auth&left_color=%23555555&right_color=%230078d4&left_text=views" alt="Views">
</p>

Auto Auth is a local-only browser extension that completes Microsoft sign-in flows and GitHub authenticator-code prompts. It can fill your Microsoft email, password, TOTP code, and “Stay signed in?” prompt, plus generate a separate TOTP code for GitHub two-factor authentication.

## Features

- Microsoft sign-in automation for Outlook and Teams
- GitHub TOTP two-factor code completion
- Separate Microsoft and GitHub authenticator secrets
- Manifest V3 support for Chrome and Edge
- Credentials remain in `chrome.storage.local`; no analytics or external service
- TypeScript source with reproducible compiled extension files

## Install

1. Download **Auto-Auth-v2.0.0.zip** from the [latest release](https://github.com/chonghaoooi/auto-auth/releases/latest).
2. Extract the archive.
3. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
4. Enable **Developer mode**.
5. Select **Load unpacked** and choose the extracted `OutlookAutoAuth-Extension` folder.
6. Open the Auto Auth extension and save your settings.

## Configure

| Field | Purpose | Required |
|---|---|---|
| **Microsoft Email** | Microsoft account email | Yes for Microsoft automation |
| **Password** | Microsoft account password | Optional; browser autofill can provide it |
| **Microsoft Authenticator Secret Key** | Generates Microsoft TOTP codes | Yes for Microsoft automation |
| **GitHub Authenticator Secret Key** | Generates GitHub TOTP codes | Optional |

Authenticator apps expose a secret key during TOTP setup. For Microsoft, choose **I want to use a different authenticator app**, then **Can't scan image?**. For GitHub, open **Settings → Password and authentication → Two-factor authentication** and use the setup key shown during authenticator configuration.

> Treat authenticator secrets like passwords. Anyone with a secret can generate valid codes. If you no longer have the original setup key, reset that account's authenticator configuration and enrol it again.

## How it works

Every 30 seconds, Auto Auth derives a six-digit TOTP code from the saved secret and current time using HMAC-SHA1. The extension watches supported sign-in pages and reacts to page transitions, including single-page application updates that do not reload the URL.

Microsoft flow:

```text
Email field        → fills email → submits
Password field     → fills saved or browser-provided password → submits
Authenticator push → switches to verification-code entry
TOTP field         → generates code → submits
Stay signed in?    → confirms
```

GitHub flow:

```text
Two-factor page → generates the GitHub TOTP code → submits
```

## Development

Requirements: Node.js and npm.

```bash
npm ci
npm run build
```

Edit the TypeScript files under `src/`. The build compiles them into `OutlookAutoAuth-Extension/`, which is the directory loaded by the browser.

## Privacy and security

- Auto Auth does not send credentials, secrets, or usage data to a project-controlled server.
- Settings are stored in the browser profile through `chrome.storage.local`.
- Local extension storage is not a password manager or hardware-backed secret store. Protect your operating-system account and browser profile.
- Review the source and requested site access before installing any unpacked extension that handles credentials.

## License

[MIT](LICENSE)
