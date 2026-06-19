const $ = id => document.getElementById(id);

function setStatus(configured) {
  const bar = $('statusBar'), dot = $('statusDot'), txt = $('statusText');
  if (configured) {
    bar.className = 'status ok';
    dot.className = 'dot green';
    txt.textContent = 'Configured — extension is active';
  } else {
    bar.className = 'status warn';
    dot.className = 'dot orange';
    txt.textContent = 'Not configured — enter your details below';
  }
}

// Load saved settings on open
chrome.storage.local.get(['email', 'secret', 'password'], data => {
  if (data.email)    $('email').value    = data.email;
  if (data.secret)   $('secret').value   = data.secret;
  if (data.password) $('password').value = data.password;
  setStatus(!!(data.email && data.secret));
});

// Toggle password visibility
$('togglePw').addEventListener('click', () => {
  const pw = $('password');
  pw.type = pw.type === 'password' ? 'text' : 'password';
});

// Save
$('saveBtn').addEventListener('click', () => {
  const email    = $('email').value.trim();
  const secret   = $('secret').value.trim().toUpperCase().replace(/\s/g, '');
  const password = $('password').value;

  if (!email || !secret) {
    $('saveMsg').style.color = '#d83b01';
    $('saveMsg').textContent = 'Email and secret key are required.';
    return;
  }

  chrome.storage.local.set({ email, secret, password }, () => {
    $('saveMsg').style.color = '#107c10';
    $('saveMsg').textContent = '✓ Saved!';
    setStatus(true);
    setTimeout(() => ($('saveMsg').textContent = ''), 3000);
  });
});
