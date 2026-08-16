import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';

export interface BackupArtifactManifest {
  format: 'consultify-pg-backup-v1';
  algorithm: 'aes-256-gcm';
  createdAt: string;
  sourceLastWriteAt: string;
  plaintextSha256: string;
  ciphertextSha256: string;
  ivHex: string;
  authTagHex: string;
  sizeBytes: number;
}

const sha256 = (value: Buffer): string => createHash('sha256').update(value).digest('hex');

function parseKey(keyHex: string): Buffer {
  if (!/^[a-fA-F0-9]{64}$/.test(keyHex)) {
    throw new Error('BACKUP_ENCRYPTION_KEY_HEX must contain exactly 64 hexadecimal characters.');
  }
  return Buffer.from(keyHex, 'hex');
}

export function encryptBackupArtifact(params: {
  inputPath: string;
  outputPath: string;
  manifestPath: string;
  keyHex: string;
  sourceLastWriteAt: string;
  now?: Date;
}): BackupArtifactManifest {
  const plaintext = fs.readFileSync(params.inputPath);
  if (plaintext.length === 0) throw new Error('Backup artifact is empty.');
  const sourceLastWriteAt = new Date(params.sourceLastWriteAt);
  if (!Number.isFinite(sourceLastWriteAt.getTime())) throw new Error('Invalid sourceLastWriteAt.');

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', parseKey(params.keyHex), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const manifest: BackupArtifactManifest = {
    format: 'consultify-pg-backup-v1',
    algorithm: 'aes-256-gcm',
    createdAt: (params.now ?? new Date()).toISOString(),
    sourceLastWriteAt: sourceLastWriteAt.toISOString(),
    plaintextSha256: sha256(plaintext),
    ciphertextSha256: sha256(ciphertext),
    ivHex: iv.toString('hex'),
    authTagHex: cipher.getAuthTag().toString('hex'),
    sizeBytes: ciphertext.length,
  };
  fs.writeFileSync(params.outputPath, ciphertext, { mode: 0o600 });
  fs.writeFileSync(params.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return manifest;
}

export function decryptBackupArtifact(params: {
  inputPath: string;
  outputPath: string;
  manifestPath: string;
  keyHex: string;
}): BackupArtifactManifest {
  const ciphertext = fs.readFileSync(params.inputPath);
  const manifest = JSON.parse(fs.readFileSync(params.manifestPath, 'utf8')) as BackupArtifactManifest;
  if (manifest.format !== 'consultify-pg-backup-v1' || manifest.algorithm !== 'aes-256-gcm') {
    throw new Error('Unsupported backup artifact manifest.');
  }
  if (ciphertext.length !== manifest.sizeBytes || sha256(ciphertext) !== manifest.ciphertextSha256) {
    throw new Error('Backup ciphertext checksum mismatch.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    parseKey(params.keyHex),
    Buffer.from(manifest.ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(manifest.authTagHex, 'hex'));
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  if (sha256(plaintext) !== manifest.plaintextSha256) {
    throw new Error('Backup plaintext checksum mismatch.');
  }
  fs.writeFileSync(params.outputPath, plaintext, { mode: 0o600 });
  return manifest;
}

export function recoveryObjectives(manifest: BackupArtifactManifest, restoredAt: Date) {
  return {
    rpoMs: new Date(manifest.createdAt).getTime() - new Date(manifest.sourceLastWriteAt).getTime(),
    rtoMs: restoredAt.getTime() - new Date(manifest.createdAt).getTime(),
    rpoPass: new Date(manifest.createdAt).getTime() - new Date(manifest.sourceLastWriteAt).getTime() <= 15 * 60 * 1000,
    rtoPass: restoredAt.getTime() - new Date(manifest.createdAt).getTime() <= 60 * 60 * 1000,
  };
}
