<p align="center">
  <img src="OutlookAutoAuth-Extension/icons/icon128.png" width="96" alt="SP Auto Auth">
</p>

<h1 align="center">SP Auto Auth</h1>

<p align="center">
  <em>Open Outlook. Walk away. Come back signed in.</em>
</p>

<p align="center">
  <a href="https://github.com/chonghaoooi/SP-Auto-Authentication/releases/latest"><img src="https://img.shields.io/badge/release-v1.0-0078d4?style=flat-square" alt="Release"></a>
  <img src="https://img.shields.io/badge/platform-Chrome%20%2F%20Edge-0078d4?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/manifest-v3-0078d4?style=flat-square" alt="Manifest v3">
  <img src="https://img.shields.io/badge/license-MIT-0078d4?style=flat-square" alt="MIT">
</p>

<p align="center">
  <strong>Auto-fills email · password · 2FA code · stay signed in</strong>
</p>

---

Microsoft login has four screens. Every time. This extension handles all four — silently, instantly, every time you open Outlook or Teams in your browser.

## Install

1. Download **SP-Auto-Auth-v1.0.zip** from the [latest release](https://github.com/chonghaoooi/SP-Auto-Authentication/releases/latest) and extract it
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle, top right)
4. Click **Load unpacked** → select the `OutlookAutoAuth-Extension` folder
5. Click the lock icon in your toolbar and enter your details

## Setup

Click the extension icon and fill in three fields:

| Field | What to enter |
|---|---|
| **SP Email** | Your school Microsoft email |
| **Password** | Your Microsoft password |
| **Authenticator Secret Key** | The secret from your MFA setup (see below) |

Hit **Save Settings**. Done.

## Finding your secret key

When setting up Microsoft Authenticator, choose **"I want to use a different authenticator app"**. A QR code appears — click **"Can't scan image?"** to reveal the secret key (a string of letters and numbers). That's what goes in the field above.

> Already set up and don't have the key? Ask IT to reset your MFA so you can re-enrol and capture it.

## How it works

Every 30 seconds, your authenticator secret + the current time are fed into HMAC-SHA1. The result is carved down to 6 digits. Microsoft runs the same math on their end — matching codes = you're in.

The extension watches for Microsoft login pages and handles each screen automatically:

```
Email field detected     → fills your email → submits
Password field detected  → fills password   → submits
Push notification screen → clicks "I can't use Authenticator right now"
TOTP field detected      → generates 6-digit code → submits
"Stay signed in?" prompt → clicks Yes
```

A MutationObserver catches SPA-style transitions where the URL doesn't change, so it works even when Microsoft updates the page without a full reload.

## Privacy

- All credentials stored locally via `chrome.storage.local`
- Nothing is sent to any server
- No analytics, no tracking

## FAQ

**Does it work for both Outlook and Teams?**
Yes. Any page on `login.microsoftonline.com` or `login.microsoft.com`.

**What if I don't have my secret key?**
The extension won't work without it. You need to capture it during MFA enrolment.

**Does it work if my browser already autofills the password?**
Yes — if no password is saved in the extension, it waits for the browser to autofill and then submits.

**Is it safe to store my password in the extension?**
It is stored in Chrome's local extension storage, which is sandboxed to this extension only. It never leaves your device.

## License

[MIT](LICENSE)
