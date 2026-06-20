// Auto-fills Microsoft login pages for SP Outlook / Teams
// Settings (email, password, secret) loaded from chrome.storage.local

const DELAY_MS = 250;

let busy = false;
let pendingRun = false;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fill(el, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, "value"
  ).set;
  nativeInputValueSetter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function click(selector) {
  const el = document.querySelector(selector);
  if (el) { el.click(); return true; }
  return false;
}

function visible(el) {
  return el && el.offsetParent !== null;
}

async function waitFor(selector, timeoutMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector(selector);
    if (visible(el)) return el;
    await sleep(100);
  }
  return null;
}

function getSettings() {
  return new Promise(resolve =>
    chrome.storage.local.get(['email', 'secret', 'password'], resolve)
  );
}

async function doRun() {
  const { email, secret, password } = await getSettings();

  if (!email || !secret) {
    // Not configured — silently do nothing
    return;
  }

  // ── Step 1: email field ──────────────────────────────────────
  const emailField = document.querySelector(
    "input[type='email'], input#i0116, input[name='loginfmt']"
  );
  if (visible(emailField) && !emailField.value) {
    fill(emailField, email);
    await sleep(DELAY_MS);
    click("#idSIButton9, input[type='submit']");
    return;
  }

  // ── Step 2: password field — use stored or browser autofill ──
  const pwField = document.querySelector(
    "input[type='password'], input#i0118"
  );
  if (visible(pwField)) {
    if (password) {
      fill(pwField, password);
    } else {
      await sleep(400); // wait for browser autofill
    }
    if (pwField.value) {
      await sleep(DELAY_MS);
      click("#idSIButton9, input[type='submit']");
    }
    return;
  }

  // ── Step 2.5: "Approve sign in request" — switch to TOTP ─────
  const cantUseLink = Array.from(document.querySelectorAll("a")).find(el =>
    /i can't use my microsoft authenticator app right now/i.test(el.innerText)
  );
  if (cantUseLink) {
    await sleep(DELAY_MS);
    cantUseLink.click();
    return;
  }

  // ── Step 3a: MFA method selection — click "Use a verification code" ──
  const bodyText = document.body.innerText || "";
  const isVerifyPage = /verify your identity|choose.*verification|verification method/i.test(bodyText);
  if (isVerifyPage) {
    const allLinks = Array.from(document.querySelectorAll("a, div[role='button'], li, [data-value]"));
    const codeOption = allLinks.find(el =>
      /use a verification code|verification code|authenticator.*code|one.time/i.test(el.innerText)
    );
    if (codeOption) {
      await sleep(DELAY_MS);
      codeOption.click();
      const otpField = await waitFor(
        "input#idTxtBx_SAOTCC_OTC, input[name='otc'], input[autocomplete='one-time-code']",
        6000
      );
      if (otpField) {
        const code = await generateTOTP(secret);
        fill(otpField, code);
        await sleep(DELAY_MS);
        click("#idSubmit_SAOTCC_Continue, #idSIButton9, input[type='submit']");
      }
      return;
    }
  }

  // ── Step 3b: TOTP field already visible ───────────────────────
  const otpField = document.querySelector(
    "input#idTxtBx_SAOTCC_OTC, input[name='otc'], input[autocomplete='one-time-code']"
  );
  if (visible(otpField)) {
    const code = await generateTOTP(secret);
    fill(otpField, code);
    await sleep(DELAY_MS);
    click("#idSubmit_SAOTCC_Continue, #idSIButton9, input[type='submit']");
    return;
  }

  // ── Step 4: "Stay signed in?" ─────────────────────────────────
  const stayBtn = document.querySelector("#idSIButton9");
  if (stayBtn && /stay signed in|keep me signed in/i.test(stayBtn.value || document.body.innerText)) {
    await sleep(DELAY_MS);
    stayBtn.click();
    return;
  }
}

async function run() {
  if (busy) { pendingRun = true; return; }
  busy = true;
  pendingRun = false;
  try {
    await doRun();
  } finally {
    busy = false;
    if (pendingRun) { pendingRun = false; setTimeout(run, 0); }
  }
}

// MutationObserver — catches SPA transitions where URL doesn't change
let debounceTimer = null;
const obs = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(run, 150);
});
obs.observe(document.documentElement, { childList: true, subtree: true });

run();
