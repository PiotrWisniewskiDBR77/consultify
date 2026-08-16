import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  decryptBackupArtifact,
  encryptBackupArtifact,
  recoveryObjectives,
} from '../../../server/scripts/lib/encryptedBackupArtifact.js';

const dirs: string[] = [];
const temp = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'consultify-dr-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

describe('DATA-DR-001 encrypted backup artifact', () => {
  it('encrypts, checksums and restores exact bytes within RPO/RTO targets', () => {
    const dir = temp();
    const input = path.join(dir, 'dump.sql.gz');
    const encrypted = path.join(dir, 'dump.enc');
    const manifest = path.join(dir, 'manifest.json');
    const restored = path.join(dir, 'restored.sql.gz');
    fs.writeFileSync(input, Buffer.from('tenant-a\ntenant-b\n'));
    const createdAt = new Date('2026-08-16T20:10:00.000Z');
    const metadata = encryptBackupArtifact({ inputPath: input, outputPath: encrypted, manifestPath: manifest, keyHex: 'ab'.repeat(32), sourceLastWriteAt: '2026-08-16T20:00:00.000Z', now: createdAt });
    decryptBackupArtifact({ inputPath: encrypted, outputPath: restored, manifestPath: manifest, keyHex: 'ab'.repeat(32) });
    expect(fs.readFileSync(restored)).toEqual(fs.readFileSync(input));
    expect(recoveryObjectives(metadata, new Date('2026-08-16T20:40:00.000Z'))).toMatchObject({ rpoPass: true, rtoPass: true, rpoMs: 600_000, rtoMs: 1_800_000 });
  });

  it('rejects a corrupted or incomplete artifact before writing restored bytes', () => {
    const dir = temp();
    const input = path.join(dir, 'dump');
    const encrypted = path.join(dir, 'dump.enc');
    const manifest = path.join(dir, 'manifest.json');
    const restored = path.join(dir, 'restored');
    fs.writeFileSync(input, 'valid backup');
    encryptBackupArtifact({ inputPath: input, outputPath: encrypted, manifestPath: manifest, keyHex: 'cd'.repeat(32), sourceLastWriteAt: new Date().toISOString() });
    fs.truncateSync(encrypted, Math.max(0, fs.statSync(encrypted).size - 1));
    expect(() => decryptBackupArtifact({ inputPath: encrypted, outputPath: restored, manifestPath: manifest, keyHex: 'cd'.repeat(32) })).toThrow('checksum mismatch');
    expect(fs.existsSync(restored)).toBe(false);
  });

  it('rejects an incorrect encryption key through authenticated decryption', () => {
    const dir = temp();
    const input = path.join(dir, 'dump');
    const encrypted = path.join(dir, 'dump.enc');
    const manifest = path.join(dir, 'manifest.json');
    fs.writeFileSync(input, 'valid backup');
    encryptBackupArtifact({ inputPath: input, outputPath: encrypted, manifestPath: manifest, keyHex: 'ef'.repeat(32), sourceLastWriteAt: new Date().toISOString() });
    expect(() => decryptBackupArtifact({ inputPath: encrypted, outputPath: path.join(dir, 'restored'), manifestPath: manifest, keyHex: '01'.repeat(32) })).toThrow();
  });
});
