# Encryption Configuration Guide

## Overview

Consultify implements field-level encryption for PII (Personally Identifiable Information) and sensitive data using AES-256-GCM encryption.

## Features

- **AES-256-GCM**: Authenticated encryption with strong security guarantees
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Key Rotation**: Support for multiple key versions
- **Deterministic Encryption**: For searchable encrypted fields
- **PII Auto-Encryption**: Automatic encryption of sensitive fields

## Environment Variables

### Required for Production

```bash
# Primary encryption key (32 bytes, hex encoded)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your-64-character-hex-key

# Salt for key derivation (32 bytes, hex encoded)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_SALT=your-64-character-hex-salt
```

### Optional (Key Rotation)

```bash
# Key creation date (ISO 8601, for rotation tracking)
ENCRYPTION_KEY_CREATED_AT=2026-01-01T00:00:00Z

# Previous keys (keep for decrypting old data)
ENCRYPTION_KEY_V2=previous-key-hex
ENCRYPTION_KEY_V3=older-key-hex
```

## Key Generation

### Generate Encryption Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Generate Salt
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## PII Fields (Auto-Encrypted)

The following fields are automatically encrypted when using `encryptPII()`:

- `email` (deterministic - searchable)
- `phone`, `phoneNumber`, `mobile`
- `address`, `street`, `city`, `postalCode`, `zipCode`
- `ssn`, `pesel`, `nip`, `taxId`
- `bankAccount`, `iban`, `creditCard`
- `dateOfBirth`, `birthDate`

## Usage

### Basic Encryption

```typescript
import { encrypt, decrypt } from './services/encryption/EncryptionService';

const encrypted = encrypt('sensitive data');
const decrypted = decrypt(encrypted);
```

### PII Encryption

```typescript
import { encryptPII, decryptPII } from './services/encryption/EncryptionService';

const user = {
  name: 'John Doe',
  email: 'john@example.com',  // Will be encrypted
  phone: '+1234567890',        // Will be encrypted
};

const encryptedUser = encryptPII(user);
const decryptedUser = decryptPII(encryptedUser);
```

### Deterministic Encryption (Searchable)

```typescript
import { encryptDeterministic, hashForIndex } from './services/encryption/EncryptionService';

// Same input always produces same output
const encrypted = encryptDeterministic('search@example.com');

// Or use hash for blind index
const indexHash = hashForIndex('search@example.com');
```

### File Encryption

```typescript
import { encryptBuffer, decryptBuffer } from './services/encryption/EncryptionService';

const encrypted = encryptBuffer(fileBuffer);
const decrypted = decryptBuffer(encrypted);
```

## Key Rotation

### Step 1: Generate New Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 2: Update Environment
```bash
# Rename current key
ENCRYPTION_KEY_V1=old-key-value

# Set new key as primary
ENCRYPTION_KEY=new-key-value
ENCRYPTION_KEY_CREATED_AT=2026-01-15T00:00:00Z
```

### Step 3: Re-encrypt Data
```bash
npm run migrate:reencrypt
```

### Step 4: Cleanup (After Grace Period)
After 30 days, remove old key version if no longer needed.

## Health Check

Check encryption status via API:

```bash
curl http://localhost:3001/api/system-health/encryption
```

Response:
```json
{
  "healthy": true,
  "currentKeyVersion": 1,
  "keyStatus": {
    "exists": true,
    "status": "active",
    "daysUntilExpiry": 75,
    "needsRotation": false,
    "warningNeeded": false
  }
}
```

## Security Best Practices

1. **Never commit encryption keys** to version control
2. **Use environment variables** or secrets management (Vault, AWS KMS)
3. **Rotate keys regularly** (every 90 days recommended)
4. **Keep old keys** for grace period to decrypt existing data
5. **Monitor key expiry** via health check endpoint
6. **Audit key usage** via KeyManagementService

## Development Mode

In development, if no `ENCRYPTION_KEY` is set, a deterministic fallback key is used.
This is **NOT SECURE** and must never be used in production.

Warning message will appear:
```
[Encryption] No ENCRYPTION_KEY set. Using development fallback key.
[Encryption] SET ENCRYPTION_KEY in production!
```

## Integration with External KMS

The `KeyManagementService` is designed to be extended for external KMS integration:

- AWS KMS
- HashiCorp Vault
- Azure Key Vault
- Google Cloud KMS

Contact the development team for enterprise KMS integration.








