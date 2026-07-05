/**
 * Security tests for the SAML XML-signature verifier (xml-crypto backed).
 *
 * These tests generate a REAL RSA keypair + self-signed X.509 certificate at
 * runtime (via OpenSSL), sign SAML assertions with xml-crypto, and then assert
 * that the verifier:
 *   (a) accepts a genuinely-signed assertion and returns the correct NameID;
 *   (b) rejects a response whose signature was tampered (one byte flipped);
 *   (c) is immune to XML Signature Wrapping — an unsigned attacker assertion
 *       injected alongside the signed one must NEVER be returned;
 *   (d) rejects when verified against a different (wrong) certificate;
 *   (e) rejects a response with no signature at all;
 *   (+) rejects a DOCTYPE-bearing response (XXE guard).
 *
 * Plus an end-to-end integration through SSOService.validateSAMLResponse to
 * prove the caller extracts identity from the SIGNED assertion only.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { DOMParser } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';
import * as xpath from 'xpath';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Mocks for the SSOService integration test — keep it DB-free.
vi.mock('../../database/Database.js', () => ({
  getDatabase: () => ({ query: vi.fn() }),
}));
vi.mock('../../utils/secretEncryption.js', () => ({
  encryptSecret: (v: string) => v,
  decryptSecret: (v: string) => v,
}));

import { verifySAMLSignature } from '../samlSignatureVerifier.js';
import { SSOService } from '../../services/tablePlatform/SSOService.js';

// ---------------------------------------------------------------------------
// Test key material (real RSA + self-signed X.509 via OpenSSL)
// ---------------------------------------------------------------------------
let privateKey = '';
let certificate = '';
let otherCertificate = '';

function genSelfSigned(cn: string): { key: string; cert: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saml-verifier-test-'));
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

/** Extract the NameID text from an assertion-fragment XML string. */
function nameIdOf(assertionXml: string): string | null {
  const doc = new DOMParser().parseFromString(assertionXml, 'text/xml');
  const n = xpath.select1(".//*[local-name()='NameID']/text()", doc as unknown as Node) as
    | { data?: string }
    | undefined;
  return n?.data ?? null;
}

beforeAll(() => {
  const a = genSelfSigned('test-idp');
  privateKey = a.key;
  certificate = a.cert;
  otherCertificate = genSelfSigned('other-idp').cert;
});

