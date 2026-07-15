import crypto from 'crypto';

import {
  INVITATION_EXPIRY_DAYS,
  INVITATION_TOKEN_HEX_LENGTH,
  TOKEN_LENGTH_BYTES,
} from './InvitationTypes.js';

export interface InvitationTokenDependencies {
  crypto: typeof crypto;
}

export class InvitationTokenService {
  private deps: InvitationTokenDependencies;

  constructor(deps?: Partial<InvitationTokenDependencies>) {
    this.deps = {
      crypto: deps?.crypto ?? crypto,
    };
  }

  /**
   * Update dependencies after construction (e.g. test DI injecting a mock crypto).
   * See InvitationDataService.setDependencies for why this is needed.
   */
  setDependencies(newDeps: Partial<InvitationTokenDependencies>): void {
    this.deps = { ...this.deps, ...newDeps };
  }

  /**
   * Generate a cryptographically secure token
   */
  generateSecureToken(): string {
    return this.deps.crypto.randomBytes(TOKEN_LENGTH_BYTES).toString('hex');
  }

  /**
   * Hash a token for secure storage
   */
  hashToken(token: string): string {
    return this.deps.crypto.createHash('sha256').update(token).digest('hex');
  }

  isCanonicalInvitationRawToken(token: unknown): token is string {
    if (typeof token !== 'string') return false;
    const normalized = token.trim();
    return normalized.length === INVITATION_TOKEN_HEX_LENGTH && /^[a-fA-F0-9]+$/.test(normalized);
  }

  /**
   * Calculate expiration date
   */
  calculateExpiryDate(days: number = INVITATION_EXPIRY_DAYS): string {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }
}
