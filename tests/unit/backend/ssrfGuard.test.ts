import { describe, expect, it } from 'vitest';

import {
  assertUrlIsSafe,
  isBlockedIp,
  SsrfBlockedError,
} from '../../../server/src/utils/ssrfGuard.js';

describe('ssrfGuard.isBlockedIp', () => {
  it('blocks private / loopback / link-local / metadata IPv4', () => {
    for (const ip of [
      '10.0.0.1',
      '172.16.5.4',
      '172.31.255.255',
      '192.168.1.1',
      '127.0.0.1',
      '0.0.0.0',
      '169.254.169.254', // cloud metadata
      '100.64.0.1', // CGNAT
      '198.18.0.1', // benchmarking
      '224.0.0.1', // multicast
      '255.255.255.255', // broadcast
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it('allows ordinary public IPv4', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.0.1', '172.32.0.1']) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });

  it('blocks loopback / ULA / link-local / IPv4-mapped IPv6', () => {
    for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1']) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it('allows public IPv6', () => {
    expect(isBlockedIp('2606:4700:4700::1111')).toBe(false);
  });
});

describe('ssrfGuard.assertUrlIsSafe', () => {
  it('rejects non-http(s) protocols', async () => {
    await expect(assertUrlIsSafe('file:///etc/passwd')).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(assertUrlIsSafe('ftp://example.com')).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(assertUrlIsSafe('gopher://1.1.1.1')).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it('rejects malformed URLs', async () => {
    await expect(assertUrlIsSafe('not a url')).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it('rejects bare private/metadata IP hosts without DNS', async () => {
    await expect(assertUrlIsSafe('http://169.254.169.254/latest/meta-data/')).rejects.toBeInstanceOf(
      SsrfBlockedError
    );
    await expect(assertUrlIsSafe('http://127.0.0.1:8080/admin')).rejects.toBeInstanceOf(
      SsrfBlockedError
    );
    await expect(assertUrlIsSafe('http://[::1]/')).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it('accepts a bare public IP host', async () => {
    const u = await assertUrlIsSafe('https://1.1.1.1/');
    expect(u.hostname).toBe('1.1.1.1');
  });
});
