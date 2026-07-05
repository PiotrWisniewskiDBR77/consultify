/**
 * SAML XML signature verifier (xml-crypto backed) — V4-ENT SSO hardening.
 *
 * SECURITY CONTEXT (app-wide login):
 * ----------------------------------
 * SAML login is authentication. A SAML Response is a bag of XML that an
 * attacker fully controls on the wire; the ONLY thing that makes an identity
 * claim (NameID / email) trustworthy is a cryptographically valid XML-DSig
 * signature made with the IdP's private key. This module verifies that
 * signature against the configured IdP X.509 certificate and — crucially —
 * returns ONLY the exact `<Assertion>` element that the verified signature
 * actually covers, so downstream callers can never be tricked into reading an
 * attacker-injected, unsigned assertion (XML Signature Wrapping / XSW).
 *
 * Everything here FAILS CLOSED: on any doubt — parse error, missing/duplicate
 * signature, signature mismatch, wrong certificate, the signed reference not
 * pointing at an Assertion, or a DOCTYPE (XXE vector) — we return `null`.
 *
 * Wire this in at server boot via `setSAMLSignatureVerifier(verifier)`.
 */

import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';
import * as xpath from 'xpath';

import logger from './Logger.js';

const XMLDSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';
const SAML_ASSERTION_LOCAL_NAME = 'Assertion';

/**
 * Result of a successful verification: the serialized XML of the ONE assertion
 * element that is genuinely covered by the validated signature.
 */
export interface SAMLVerifiedAssertion {
  signedAssertionXml: string;
}

/**
 * Verify the enveloped XML signature of a decoded SAML response against the
 * IdP certificate. Returns the signed assertion's XML on success, or `null`
 * (fail-closed) on any failure or ambiguity.
 *
 * @param decodedXml   The already base64-decoded SAML Response XML string.
 * @param certificate  The IdP X.509 certificate (PEM or bare base64 DER body).
 */
