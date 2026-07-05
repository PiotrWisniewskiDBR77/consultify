import { afterEach, describe, expect, it } from 'vitest';

import {
  extractVerifiedClaims,
  type SAMLSignatureVerifier,
  setSAMLSignatureVerifier,
  verifySAMLResponse,
} from '../ssoService.js';

// ---------------------------------------------------------------------------
// SAML signature verification — FAIL CLOSED
//
// These tests guard the P0 auth-bypass fix: the legacy ssoService.parseSAMLResponse
// base64-decoded a SAML response and regex-scraped a <NameID> with NO signature
// verification, so anyone could log in as any email by crafting XML. The route now
// calls verifySAMLResponse(), which trusts identity ONLY after a registered
// SAMLSignatureVerifier confirms the signature over the specific assertion.
// ---------------------------------------------------------------------------

const b64 = (xml: string) => Buffer.from(xml).toString('base64');

const CERT = '-----BEGIN CERTIFICATE-----MIIC...-----END CERTIFICATE-----';

const SIGNED_ASSERTION = `<saml:Assertion>
  <saml:Subject>
    <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">user@example.com</saml:NameID>
  </saml:Subject>
  <saml:AttributeStatement>
    <saml:Attribute Name="email"><saml:AttributeValue>user@example.com</saml:AttributeValue></saml:Attribute>
  </saml:AttributeStatement>
</saml:Assertion>`;

const RESPONSE_WITH_SIGNED_ASSERTION = `<samlp:Response>
  ${SIGNED_ASSERTION}
  <Signature>...covers the assertion above...</Signature>
</samlp:Response>`;

// Signature-wrapping payload: a SIGNED assertion for user@example.com next to an
// UNSIGNED, attacker-injected assertion for attacker@evil.com. A correct verifier
// must return ONLY the signed assertion; identity must come from there, never from
// the injected one.
const WRAPPED_RESPONSE = `<samlp:Response>
  <saml:Assertion>
    <saml:Subject>
      <saml:NameID>attacker@evil.com</saml:NameID>
    </saml:Subject>
  </saml:Assertion>
  ${SIGNED_ASSERTION}
  <Signature>...covers ONLY the second assertion...</Signature>
</samlp:Response>`;

afterEach(() => {
  // Always reset to fail-closed (no verifier) between tests.
  setSAMLSignatureVerifier(null);
});

describe('extractVerifiedClaims', () => {
  it('reads NameID and attributes from an (already-verified) assertion', () => {
    const { nameId, attributes } = extractVerifiedClaims(SIGNED_ASSERTION);
    expect(nameId).toBe('user@example.com');
    expect(attributes.email).toBe('user@example.com');
  });
});

describe('verifySAMLResponse (fail-closed)', () => {
  // (a) forged / unsigned response is rejected when no verifier is configured.
  it('rejects a forged/unsigned response fail-closed (no verifier registered)', async () => {
    const forged = b64(`<samlp:Response><saml:Assertion><saml:Subject>
      <saml:NameID>attacker@evil.com</saml:NameID>
    </saml:Subject></saml:Assertion></samlp:Response>`);

    const result = await verifySAMLResponse(forged, CERT);

    expect(result.valid).toBe(false);
    expect(result.nameId).toBeUndefined();
    expect(result.attributes).toBeUndefined();
    expect(result.error).toMatch(/signature verification not configured/i);
  });

  it('rejects when the registered verifier reports an invalid signature (returns null)', async () => {
    const verifier: SAMLSignatureVerifier = () => null;
    setSAMLSignatureVerifier(verifier);

    const result = await verifySAMLResponse(b64(RESPONSE_WITH_SIGNED_ASSERTION), CERT);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/invalid saml signature/i);
    expect(result.nameId).toBeUndefined();
  });

  it('rejects when the verifier throws — no regex fallback', async () => {
    setSAMLSignatureVerifier(() => {
      throw new Error('boom');
    });

    const result = await verifySAMLResponse(b64(RESPONSE_WITH_SIGNED_ASSERTION), CERT);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/signature verification failed/i);
    expect(result.nameId).toBeUndefined();
  });

  it('rejects when no certificate is configured (even with a verifier)', async () => {
    setSAMLSignatureVerifier(() => ({ signedAssertionXml: SIGNED_ASSERTION }));

    const result = await verifySAMLResponse(b64(RESPONSE_WITH_SIGNED_ASSERTION), undefined);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/no SAML certificate/i);
  });

  // (b) signature-wrapping: NameID tampered/added outside the signed assertion is
  // ignored. Identity comes ONLY from the assertion the verifier attests as signed.
  it('defends against signature-wrapping — uses only the signed assertion', async () => {
    // A correct verifier returns ONLY the signed assertion element, not the whole
    // envelope. We simulate that: verifier attests the real signed assertion.
    setSAMLSignatureVerifier((decoded) => {
      // The signed assertion is the one carrying user@example.com in this payload.
      expect(decoded).toContain('attacker@evil.com'); // envelope does contain the injected one
      return { signedAssertionXml: SIGNED_ASSERTION };
    });

    const result = await verifySAMLResponse(b64(WRAPPED_RESPONSE), CERT);

    expect(result.valid).toBe(true);
    // Must be the SIGNED identity, never the injected attacker NameID.
    expect(result.nameId).toBe('user@example.com');
    expect(result.nameId).not.toBe('attacker@evil.com');
  });

  // (c) correctly-signed response is accepted, identity extracted from signed part.
  it('accepts a correctly-signed response and returns the signed identity', async () => {
    setSAMLSignatureVerifier((decoded, cert) => {
      expect(cert).toBe(CERT);
      // Return the specific assertion covered by the signature.
      return { signedAssertionXml: SIGNED_ASSERTION };
    });

    const result = await verifySAMLResponse(b64(RESPONSE_WITH_SIGNED_ASSERTION), CERT);

    expect(result.valid).toBe(true);
    expect(result.nameId).toBe('user@example.com');
    expect(result.attributes?.email).toBe('user@example.com');
  });

  it('rejects a signed response whose signed assertion has no NameID', async () => {
    setSAMLSignatureVerifier(() => ({
      signedAssertionXml: '<saml:Assertion><saml:Subject></saml:Subject></saml:Assertion>',
    }));

    const result = await verifySAMLResponse(b64(RESPONSE_WITH_SIGNED_ASSERTION), CERT);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/no NameID/i);
  });
});
