/**
 * User API Provider Contract Tests
 * Verifies that the backend implementation matches consumer contracts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Verifier } from '@pact-foundation/pact';
import path from 'path';

describe('User API Provider Contract Verification', () => {
  it('should verify contracts', async () => {
    const verifier = new Verifier({
      provider: 'consultify-backend',
      providerBaseUrl: 'http://localhost:3000',
      pactUrls: [
        path.resolve(process.cwd(), 'tests/contracts/pacts/consultify-frontend-consultify-backend.json'),
      ],
      // Optional: Publish verification results to Pact Broker
      publishVerificationResult: process.env.CI === 'true',
      providerVersion: process.env.GIT_COMMIT || '1.0.0',
    });

    await verifier.verifyProvider();
  });
});






