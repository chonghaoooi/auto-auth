const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { JSDOM } = require('jsdom');

const script = readFileSync('OutlookAutoAuth-Extension/content.js', 'utf8');
const settings = { email: 'test@example.com', password: 'test-password', secret: 'test-secret' };

function fixture(t, html, url = 'https://login.microsoftonline.com/common/login') {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  const { window: w } = dom;
  t.after(() => w.close());
  // jsdom has no layout engine. Model hidden ancestors for visibility checks.
  Object.defineProperty(w.HTMLElement.prototype, 'offsetParent', {
    get() { return this.closest('[hidden], [style*="display: none"]') ? null : w.document.body; }
  });
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', {
    get() { return this.textContent; }
  });
  w.chrome = { storage: { local: { get: (_, callback) => callback(settings) } } };
  w.generateTOTP = async () => '123456';
  const timeout = w.setTimeout.bind(w);
  w.setTimeout = (fn, ms) => timeout(fn, Math.min(ms, 1));
  const clicks = [];
  w.document.addEventListener('click', event => {
    event.preventDefault();
    clicks.push(event.target.id);
  });
  return {
    w, clicks,
    async run() {
      w.eval(script + '\nwindow.isFlowBusy = () => busy;');
      await this.settle();
    },
    async settle() {
      // Include the mutation observer's deferred pass as well as doRun delays.
      for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 5));
      assert.equal(w.isFlowBusy(), false, 'flow should finish without waiting on an absent field');
    }
  };
}

test('Outlook passwordless-first screen selects password, not notification', async t => {
  const f = fixture(t, `<a id="idA_PWD_SwitchToPassword">Use your password instead</a>
    <input id="notify" type="submit" value="Send notification">`);
  await f.run();
  assert.deepEqual(f.clicks, ['idA_PWD_SwitchToPassword']);
});

test('Teams redirect uses the same passwordless-to-password flow', async t => {
  const f = fixture(t, '<button id="password">Use your password instead</button>',
    'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?redirect_uri=https%3A%2F%2Fteams.microsoft.com');
  f.w.document.getElementById('password').onclick = () => {
    f.w.document.body.innerHTML = '<input type="password"><button type="submit" id="signin">Sign in</button>';
  };
  await f.run();
  assert.deepEqual(f.clicks, ['password', 'signin']);
  assert.equal(f.w.document.querySelector('input').value, settings.password);
});

test('Teams account picker selects only the configured email, case-insensitively', async t => {
  const f = fixture(t, `<div role="button" data-test-id="other@example.com" data-test-idp="0" id="other">Other</div>
    <div role="button" data-test-id="TEST@example.com" data-test-idp="0" id="configured">Test</div>`);
  await f.run();
  assert.deepEqual(f.clicks, ['configured']);
});

test('account picker does not choose an unrelated account', async t => {
  const f = fixture(t, '<div role="button" data-test-id="other@example.com" data-test-idp="0" id="other">Other</div>');
  await f.run();
  assert.deepEqual(f.clicks, []);
});

test('hidden and disabled password alternatives are ignored', async t => {
  const f = fixture(t, `<a hidden id="idA_PWD_SwitchToPassword">Use your password instead</a>
    <button disabled>Use your password instead</button>
    <button aria-disabled="true">Use your password instead</button>`);
  await f.run();
  assert.deepEqual(f.clicks, []);
});

test('notification-only flow waits for the user', async t => {
  const f = fixture(t, '<button type="submit" id="notify">Send notification</button>');
  await f.run();
  assert.deepEqual(f.clicks, []);
});

test('legacy email step skips hidden inputs and submits the visible button', async t => {
  const f = fixture(t, `<input type="email" hidden><input id="email" name="loginfmt">
    <input type="submit" id="idSIButton9" hidden><button type="submit" id="next">Next</button>`);
  await f.run();
  assert.equal(f.w.document.getElementById('email').value, settings.email);
  assert.deepEqual(f.clicks, ['next']);
});

test('MFA alternative button is supported', async t => {
  const f = fixture(t, '<button id="another">Sign in another way</button>');
  await f.run();
  assert.deepEqual(f.clicks, ['another']);
});

test('verification method button transitions to TOTP and submits', async t => {
  const f = fixture(t, '<h1>Verify your identity</h1><button id="code">Use a verification code</button>');
  f.w.document.getElementById('code').onclick = () => {
    f.w.document.body.innerHTML = '<input name="otc"><button type="submit" id="verify">Verify</button>';
  };
  f.w.document.addEventListener('click', event => {
    if (event.target.id === 'verify') {
      assert.equal(f.w.document.querySelector('input').value, '123456');
      f.w.document.body.innerHTML = '<h1>Signed in</h1>';
    }
  });
  await f.run();
  assert.deepEqual(f.clicks, ['code', 'verify']);
});

test('already visible TOTP field uses the legacy submit control', async t => {
  const f = fixture(t, '<input id="idTxtBx_SAOTCC_OTC"><input type="submit" id="idSubmit_SAOTCC_Continue">');
  await f.run();
  assert.equal(f.w.document.querySelector('input').value, '123456');
  assert.deepEqual(f.clicks, ['idSubmit_SAOTCC_Continue']);
});

test('stay signed in checks heading even when button value is Yes', async t => {
  const f = fixture(t, '<h1>Stay signed in?</h1><input type="submit" id="idSIButton9" value="Yes">');
  await f.run();
  assert.deepEqual(f.clicks, ['idSIButton9']);
});

test('Outlook mailbox inputs never receive credentials', async t => {
  const f = fixture(t, '<input type="email"><button type="submit" id="send">Send</button>',
    'https://outlook.cloud.microsoft/mail/inbox');
  await f.run();
  assert.equal(f.w.document.querySelector('input').value, '');
  assert.deepEqual(f.clicks, []);
});
