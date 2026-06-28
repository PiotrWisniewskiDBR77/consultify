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

  it('blocks ONLY 192.0.0.0/24, not the public 192.0/16 around it (IANA/ICANN)', () => {
    expect(isBlockedIp('192.0.0.1'), '192.0.0.1').toBe(true);
    expect(isBlockedIp('192.0.0.255'), '192.0.0.255').toBe(true);
    // 192.0.32.x / 192.0.43.x are public (example.com, iana.org) — must NOT block.
    expect(isBlockedIp('192.0.32.8'), '192.0.32.8').toBe(false);
    expect(isBlockedIp('192.0.43.7'), '192.0.43.7').toBe(false);
  });

  it('blocks loopback / ULA / link-local / IPv4-mapped IPv6', () => {
    for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1']) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it('blocks IPv4-mapped IPv6 in the COMPRESSED-HEX form that new URL() actually yields', () => {
    // new URL('http://[::ffff:169.254.169.254]/').hostname === '::ffff:a9fe:a9fe'
    for (const ip of [
      '::ffff:a9fe:a9fe', // 169.254.169.254 metadata
      '::ffff:7f00:1', // 127.0.0.1 loopback
      '0:0:0:0:0:ffff:7f00:1', // expanded form
      '::ffff:c0a8:1', // 192.168.0.1
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it('blocks NAT64 / 6to4 / Teredo / documentation IPv6 embedding private targets', () => {
    for (const ip of [
      '64:ff9b::a9fe:a9fe', // NAT64 → 169.254.169.254
      '2002:a9fe:a9fe::', // 6to4 → 169.254.169.254
      '2001:0:0:0:0:0:0:1', // Teredo 2001::/32
      '2001:db8::1', // documentation
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it('allows public IPv6 (incl. NAT64/6to4 wrapping a PUBLIC v4)', () => {
    expect(isBlockedIp('2606:4700:4700::1111')).toBe(false);
    expect(isBlockedIp('2002:0808:0808::'), '6to4 of 8.8.8.8').toBe(false); // 8.8.8.8 public
  });
});

describe('ssrfGuard.assertUrlIsSafe — IPv6-mapped bracket hosts (real bypass attempts)', () => {
  it('rejects bracketed IPv4-mapped metadata/loopback hosts', async () => {
    for (const u of [
      'http://[::ffff:169.254.169.254]/latest/meta-data/',
      'http://[::ffff:127.0.0.1]/',
      'http://[0:0:0:0:0:ffff:127.0.0.1]/',
      'http://[64:ff9b::a9fe:a9fe]/',
    ]) {
      await expect(assertUrlIsSafe(u), u).rejects.toBeInstanceOf(SsrfBlockedError);
    }
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
