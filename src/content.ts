// Auto-fills Microsoft + GitHub login pages
// Settings loaded from chrome.storage.local

declare function generateTOTP(secret: string): Promise<string>;

const DELAY_MS = 250;
let busy = false;
let pendingRun = false;

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function fill(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function click(selector: string): boolean {
  const el = document.querySelector<HTMLElement>(selector);
  if (el) { el.click(); return true; }
  return false;
}

function visible(el: Element | null): el is HTMLElement {
  return !!el && (el as HTMLElement).offsetParent !== null;
}

async function waitFor(selector: string, timeoutMs = 6000): Promise<HTMLInputElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector<HTMLInputElement>(selector);
    if (visible(el)) return el;
    await sleep(100);
  }
  return null;
}

interface Settings {
  email?: string;
  password?: string;
  secret?: string;
  githubSecret?: string;
}

function getSettings(): Promise<Settings> {
  return new Promise(resolve =>
    chrome.storage.local.get(['email', 'secret', 'password', 'githubSecret'], items =>
      resolve(items as Settings)
    )
  );
}

async function handleGitHub(githubSecret: string): Promise<void> {
  const otpField = await waitFor(
    "input[name='app_otp'], input[name='otp'], input#app_totp, input[autocomplete='one-time-password']"
  );
  if (!otpField) return;
  fill(otpField, await generateTOTP(githubSecret));
  await sleep(DELAY_MS);
  // GitHub auto-submits on valid input; click submit as fallback
  click("input[type='submit'], button[type='submit']");
}

async function doRun(): Promise<void> {
  const { email, secret, password, githubSecret } = await getSettings();

  // ── GitHub 2FA ────────────────────────────────────────────────
  if (window.location.hostname === "github.com") {
    if (githubSecret) await handleGitHub(githubSecret);
    return;
  }

  // ── Microsoft flow ────────────────────────────────────────────
  if (!email || !secret) return;

  // Step 1: email
  const emailField = document.querySelector<HTMLInputElement>(
    "input[type='email'], input#i0116, input[name='loginfmt']"
  );
  if (visible(emailField) && !emailField.value) {
    fill(emailField, email);
    await sleep(DELAY_MS);
    click("#idSIButton9, input[type='submit']");
    return;
  }

  // Step 2: password
  const pwField = document.querySelector<HTMLInputElement>("input[type='password'], input#i0118");
  if (visible(pwField)) {
    if (password) fill(pwField, password);
    else await sleep(400);
    if (pwField.value) {
      await sleep(DELAY_MS);
      click("#idSIButton9, input[type='submit']");
    }
    return;
  }

  // Step 2.5: switch away from push notification
  const cantUseLink = Array.from(document.querySelectorAll("a")).find(el =>
    /i can't use my microsoft authenticator app right now/i.test(el.innerText)
  );
  if (cantUseLink) { await sleep(DELAY_MS); cantUseLink.click(); return; }

  // Step 3a: MFA method selection
  const bodyText = document.body.innerText ?? "";
  if (/verify your identity|choose.*verification|verification method/i.test(bodyText)) {
    const codeOption = Array.from(
      document.querySelectorAll<HTMLElement>("a, div[role='button'], li, [data-value]")
    ).find(el => /use a verification code|verification code|authenticator.*code|one.time/i.test(el.innerText));
    if (codeOption) {
      await sleep(DELAY_MS);
      codeOption.click();
      const otpField = await waitFor(
        "input#idTxtBx_SAOTCC_OTC, input[name='otc'], input[autocomplete='one-time-code']"
      );
      if (otpField) {
        fill(otpField, await generateTOTP(secret));
        await sleep(DELAY_MS);
        click("#idSubmit_SAOTCC_Continue, #idSIButton9, input[type='submit']");
      }
      return;
    }
  }

  // Step 3b: TOTP field already visible
  const otpField = document.querySelector<HTMLInputElement>(
    "input#idTxtBx_SAOTCC_OTC, input[name='otc'], input[autocomplete='one-time-code']"
  );
  if (visible(otpField)) {
    fill(otpField, await generateTOTP(secret));
    await sleep(DELAY_MS);
    click("#idSubmit_SAOTCC_Continue, #idSIButton9, input[type='submit']");
    return;
  }

  // Step 4: stay signed in
  const stayBtn = document.querySelector<HTMLInputElement>("#idSIButton9");
  if (stayBtn && /stay signed in|keep me signed in/i.test(stayBtn.value || document.body.innerText)) {
    await sleep(DELAY_MS);
    stayBtn.click();
  }
}

async function run(): Promise<void> {
  if (busy) { pendingRun = true; return; }
  busy = true;
  pendingRun = false;
  try { await doRun(); }
  finally {
    busy = false;
    if (pendingRun) { pendingRun = false; setTimeout(run, 0); }
  }
}

let debounceTimer: number | null = null;
const obs = new MutationObserver(() => {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(run, 150);
});
obs.observe(document.documentElement, { childList: true, subtree: true });
run();
