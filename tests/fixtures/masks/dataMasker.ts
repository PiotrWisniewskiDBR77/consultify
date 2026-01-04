/**
 * Data Masking Utilities
 * Masks sensitive data in test fixtures to prevent accidental exposure
 */

export class DataMasker {
  /**
   * Mask email address
   */
  static maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    const maskedLocal = localPart.length > 2 
      ? `${localPart[0]}***${localPart[localPart.length - 1]}`
      : '***';
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Mask phone number
   */
  static maskPhone(phone: string): string {
    // Keep last 4 digits, mask the rest
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 4) return '***';
    return `***-***-${cleaned.slice(-4)}`;
  }

  /**
   * Mask credit card number
   */
  static maskCreditCard(cardNumber: string): string {
    const cleaned = cardNumber.replace(/\D/g, '');
    if (cleaned.length < 4) return '****';
    return `****-****-****-${cleaned.slice(-4)}`;
  }

  /**
   * Mask SSN
   */
  static maskSSN(ssn: string): string {
    const cleaned = ssn.replace(/\D/g, '');
    if (cleaned.length !== 9) return '***-**-****';
    return `***-**-${cleaned.slice(-4)}`;
  }

  /**
   * Mask IP address
   */
  static maskIP(ip: string): string {
    return ip.replace(/\d+\.\d+\.\d+/, '***.***.***');
  }

  /**
   * Mask API key
   */
  static maskApiKey(key: string): string {
    if (key.length < 8) return '***';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }

  /**
   * Mask password (always returns masked)
   */
  static maskPassword(): string {
    return '***MASKED***';
  }

  /**
   * Mask object with sensitive fields
   */
  static maskObject<T extends Record<string, any>>(obj: T, sensitiveFields: string[]): T {
    const masked = { ...obj };
    sensitiveFields.forEach(field => {
      if (field in masked) {
        if (field.includes('email')) {
          masked[field] = this.maskEmail(String(masked[field]));
        } else if (field.includes('phone')) {
          masked[field] = this.maskPhone(String(masked[field]));
        } else if (field.includes('password')) {
          masked[field] = this.maskPassword();
        } else if (field.includes('apiKey') || field.includes('api_key')) {
          masked[field] = this.maskApiKey(String(masked[field]));
        } else {
          masked[field] = '***MASKED***';
        }
      }
    });
    return masked;
  }

  /**
   * Mask array of objects
   */
  static maskArray<T extends Record<string, any>>(
    arr: T[],
    sensitiveFields: string[]
  ): T[] {
    return arr.map(obj => this.maskObject(obj, sensitiveFields));
  }
}