describe('verifySAMLSignature', () => {
  // (a) valid signature → returns signed assertion with correct NameID
  it('accepts a correctly-signed assertion and returns its NameID', () => {
    const xml = buildSignedResponse('user@example.com');
    const result = verifySAMLSignature(xml, certificate);
    expect(result).not.toBeNull();
    expect(nameIdOf(result!.signedAssertionXml)).toBe('user@example.com');
    // The returned fragment must be the Assertion element itself.
    expect(result!.signedAssertionXml).toMatch(/<saml:Assertion[\s>]/);
  });

  // (b) tampered NameID / broken signature → null
  it('rejects a response whose NameID was swapped after signing', () => {
    const xml = buildSignedResponse('user@example.com');
    // Mutate the signed NameID text — invalidates the digest, thus the signature.
    const tampered = xml.replace('user@example.com', 'attacker@evil.com');
    expect(verifySAMLSignature(tampered, certificate)).toBeNull();
  });

  it('rejects a response whose SignatureValue byte was flipped', () => {
    const xml = buildSignedResponse('user@example.com');
    const tampered = xml.replace(
      /(<(?:ds:)?SignatureValue[^>]*>)([A-Za-z0-9+/])/,
      (_m, open, c) => open + (c === 'A' ? 'B' : 'A')
    );
    expect(tampered).not.toEqual(xml); // sanity: we actually changed a byte
    expect(verifySAMLSignature(tampered, certificate)).toBeNull();
  });

  // (c) SIGNATURE WRAPPING — attacker assertion injected next to the signed one
  it('ignores an injected unsigned attacker assertion (XSW-safe)', () => {
    const good = buildSignedResponse('user@example.com', '_signed');
    const attacker =
      `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
      `ID="_evil" Version="2.0" IssueInstant="2026-01-01T00:00:00Z">` +
      `<saml:Subject><saml:NameID>attacker@evil.com</saml:NameID></saml:Subject>` +
      `</saml:Assertion>`;
    // Inject the attacker assertion as a sibling BEFORE the signed one.
    const wrapped = good.replace('<saml:Assertion', attacker + '<saml:Assertion');
    expect(wrapped).toContain('attacker@evil.com'); // sanity: attacker is present

    const result = verifySAMLSignature(wrapped, certificate);
    expect(result).not.toBeNull();
    const nameId = nameIdOf(result!.signedAssertionXml);
    expect(nameId).toBe('user@example.com');
    expect(nameId).not.toBe('attacker@evil.com');
    // The returned fragment must not carry the attacker identity at all.
    expect(result!.signedAssertionXml).not.toContain('attacker@evil.com');
  });

  it('rejects a duplicate-ID wrapping attempt (attacker reuses signed ID)', () => {
    const good = buildSignedResponse('user@example.com', '_dup');
    const attacker =
      `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
      `ID="_dup" Version="2.0" IssueInstant="2026-01-01T00:00:00Z">` +
      `<saml:Subject><saml:NameID>attacker@evil.com</saml:NameID></saml:Subject>` +
      `</saml:Assertion>`;
    const wrapped = good.replace('<saml:Assertion', attacker + '<saml:Assertion');
    // xml-crypto's duplicate-ID guard throws; verifier must fail closed → null.
    expect(verifySAMLSignature(wrapped, certificate)).toBeNull();
  });

  // (d) wrong certificate → null
  it('rejects when verified against a different certificate', () => {
    const xml = buildSignedResponse('user@example.com');
    expect(verifySAMLSignature(xml, otherCertificate)).toBeNull();
  });

  // (e) no signature → null
  it('rejects an unsigned response', () => {
    const unsigned =
      `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
      `xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">` +
      `<saml:Assertion ID="_x"><saml:Subject>` +
      `<saml:NameID>anyone@example.com</saml:NameID></saml:Subject></saml:Assertion>` +
      `</samlp:Response>`;
    expect(verifySAMLSignature(unsigned, certificate)).toBeNull();
  });

  // (+) XXE guard — DOCTYPE present → null
  it('rejects a response containing a DOCTYPE (XXE guard)', () => {
    const xml = buildSignedResponse('user@example.com');
    const withDoctype = `<?xml version="1.0"?><!DOCTYPE foo [ <!ENTITY x "y"> ]>${xml}`;
    expect(verifySAMLSignature(withDoctype, certificate)).toBeNull();
  });

  // Defensive input handling
  it('rejects empty / malformed input', () => {
    expect(verifySAMLSignature('', certificate)).toBeNull();
    expect(verifySAMLSignature('<not-xml', certificate)).toBeNull();
    expect(verifySAMLSignature(buildSignedResponse('u@e.com'), '')).toBeNull();
  });

  it('accepts a bare-base64 (non-PEM) certificate body', () => {
    const bareBody = certificate
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s+/g, '');
    const xml = buildSignedResponse('user@example.com');
    const result = verifySAMLSignature(xml, bareBody);
    expect(result).not.toBeNull();
    expect(nameIdOf(result!.signedAssertionXml)).toBe('user@example.com');
  });
});

// ---------------------------------------------------------------------------
// End-to-end integration through SSOService.validateSAMLResponse
// ---------------------------------------------------------------------------
describe('SSOService.validateSAMLResponse with real verifier (wrapping-safe)', () => {
  // Minimal in-line mocks so we don't touch the DB or secret encryption.
  it('extracts identity from the signed assertion, never the injected one', async () => {
    const svc = new SSOService();
    // Point getSSOConfig at our cert without a DB by stubbing the method.
    vi.spyOn(svc, 'getSSOConfig').mockResolvedValue({
      id: 'sso-1',
      organization_id: 'org-1',
      provider: 'saml',
      enabled: true,
      config: { entityId: 'e', ssoUrl: 's', certificate },
      metadata_url: null,
      created_at: 'x',
      updated_at: 'x',
    } as never);
    svc.setSignatureVerifier(verifySAMLSignature);

    const good = buildSignedResponse('user@example.com', '_signed');
    const attacker =
      `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
      `ID="_evil" Version="2.0" IssueInstant="2026-01-01T00:00:00Z">` +
      `<saml:Subject><saml:NameID>attacker@evil.com</saml:NameID></saml:Subject>` +
      `</saml:Assertion>`;
    const wrapped = good.replace('<saml:Assertion', attacker + '<saml:Assertion');
    const encoded = Buffer.from(wrapped).toString('base64');

    const result = await svc.validateSAMLResponse('org-1', encoded);
    expect(result.valid).toBe(true);
    expect(result.nameId).toBe('user@example.com');
    expect(result.email).toBe('user@example.com');
    expect(result.nameId).not.toBe('attacker@evil.com');

    // And a tampered response is rejected end-to-end.
    const tampered = good.replace('user@example.com', 'attacker@evil.com');
    const tamperedResult = await svc.validateSAMLResponse(
      'org-1',
      Buffer.from(tampered).toString('base64')
    );
    expect(tamperedResult.valid).toBe(false);
  });
});
