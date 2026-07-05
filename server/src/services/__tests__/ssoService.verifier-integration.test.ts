/**
 * E1-3c — proves the LEGACY (live) SAML login path is wired to the real
 * xml-crypto signature verifier, not just the dormant tablePlatform SSOService.
 *
 * The live login flow is: Gateway → server/src/routes/integrations/sso.routes.js
 * `POST /saml/callback` → `verifySAMLResponse(...)` from `../ssoService.js`.
 * That function is fail-closed: until `setSAMLSignatureVerifier(...)` is called
 * (from the SAME module), every SAML response is rejected with
 * "SAML signature verification not configured".
 *
 * This test registers the real verifier exactly as server/src/index.ts now
 * does at boot, then drives `verifySAMLResponse` (the legacy, live-path
 * function) end-to-end with a genuinely signed SAML response — plus negative
 * cases (unsigned/forged, and verifier unregistered) — to prove the fix
 * actually closes the live gap and isn't another false-green against a dead
 * module.
 *
 * Signing helpers are copied from
 * server/src/utils/__tests__/samlSignatureVerifier.test.ts (not modified).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SignedXml } from 'xml-crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// eslint-disable-next-line import/first
import { setSAMLSignatureVerifier, verifySAMLResponse } from '../ssoService.js';
// eslint-disable-next-line import/first
import { verifySAMLSignature } from '../../utils/samlSignatureVerifier.js';

// ---------------------------------------------------------------------------
// Test key material (real RSA + self-signed X.509 via OpenSSL) — copied helper
// from server/src/utils/__tests__/samlSignatureVerifier.test.ts.
// ---------------------------------------------------------------------------
let privateKey = '';
let certificate = '';

function genSelfSigned(cn: string): { key: string; cert: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saml-verifier-integ-test-'));
  const keyPath = path.join(dir, 'key.pem');
  const certPath = path.join(dir, 'cert.pem');
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', keyPath, '-out', certPath, '-days', '2', '-subj', `/CN=${cn}`,
  ]);
  const key = fs.readFileSync(keyPath, 'utf8');
  const cert = fs.readFileSync(certPath, 'utf8');
  fs.rmSync(dir, { recursive: true, force: true });
  return { key, cert };
}

/** Build a SAML Response with one Assertion signed (enveloped) by our key. */
function buildSignedResponse(nameId: string, assertionId = '_assert-1'): string {
  const assertion =
    `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
    `ID="${assertionId}" Version="2.0" IssueInstant="2026-01-01T00:00:00Z">` +
    `<saml:Subject><saml:NameID>${nameId}</saml:NameID></saml:Subject>` +
    `</saml:Assertion>`;
  const response =
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
    `xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${assertion}</samlp:Response>`;

  const sig = new SignedXml({ privateKey, publicCert: certificate });
  sig.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
  sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';
  sig.addReference({
    xpath: "//*[local-name(.)='Assertion']",
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
  });
  sig.computeSignature(response, {
    location: { reference: "//*[local-name(.)='Assertion']", action: 'append' },
  });
  return sig.getSignedXml();
}

beforeAll(() => {
  const a = genSelfSigned('test-idp');
  privateKey = a.key;
  certificate = a.cert;
});

afterEach(() => {
  // Never leak a registered verifier across tests/files — global module state.
  setSAMLSignatureVerifier(null);
});

afterAll(() => {
  setSAMLSignatureVerifier(null);
});

describe('legacy ssoService.verifySAMLResponse wired to the real xml-crypto verifier', () => {
  it('(a) full live chain: register → verifySAMLResponse → util → extracted identity', async () => {
    // Mirrors exactly what server/src/index.ts does at boot.
    setSAMLSignatureVerifier(verifySAMLSignature);

    const signedXml = buildSignedResponse('user@example.com');
    const encoded = Buffer.from(signedXml).toString('base64');

    const result = await verifySAMLResponse(encoded, certificate);

    expect(result).toEqual({
      valid: true,
      nameId: 'user@example.com',
      attributes: {},
    });
  });

  it('(b) forged/unsigned response is rejected — no regex fallback', async () => {
    setSAMLSignatureVerifier(verifySAMLSignature);

    const unsigned =
      `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
      `xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">` +
      `<saml:Assertion ID="_x"><saml:Subject>` +
      `<saml:NameID>attacker@evil.com</saml:NameID></saml:Subject></saml:Assertion>` +
      `</samlp:Response>`;
    const encoded = Buffer.from(unsigned).toString('base64');

    const result = await verifySAMLResponse(encoded, certificate);

    expect(result.valid).toBe(false);
  });

  it('(c) with verifier unregistered (null), even a genuinely signed response fails closed', async () => {
    // Prove this really is the SAME live gate the previous worker left broken:
    // no registration → fail-closed, regardless of how valid the signature is.
    setSAMLSignatureVerifier(null);

    const signedXml = buildSignedResponse('user@example.com');
    const encoded = Buffer.from(signedXml).toString('base64');

    const result = await verifySAMLResponse(encoded, certificate);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/not configured/);
  });
});
