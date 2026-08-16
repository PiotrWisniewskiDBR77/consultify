#!/usr/bin/env tsx
import process from 'node:process';

import { decryptBackupArtifact, encryptBackupArtifact } from './lib/encryptedBackupArtifact.js';

const [operation, inputPath, outputPath, manifestPath, sourceLastWriteAt] = process.argv.slice(2);
const keyHex = process.env.BACKUP_ENCRYPTION_KEY_HEX || '';

try {
  if (operation === 'encrypt') {
    const manifest = encryptBackupArtifact({
      inputPath,
      outputPath,
      manifestPath,
      keyHex,
      sourceLastWriteAt,
    });
    console.log(JSON.stringify(manifest));
  } else if (operation === 'decrypt') {
    const manifest = decryptBackupArtifact({ inputPath, outputPath, manifestPath, keyHex });
    console.log(JSON.stringify(manifest));
  } else {
    throw new Error('Usage: backup-artifact-crypto.ts encrypt|decrypt INPUT OUTPUT MANIFEST [SOURCE_LAST_WRITE_AT]');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
