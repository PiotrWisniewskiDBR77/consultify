import crypto from 'crypto';

import { INVITATION_EXPIRY_DAYS, TOKEN_LENGTH_BYTES } from './InvitationTypes.js';

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

    /**
     * Calculate expiration date
     */
    calculateExpiryDate(days: number = INVITATION_EXPIRY_DAYS): string {
        return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }
}
