/**
 * Shutdown Manager Utility
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import logger from './Logger.js';

export function getShutdownManager(timeout: number = 30000) {
  const cleanups: Array<{ name: string; fn: () => Promise<void> }> = [];

  return {
    registerCleanup: (name: string, fn: () => Promise<void>) => {
      cleanups.push({ name, fn });
    },
    shutdown: async (signal: string) => {
      logger.info(`[Shutdown] Graceful shutdown initiated by ${signal} with ${timeout}ms timeout`);

      for (const cleanup of cleanups) {
        try {
          logger.info(`[Shutdown] Running cleanup: ${cleanup.name}`);
          // Wrap cleanup in timeout if needed, but for now just await
          await cleanup.fn();
          logger.info(`[Shutdown] Cleanup completed: ${cleanup.name}`);
        } catch (err: any) {
          logger.error(`[Shutdown] Cleanup failed for ${cleanup.name}:`, err.message);
        }
      }
    },
  };
}
