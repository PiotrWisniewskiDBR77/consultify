/**
 * Consultify PMO Application - Backend Entry Point
 *
 * This is the entry point for the Consultify backend application.
 * The actual implementation lives in the root /server directory
 * during the migration period.
 *
 * @see /server/src/index.ts for the main backend implementation
 */

console.log('[Consultify Backend] Starting application...');

// Re-export from main server during migration period
// After full migration, move server code here
export * from '../../../../server/src/index.js';

console.log('[Consultify Backend] Application bootstrapped');



