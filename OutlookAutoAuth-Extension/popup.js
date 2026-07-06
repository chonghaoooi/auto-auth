"use strict";
const $ = (id) => document.getElementById(id);
const $input = (id) => document.getElementById(id);
// ponytail: 1s poll, good enough for a popup that's open for seconds
function startCodeDisplay(getSecret, el) {
    const tick = () => {
        const secret = getSecret();
        if (!secret) {
            el.textContent = '——— ———';
            return;
        }
        generateTOTP(secret).then(code => {
            el.textContent = code.slice(0, 3) + ' ' + code.slice(3);
        });
    };
    tick();
    setInterval(tick, 1000);
}
function setStatus(configured) {
    const bar = $('statusBar'), dot = $('statusDot'), txt = $('statusText');
    if (configured) {
        bar.className = 'status ok';
        dot.className = 'dot green';
        txt.textContent = 'Configured — extension is active';
    }
    else {
        bar.className = 'status warn';
        dot.className = 'dot orange';
        txt.textContent = 'Not configured — enter your details below';
    }
}
chrome.storage.local.get(['email', 'secret', 'password'], data => {
    if (data['email'])
        $input('email').value = data['email'];
    if (data['secret'])
        $input('secret').value = data['secret'];
    if (data['password'])
        $input('password').value = data['password'];
    setStatus(!!(data['email'] && data['secret']));
});
startCodeDisplay(() => $input('secret').value.trim(), $('liveCode'));
$('togglePw').addEventListener('click', () => {
    const pw = $input('password');
    pw.type = pw.type === 'password' ? 'text' : 'password';
});
$('saveBtn').addEventListener('click', () => {
    const email = $input('email').value.trim();
    const secret = $input('secret').value.trim().toUpperCase().replace(/\s/g, '');
    const password = $input('password').value;
    if (!email || !secret) {
        $('saveMsg').style.color = '#d83b01';
        $('saveMsg').textContent = 'Email and TOTP secret are required.';
        return;
    }
    chrome.storage.local.set({ email, secret, password }, () => {
        $('saveMsg').style.color = '#107c10';
        $('saveMsg').textContent = '✓ Saved!';
        setStatus(true);
        setTimeout(() => ($('saveMsg').textContent = ''), 3000);
    });
});
