import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';

import { applyPresentationState } from './presentationState.mjs';

function makeLocalStorage() {
  const store = new Map();
  return {
    keys: () => [...store.keys()],
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
}

// Reproduce the browser scope Playwright gives page.evaluate: only the callback's
// argument plus browser globals. A node:vm context holding just a localStorage stub
// and JSON is that scope. Any reference to a Node symbol (e.g. onboardingDoneKey)
// throws ReferenceError here — exactly the run-2 failure (8/8) CTO measured.
function runInBrowserScope(fn, arg) {
  const localStorage = makeLocalStorage();
  const sandbox = { localStorage, JSON };
  vm.createContext(sandbox);
  vm.runInContext(`(${fn.toString()})(${JSON.stringify(arg)})`, sandbox);
  return localStorage;
}

test('harness self-check: the vm scope is genuinely empty, a Node symbol throws ReferenceError', () => {
  const sandbox = { localStorage: makeLocalStorage(), JSON };
  vm.createContext(sandbox);
  // Without this the contract below could pass trivially. Proves onboardingDoneKey
  // (and every other Node import) is absent from the browser-like scope. Match on
  // {name} not the host class: an error thrown inside a vm context comes from the
  // vm's own realm, so its ReferenceError has a different prototype.
  assert.throws(() => vm.runInContext('onboardingDoneKey("u-42")', sandbox), {
    name: 'ReferenceError',
  });
});

test('applyPresentationState runs in the browser scope with no ReferenceError and writes every key', () => {
  const arg = {
    locale: 'en',
    theme: 'dark',
    onboardingKey: 'consultify_onboarding_done:u-42',
  };
  let localStorage;
  // DEC-590 (Wpis 73 / C3c): this is the assertion that was RED at c75b3ef1b2 — the
  // callback then called onboardingDoneKey(userId) inside the browser body.
  assert.doesNotThrow(() => {
    localStorage = runInBrowserScope(applyPresentationState, arg);
  });
  assert.equal(localStorage.getItem('i18nextLng'), 'en');
  assert.equal(localStorage.getItem('consultify_language'), 'en');
  assert.equal(localStorage.getItem('theme'), 'dark');
  assert.equal(localStorage.getItem('consultify_onboarding_done:u-42'), 'true');
  const storage = JSON.parse(localStorage.getItem('consultify-storage'));
  assert.equal(storage.state.theme, 'dark');
  assert.equal(storage.version, 2);
});

test('a null onboardingKey (no userId) writes presentation state but no onboarding guard', () => {
  const arg = { locale: 'pl', theme: 'light', onboardingKey: null };
  let localStorage;
  assert.doesNotThrow(() => {
    localStorage = runInBrowserScope(applyPresentationState, arg);
  });
  assert.equal(localStorage.getItem('i18nextLng'), 'pl');
  assert.equal(localStorage.getItem('theme'), 'light');
  assert.equal(
    localStorage.keys().some((key) => key.startsWith('consultify_onboarding_done:')),
    false,
    'no key was computed in Node, so no onboarding guard may be written'
  );
});
