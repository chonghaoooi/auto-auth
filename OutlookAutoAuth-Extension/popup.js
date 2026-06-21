"use strict";
const $ = (id) => document.getElementById(id);
const $input = (id) => document.getElementById(id);
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
chrome.storage.local.get(['email', 'secret', 'password', 'githubSecret'], data => {
    if (data['email'])
        $input('email').value = data['email'];
    if (data['secret'])
        $input('secret').value = data['secret'];
    if (data['password'])
        $input('password').value = data['password'];
    if (data['githubSecret'])
        $input('githubSecret').value = data['githubSecret'];
    setStatus(!!(data['email'] && data['secret']));
});
$('togglePw').addEventListener('click', () => {
    const pw = $input('password');
    pw.type = pw.type === 'password' ? 'text' : 'password';
});
$('saveBtn').addEventListener('click', () => {
    const email = $input('email').value.trim();
    const secret = $input('secret').value.trim().toUpperCase().replace(/\s/g, '');
    const password = $input('password').value;
    const githubSecret = $input('githubSecret').value.trim().toUpperCase().replace(/\s/g, '');
    if (!email || !secret) {
        $('saveMsg').style.color = '#d83b01';
        $('saveMsg').textContent = 'Email and TOTP secret are required.';
        return;
    }
    chrome.storage.local.set({ email, secret, password, githubSecret }, () => {
        $('saveMsg').style.color = '#107c10';
        $('saveMsg').textContent = '✓ Saved!';
        setStatus(true);
        setTimeout(() => ($('saveMsg').textContent = ''), 3000);
    });
});
