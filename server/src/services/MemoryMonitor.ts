/**
 * Memory Monitor Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Monitors memory usage and detects potential memory leaks
 * Alerts when memory growth exceeds thresholds
 */

import logger from '../utils/Logger.js';
import { getMetricsService } from './metricsService.js';
import { memoryUsageBytes } from './metricsService.js';

// ==========================================
// TYPES
// ==========================================

interface MemorySample {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

interface MemoryLeakAlert {
  detected: boolean;
  growthPercent: number;
  timeWindow: number; // milliseconds
  currentHeap: number;
  baselineHeap: number;
  recommendation: string;
}

// ==========================================
// MEMORY MONITOR CLASS
// ==========================================

class MemoryMonitor {
  private samples: MemorySample[] = [];
  private maxSamples: number;
  private checkInterval: NodeJS.Timeout | null = null;
  private baseline: MemorySample | null = null;
  private leakThreshold: number; // Percentage growth threshold
  private timeWindow: number; // Time window in milliseconds

  constructor(
    options: {
      maxSamples?: number;
      checkIntervalMs?: number;
      leakThresholdPercent?: number;
      timeWindowMs?: number;
    } = {}
  ) {
    this.maxSamples = options.maxSamples || 100;
    this.leakThreshold = options.leakThresholdPercent || 20; // 20% growth threshold
    this.timeWindow = options.timeWindowMs || 3600000; // 1 hour default

    const checkInterval = options.checkIntervalMs || 30000; // 30 seconds default
    this.startMonitoring(checkInterval);
  }

  /**
   * Start memory monitoring
   */
  startMonitoring(intervalMs: number): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Record baseline
    this.recordSample();

    // Start periodic checks
    this.checkInterval = setInterval(() => {
      this.recordSample();
      this.checkForLeaks();
    }, intervalMs);
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Record a memory sample
   */
  recordSample(): void {
    const usage = process.memoryUsage();
    const sample: MemorySample = {
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
    };

    // Set baseline if not set
    if (!this.baseline) {
      this.baseline = sample;
    }

    // Add to samples
    this.samples.push(sample);

    // Keep only last N samples
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    // Update Prometheus metrics
    const metricsService = getMetricsService();
    metricsService.updateMemoryMetrics();
  }

  /**
   * Check for memory leaks
   */
  checkForLeaks(): MemoryLeakAlert | null {
    if (this.samples.length < 2) {
      return null;
    }

    const now = Date.now();
    const windowStart = now - this.timeWindow;

    // Find samples within time window
    const windowSamples = this.samples.filter((s) => s.timestamp >= windowStart);

    if (windowSamples.length < 2) {
      return null; // Not enough data
    }

    const oldest = windowSamples[0];
    const newest = windowSamples[windowSamples.length - 1];

    // Calculate growth
    const growth = newest.heapUsed - oldest.heapUsed;
    const growthPercent = (growth / oldest.heapUsed) * 100;
    const timeDiff = newest.timestamp - oldest.timestamp;

    // Check if growth exceeds threshold
    if (growthPercent > this.leakThreshold) {
      const alert: MemoryLeakAlert = {
        detected: true,
        growthPercent: Math.round(growthPercent * 100) / 100,
        timeWindow: timeDiff,
        currentHeap: newest.heapUsed,
        baselineHeap: oldest.heapUsed,
        recommendation: this.getRecommendation(growthPercent, timeDiff),
      };

      // Log alert
      logger.warn('[MemoryMonitor] Potential memory leak detected:', {
        growthPercent: alert.growthPercent + '%',
        timeWindow: `${Math.round(timeDiff / 1000 / 60)} minutes`,
        currentHeap: `${(alert.currentHeap / 1024 / 1024).toFixed(2)} MB`,
        baselineHeap: `${(alert.baselineHeap / 1024 / 1024).toFixed(2)} MB`,
        recommendation: alert.recommendation,
      });

      return alert;
    }

    return null;
  }

  /**
   * Get recommendation based on memory growth
   */
  private getRecommendation(growthPercent: number, timeWindow: number): string {
    const hours = timeWindow / 3600000;

    if (growthPercent > 50) {
      return `Critical: Memory growth of ${growthPercent.toFixed(2)}% over ${hours.toFixed(2)} hours. Immediate investigation required.`;
    } else if (growthPercent > 30) {
      return `High: Memory growth of ${growthPercent.toFixed(2)}% over ${hours.toFixed(2)} hours. Review memory usage patterns.`;
    } else {
      return `Warning: Memory growth of ${growthPercent.toFixed(2)}% over ${hours.toFixed(2)} hours. Monitor closely.`;
    }
  }

  /**
   * Get current memory statistics
   */
  getStats(): {
    current: MemorySample | null;
    baseline: MemorySample | null;
    samples: number;
    growthSinceBaseline: number;
  } {
    const current = this.samples.length > 0 ? this.samples[this.samples.length - 1] : null;
    const growthSinceBaseline =
      current && this.baseline
        ? ((current.heapUsed - this.baseline.heapUsed) / this.baseline.heapUsed) * 100
        : 0;

    return {
      current,
      baseline: this.baseline,
      samples: this.samples.length,
      growthSinceBaseline: Math.round(growthSinceBaseline * 100) / 100,
    };
  }

  /**
   * Reset baseline
   */
  resetBaseline(): void {
    if (this.samples.length > 0) {
      const current = this.samples[this.samples.length - 1];
      this.baseline = current;
      // A reset starts a new observation window. Keeping samples from the
      // previous window made checkForLeaks() compare against stale history,
      // even though getStats() reported the new baseline.
      this.samples = [current];
    }
  }

  /**
   * Get memory trend over time
   */
  getTrend(): Array<{ timestamp: number; heapUsed: number }> {
    return this.samples.map((s) => ({
      timestamp: s.timestamp,
      heapUsed: s.heapUsed,
    }));
  }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

let instance: MemoryMonitor | null = null;

export function getMemoryMonitor(options?: {
  maxSamples?: number;
  checkIntervalMs?: number;
  leakThresholdPercent?: number;
  timeWindowMs?: number;
}): MemoryMonitor {
  if (!instance) {
    instance = new MemoryMonitor(options);
  }
  return instance;
}

// ==========================================
// EXPORTS
// ==========================================

export default MemoryMonitor;
export type { MemoryLeakAlert, MemorySample };
