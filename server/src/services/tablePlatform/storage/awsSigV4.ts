/**
 * Minimal AWS Signature Version 4 signer for S3-compatible object stores.
 * Built on node's `crypto` only — no @aws-sdk dependency.
 *
 * Supports:
 *   - signRequest: adds Authorization + x-amz-* headers for PUT/GET/DELETE.
 *   - presignUrl:  query-string pre-signed URL (X-Amz-* params) for GET.
 *
 * Covers the S3 REST surface AttachmentService needs. Not a general-purpose
 * SDK: path-style addressing, single-shot payloads, UNSIGNED-PAYLOAD for
 * presign.
 */

import crypto from 'crypto';

export interface SigV4Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string; // 's3'
}

function hmac(key: crypto.BinaryLike | Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function amzDate(now: Date): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

/**
 * URI-encode per AWS rules. When `encodeSlash` is false, '/' is preserved
 * (used for the canonical path).
 */
export function awsUriEncode(str: string, encodeSlash = true): string {
  let out = '';
  for (const ch of str) {
    if (/[A-Za-z0-9\-._~]/.test(ch)) {
      out += ch;
    } else if (ch === '/' && !encodeSlash) {
      out += ch;
    } else {
      const bytes = Buffer.from(ch, 'utf8');
      for (const b of bytes) {
        out += '%' + b.toString(16).toUpperCase().padStart(2, '0');
      }
    }
  }
  return out;
}

function signingKey(cfg: SigV4Config, dateStamp: string): Buffer {
  const kDate = hmac('AWS4' + cfg.secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, cfg.region);
  const kService = hmac(kRegion, cfg.service);
  return hmac(kService, 'aws4_request');
}

export interface SignRequestInput {
  method: string;
  /** Full URL, e.g. https://endpoint/bucket/key */
  url: string;
  headers: Record<string, string>;
  /** Raw request body for hashing (Buffer). Empty for GET/DELETE. */
  body?: Buffer;
  now?: Date;
}

/**
 * Sign a request with SigV4 (Authorization header style). Returns the full
 * set of headers to send (including Authorization, x-amz-date,
 * x-amz-content-sha256, host).
 */
export function signRequest(
  cfg: SigV4Config,
  input: SignRequestInput
): Record<string, string> {
  const now = input.now ?? new Date();
  const { amzDate: xAmzDate, dateStamp } = amzDate(now);
  const parsed = new URL(input.url);

  const payloadHash = sha256Hex(input.body ?? Buffer.alloc(0));

  const baseHeaders: Record<string, string> = {
    ...input.headers,
    host: parsed.host,
    'x-amz-date': xAmzDate,
    'x-amz-content-sha256': payloadHash,
  };

  // Canonical headers: lowercase name, trimmed value, sorted by name.
  const headerNames = Object.keys(baseHeaders)
    .map((h) => h.toLowerCase())
    .sort();
  const lowerMap: Record<string, string> = {};
  for (const k of Object.keys(baseHeaders)) {
    lowerMap[k.toLowerCase()] = String(baseHeaders[k]).trim();
  }
  const canonicalHeaders = headerNames.map((h) => `${h}:${lowerMap[h]}\n`).join('');
  const signedHeaders = headerNames.join(';');

  const canonicalUri = awsUriEncode(parsed.pathname, false);
  // Canonical query string: sorted, encoded.
  const params = [...parsed.searchParams.entries()].sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1
  );
  const canonicalQuery = params
    .map(([k, v]) => `${awsUriEncode(k)}=${awsUriEncode(v)}`)
    .join('&');

  const canonicalRequest = [
    input.method.toUpperCase(),
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${cfg.region}/${cfg.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    xAmzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const key = signingKey(cfg, dateStamp);
  const signature = crypto.createHmac('sha256', key).update(stringToSign, 'utf8').digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...baseHeaders,
    Authorization: authorization,
  };
}

/**
 * Build a pre-signed GET URL (query-string auth) valid for `expiresInSeconds`.
 * Uses UNSIGNED-PAYLOAD (standard for presigned GET).
 */
export function presignUrl(
  cfg: SigV4Config,
  url: string,
  expiresInSeconds: number,
  now: Date = new Date()
): string {
  const { amzDate: xAmzDate, dateStamp } = amzDate(now);
  const parsed = new URL(url);
  const credentialScope = `${dateStamp}/${cfg.region}/${cfg.service}/aws4_request`;

  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${cfg.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': xAmzDate,
    'X-Amz-Expires': String(expiresInSeconds),
    'X-Amz-SignedHeaders': 'host',
  };
  // Merge any existing query params from the URL.
  for (const [k, v] of parsed.searchParams.entries()) {
    query[k] = v;
  }

  const sortedKeys = Object.keys(query).sort();
  const canonicalQuery = sortedKeys
    .map((k) => `${awsUriEncode(k)}=${awsUriEncode(query[k])}`)
    .join('&');

  const canonicalUri = awsUriEncode(parsed.pathname, false);
  const canonicalHeaders = `host:${parsed.host}\n`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    xAmzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const key = signingKey(cfg, dateStamp);
  const signature = crypto.createHmac('sha256', key).update(stringToSign, 'utf8').digest('hex');

  return `${parsed.origin}${parsed.pathname}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
