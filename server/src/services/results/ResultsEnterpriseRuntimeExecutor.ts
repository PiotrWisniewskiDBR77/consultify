import logger from '../../utils/Logger.js';
import { resultsEnterpriseService } from '../resultsEnterpriseService.js';

export class ResultsEnterpriseRuntimeExecutor {
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;

  start(intervalMs = 60_000): void {
    if (this.intervalId) return;
    logger.info(`[ResultsEnterpriseRuntime] Starting executor, interval=${intervalMs}ms`);
    void this.tick();
    this.intervalId = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  stop(): void {
    if (!this.intervalId) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await resultsEnterpriseService.runDueWork();
      const connectorCount = Array.isArray(result.connectors) ? result.connectors.length : 0;
      const scheduleCount = Array.isArray(result.schedules) ? result.schedules.length : 0;
      if (connectorCount || scheduleCount) {
        logger.info('[ResultsEnterpriseRuntime] Executed due work', {
          connectors: connectorCount,
          schedules: scheduleCount,
        });
      }
    } catch (error: any) {
      logger.error('[ResultsEnterpriseRuntime] Tick failed', { error: error?.message || error });
    } finally {
      this.running = false;
    }
  }
}

export const resultsEnterpriseRuntimeExecutor = new ResultsEnterpriseRuntimeExecutor();