export function verifySAMLSignature(
  decodedXml: string,
  certificate: string
): SAMLVerifiedAssertion | null {
  try {
    if (typeof decodedXml !== 'string' || decodedXml.trim() === '') {
      return null;
    }
    if (typeof certificate !== 'string' || certificate.trim() === '') {
      return null;
    }

    // XXE / entity-expansion defense: reject any DOCTYPE outright. @xmldom/xmldom
    // does not resolve external entities, but a DOCTYPE has no legitimate place
    // in a SAML response and internal entity definitions are an attack surface.
    if (/<!DOCTYPE/i.test(decodedXml) || /<!ENTITY/i.test(decodedXml)) {
      logger.warn('[samlSignatureVerifier] rejected response containing DOCTYPE/ENTITY (XXE guard)');
      return null;
    }

    const pemCert = normalizeCertificateToPem(certificate);
    if (!pemCert) {
      return null;
    }

    // Parse defensively: swallow parser errors and treat any fatal error as
    // "untrusted document" → fail closed.
    let parseFailed = false;
    const parser = new DOMParser({
      // @xmldom/xmldom error handler: (level, message) => void
      onError: (level: string) => {
        if (level === 'error' || level === 'fatalError') {
          parseFailed = true;
        }
      },
    } as unknown as ConstructorParameters<typeof DOMParser>[0]);

    const doc = parser.parseFromString(decodedXml, 'text/xml');
    if (parseFailed || !doc || !doc.documentElement) {
      return null;
    }

    // Exactly one enveloped ds:Signature is expected. Zero → unsigned (reject).
    // More than one → ambiguous / potential wrapping (reject fail-closed).
    const signatureNodes = xpath.select(
      "//*[local-name(.)='Signature' and namespace-uri(.)='" + XMLDSIG_NS + "']",
      doc as unknown as Node
    ) as Node[];

    if (!Array.isArray(signatureNodes) || signatureNodes.length !== 1) {
      logger.warn('[samlSignatureVerifier] rejecting: expected exactly one Signature', {
        count: Array.isArray(signatureNodes) ? signatureNodes.length : 0,
      });
      return null;
    }

    const sig = new SignedXml({ publicCert: pemCert });
    sig.loadSignature(signatureNodes[0]);

    // Cryptographic verification. xml-crypto throws (rather than returning
    // false) on many failure modes (bad signature value, wrong cert, duplicate
    // ID wrapping guard, …). Treat throw AND `false` identically: reject.
    let signatureValid = false;
    try {
      signatureValid = sig.checkSignature(decodedXml);
    } catch (err) {
      logger.warn('[samlSignatureVerifier] checkSignature rejected response', {
        error: (err as Error).message,
      });
      return null;
    }
    if (signatureValid !== true) {
      return null;
    }

    // ----- ANTI-WRAPPING: bind identity to the SIGNED node only -----
    // A valid signature only tells us "SOME element is signed". We must return
    // the exact element the signature covers, identified by the reference URI,
    // and confirm it is a SAML Assertion. Never trust the surrounding envelope.
    const references = sig.getReferences();
    if (!Array.isArray(references) || references.length === 0) {
      return null;
    }

    // Find references that point at a SAML Assertion element (by ID/Id/id).
    const signedAssertionElements: Element[] = [];
    for (const ref of references) {
      const rawUri = typeof ref.uri === 'string' ? ref.uri : '';
      // Only same-document references (URI = "#id") are acceptable here.
      if (!rawUri.startsWith('#')) {
        // A non-fragment/empty URI (whole-document reference) does not let us
        // pin identity to a single assertion — reject fail-closed.
        continue;
      }
      const id = rawUri.slice(1);
      if (id === '' || id.includes("'") || id.includes('"')) {
        continue;
      }

      const matches = xpath.select(
        "//*[@*[local-name(.)='ID' or local-name(.)='Id' or local-name(.)='id']='" + id + "']",
        doc as unknown as Node
      ) as Node[];

      // Exactly one element must carry this ID. (xml-crypto already rejects
      // duplicate IDs, but we re-assert it here as defense in depth.)
      if (!Array.isArray(matches) || matches.length !== 1) {
        logger.warn('[samlSignatureVerifier] signed reference id did not resolve uniquely', {
          id,
          count: Array.isArray(matches) ? matches.length : 0,
        });
        return null;
      }

      const node = matches[0] as Element;
      if (localName(node) === SAML_ASSERTION_LOCAL_NAME) {
        signedAssertionElements.push(node);
      }
    }

    // The signature must actually cover a SAML Assertion — if it only covers
    // the Response envelope or some other element, we cannot safely derive an
    // identity from a specific assertion → reject.
    if (signedAssertionElements.length !== 1) {
      logger.warn('[samlSignatureVerifier] signature does not cover exactly one Assertion', {
        count: signedAssertionElements.length,
      });
      return null;
    }

    const signedAssertionXml = new XMLSerializer().serializeToString(
      signedAssertionElements[0] as unknown as Node
    );
    if (typeof signedAssertionXml !== 'string' || signedAssertionXml.trim() === '') {
      return null;
    }

    return { signedAssertionXml };
  } catch (err) {
    // Absolutely nothing gets through on an unexpected error.
    logger.error('[samlSignatureVerifier] unexpected error — failing closed', {
      error: (err as Error).message,
    });
    return null;
  }
}

/**
 * Normalize an IdP certificate string into PEM form usable by xml-crypto /
 * Node crypto. Accepts either a full PEM block or a bare base64 DER body.
 * Returns `null` if the input is unusable.
 */
function normalizeCertificateToPem(certificate: string): string | null {
  const trimmed = certificate.trim();
  if (trimmed === '') return null;

  if (trimmed.includes('-----BEGIN CERTIFICATE-----')) {
    return trimmed;
  }

  // Treat as bare base64 DER: strip whitespace and wrap in PEM armor at 64 cols.
  const body = trimmed.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/=]+$/.test(body) || body.length === 0) {
    return null;
  }
  const wrapped = body.match(/.{1,64}/g)?.join('\n') ?? body;
  return `-----BEGIN CERTIFICATE-----\n${wrapped}\n-----END CERTIFICATE-----`;
}

function localName(node: Element): string {
  // Prefer DOM localName; fall back to stripping a namespace prefix from nodeName.
  const ln = (node as { localName?: string }).localName;
  if (typeof ln === 'string' && ln.length > 0) return ln;
  const name = node.nodeName || '';
  const idx = name.indexOf(':');
  return idx >= 0 ? name.slice(idx + 1) : name;
}

export default verifySAMLSignature;
