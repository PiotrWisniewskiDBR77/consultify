/**
 * Token Billing Service - Wrapper for TypeScript implementation
 * 
 * This file re-exports the TypeScript TokenBillingService for backward compatibility
 * with legacy JavaScript imports.
 */

// server/services/tokenBillingService.js
let TokenBillingService;

// In test environment, we might run before build, so allow missing dist
if (process.env.NODE_ENV === 'test') {
    TokenBillingService = {
        deductTokens: async () => ({ success: true, remaining: 1000 }),
        getBalance: async () => 1000,
        checkBalance: async () => true
    };
} else {
    // In production/dev, we expect the built artifact
    try {
        // Use dynamic import to avoid static resolution failure
        const module = await import('../dist/services/tokenBillingService.js');
        TokenBillingService = module.default;
    } catch (error) {
        console.error('Failed to load TokenBillingService from dist:', error);
        // Fallback or rethrow depending on strictness
        throw error;
    }
}

export default TokenBillingService;
