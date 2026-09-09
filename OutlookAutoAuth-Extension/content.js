"use strict";
// Auto-fills Microsoft login pages
// Settings loaded from chrome.storage.local
const DELAY_MS = 250;
let busy = false;
let pendingRun = false;
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}
function fill(el, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
}
function click(selector) {
    const el = findVisible(selector);
    if (el) {
        el.click();
        return true;
    }
    return false;
}
function visible(el) {
    return !!el && el.isConnected && el.offsetParent !== null &&
        getComputedStyle(el).visibility !== 'hidden' &&
        !el.matches(':disabled, [aria-disabled="true"]');
}
function findVisible(selector) {
    return Array.from(document.querySelectorAll(selector)).find(visible) ?? null;
}
function findAction(pattern) {
    return Array.from(document.querySelectorAll("a, button, [role='button']"))
        .find(el => visible(el) && pattern.test(el.innerText.trim()));
}
async function waitFor(selector, timeoutMs = 6000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const el = findVisible(selector);
        if (visible(el))
            return el;
        await sleep(100);
    }
    return null;
}
function getSettings() {
    return new Promise(resolve => chrome.storage.local.get(['email', 'secret', 'password'], items => resolve(items)));
}
async function doRun() {
    const { email, secret, password } = await getSettings();
    if (!email || !secret)
        return;
    // Only identity-provider pages may receive credentials. Outlook app pages
    // also match the manifest, but can contain unrelated email/code inputs.
    if (!['login.microsoftonline.com', 'login.microsoft.com'].includes(location.hostname))
        return;
    // Teams can show Microsoft's account picker before the passwordless screen.
    // Select only the configured account, never the first remembered account.
    const accountOption = Array.from(document.querySelectorAll('[role="button"][data-test-id][data-test-idp]')).find(el => visible(el) &&
        el.getAttribute('data-test-id')?.trim().toLowerCase() === email.trim().toLowerCase());
    if (accountOption) {
        await sleep(DELAY_MS);
        if (visible(accountOption))
            accountOption.click();
        return;
    }
    // Microsoft's passwordless-first screen appears before the password field
    // for both Outlook and Teams. Use the existing password + TOTP flow when
    // Microsoft offers it; never trigger a phone notification automatically.
    const passwordOption = findVisible('#idA_PWD_SwitchToPassword') ??
        findAction(/^(?:use (?:your|my|a) password instead|sign in with (?:your|a) password)$/i);
    if (passwordOption) {
        await sleep(DELAY_MS);
        if (visible(passwordOption))
            passwordOption.click();
        return;
    }
    // Step 1: email
    const emailField = findVisible("input[type='email'], input#i0116, input[name='loginfmt']");
    if (visible(emailField) && !emailField.value) {
        fill(emailField, email);
        await sleep(DELAY_MS);
        click("#idSIButton9, input[type='submit'], button[type='submit']");
        return;
    }
    // Step 2: password
    const pwField = findVisible("input[type='password'], input#i0118");
    if (visible(pwField)) {
        if (password)
            fill(pwField, password);
        else
            await sleep(400);
        if (pwField.value) {
            await sleep(DELAY_MS);
            click("#idSIButton9, input[type='submit'], button[type='submit']");
        }
        return;
    }
    // Step 2.5: switch away from push notification
    const cantUseLink = findAction(/i (?:can't|cannot|can’t) use my microsoft authenticator app right now|sign in another way|use another verification method/i);
    if (cantUseLink) {
        await sleep(DELAY_MS);
        cantUseLink.click();
        return;
    }
    // Step 3a: MFA method selection
    const bodyText = document.body.innerText ?? "";
    if (/verify your identity|choose.*verification|verification method/i.test(bodyText)) {
        const codeOption = Array.from(document.querySelectorAll("a, button, div[role='button'], li, [data-value]")).find(el => visible(el) && /use a verification code|authenticator.*code/i.test(el.innerText));
        if (codeOption) {
            await sleep(DELAY_MS);
            codeOption.click();
            const otpField = await waitFor("input#idTxtBx_SAOTCC_OTC, input[name='otc'], input[autocomplete='one-time-code']");
            if (otpField) {
                fill(otpField, await generateTOTP(secret));
                await sleep(DELAY_MS);
                click("#idSubmit_SAOTCC_Continue, #idSIButton9, input[type='submit'], button[type='submit']");
            }
            return;
        }
    }
    // Step 3b: TOTP field already visible
    const otpField = findVisible("input#idTxtBx_SAOTCC_OTC, input[name='otc'], input[autocomplete='one-time-code']");
    if (visible(otpField)) {
        fill(otpField, await generateTOTP(secret));
        await sleep(DELAY_MS);
        click("#idSubmit_SAOTCC_Continue, #idSIButton9, input[type='submit'], button[type='submit']");
        return;
    }
    // Step 4: stay signed in
    const stayBtn = findVisible("#idSIButton9");
    if (stayBtn && /stay signed in|keep me signed in/i.test(document.body.innerText)) {
        await sleep(DELAY_MS);
        stayBtn.click();
    }
}
async function run() {
    if (busy) {
        pendingRun = true;
        return;
    }
    busy = true;
    pendingRun = false;
    try {
        await doRun();
    }
    finally {
        busy = false;
        if (pendingRun) {
            pendingRun = false;
            setTimeout(run, 0);
        }
    }
}
let debounceTimer = null;
const obs = new MutationObserver(() => {
    if (debounceTimer !== null)
        clearTimeout(debounceTimer);
    debounceTimer = setTimeout(run, 150);
});
obs.observe(document.documentElement, { childList: true, subtree: true });
run();
