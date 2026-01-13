/**
 * Alert Aggregator Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Aggregates and deduplicates alerts to prevent alert spam
 * Implements rate limiting and priority system
 */

import logger from '../utils/Logger.js';
import alertingService from './ai/alerting.js';
import { getAlertEmailService } from './AlertEmailService.js';

// ==========================================
// TYPES
// ==========================================

interface AggregatedAlert {
  alertType: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  count: number; // Number of times this alert occurred
  firstOccurrence: number; // Timestamp of first occurrence
  lastOccurrence: number; // Timestamp of last occurrence
  data: Record<string, unknown>;
  recipients: string[];
}

interface AlertGroup {
  key: string;
  alert: AggregatedAlert;
  suppressed: boolean;
  suppressedUntil: number | null;
}

// ==========================================
// CONFIGURATION
// ==========================================

const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes default
const DEDUPLICATION_WINDOW_MS = 60 * 1000; // 1 minute window for deduplication
const MAX_ALERTS_PER_WINDOW = 10; // Max alerts per window before suppression

// ==========================================
// ALERT AGGREGATOR CLASS
// ==========================================

class AlertAggregator {
  private alertGroups: Map<string, AlertGroup> = new Map();
  private alertHistory: AggregatedAlert[] = [];
  private maxHistorySize: number;
  private rateLimitMs: number;
  private deduplicationWindowMs: number;

  constructor(
    options: {
      maxHistorySize?: number;
      rateLimitMs?: number;
      deduplicationWindowMs?: number;
    } = {}
  ) {
    this.maxHistorySize = options.maxHistorySize || 1000;
    this.rateLimitMs = options.rateLimitMs || RATE_LIMIT_MS;
    this.deduplicationWindowMs = options.deduplicationWindowMs || DEDUPLICATION_WINDOW_MS;
  }

  /**
   * Generate alert key for deduplication
   */
  private generateAlertKey(alertType: string, data: Record<string, unknown>): string {
    // Create a key based on alert type and key data fields
    const keyFields = ['providerId', 'organizationId', 'userId', 'error'];
    const keyParts = [alertType];

    keyFields.forEach((field) => {
      if (data[field]) {
        keyParts.push(`${field}:${data[field]}`);
      }
    });

    return keyParts.join('|');
  }

  /**
   * Process and aggregate alert
   */
  async processAlert(
    alertType: string,
    severity: 'info' | 'warning' | 'error' | 'critical',
    title: string,
    message: string,
    data: Record<string, unknown> = {}
  ): Promise<boolean> {
    const now = Date.now();
    const alertKey = this.generateAlertKey(alertType, data);

    // Get or create alert group
    let group = this.alertGroups.get(alertKey);

    if (!group) {
      // New alert
      group = {
        key: alertKey,
        alert: {
          alertType,
          severity,
          title,
          message,
          count: 1,
          firstOccurrence: now,
          lastOccurrence: now,
          data,
          recipients: [],
        },
        suppressed: false,
        suppressedUntil: null,
      };
      this.alertGroups.set(alertKey, group);
    } else {
      // Existing alert - update count and timestamp
      group.alert.count++;
      group.alert.lastOccurrence = now;

      // Check if alert is suppressed
      if (group.suppressed && group.suppressedUntil && now < group.suppressedUntil) {
        logger.debug(
          `[AlertAggregator] Alert suppressed: ${alertKey} (until ${new Date(group.suppressedUntil).toISOString()})`
        );
        return false;
      }

      // Check rate limiting
      const timeSinceLastAlert = now - group.alert.lastOccurrence;
      if (timeSinceLastAlert < this.rateLimitMs) {
        logger.debug(
          `[AlertAggregator] Alert rate limited: ${alertKey} (last sent ${Math.round(timeSinceLastAlert / 1000)}s ago)`
        );
        return false;
      }

      // Check if alert is flooding (too many in short time)
      const timeSinceFirst = now - group.alert.firstOccurrence;
      if (
        timeSinceFirst < this.deduplicationWindowMs &&
        group.alert.count > MAX_ALERTS_PER_WINDOW
      ) {
        // Suppress for extended period
        group.suppressed = true;
        group.suppressedUntil = now + this.rateLimitMs * 2; // Suppress for 2x rate limit
        logger.warn(
          `[AlertAggregator] Alert flooding detected, suppressing: ${alertKey} (${group.alert.count} alerts in ${Math.round(timeSinceFirst / 1000)}s)`
        );
        return false;
      }

      // Reset suppression if window passed
      if (timeSinceFirst > this.deduplicationWindowMs) {
        group.suppressed = false;
        group.suppressedUntil = null;
        group.alert.firstOccurrence = now; // Reset window
        group.alert.count = 1; // Reset count
      }
    }

    // Send aggregated alert
    return await this.sendAggregatedAlert(group.alert);
  }

  /**
   * Send aggregated alert
   */
  private async sendAggregatedAlert(alert: AggregatedAlert): Promise<boolean> {
    // Enhance message with aggregation info if count > 1
    let enhancedMessage = alert.message;
    if (alert.count > 1) {
      enhancedMessage += `\n\nThis alert has occurred ${alert.count} time(s) since ${new Date(alert.firstOccurrence).toLocaleString()}.`;
    }

    // Send via alerting service
    try {
      await alertingService.send(alert.alertType as any, {
        ...alert.data,
        aggregatedCount: alert.count,
        firstOccurrence: alert.firstOccurrence,
      });

      // Also send email for critical/error alerts
      if (alert.severity === 'critical' || alert.severity === 'error') {
        const emailService = getAlertEmailService();
        await emailService.sendAlert({
          alertType: alert.alertType,
          severity: alert.severity,
          title: alert.title,
          message: enhancedMessage,
          timestamp: new Date(alert.lastOccurrence).toISOString(),
          data: {
            ...alert.data,
            count: alert.count,
            firstOccurrence: new Date(alert.firstOccurrence).toISOString(),
          },
          environment: process.env.NODE_ENV || 'unknown',
        });
      }

      // Add to history
      this.addToHistory(alert);

      return true;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[AlertAggregator] Failed to send aggregated alert:', err);
      return false;
    }
  }

  /**
   * Add alert to history
   */
  private addToHistory(alert: AggregatedAlert): void {
    this.alertHistory.push({ ...alert });
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory.shift();
    }
  }

  /**
   * Get alert statistics
   */
  getStats(): {
    totalAlerts: number;
    activeGroups: number;
    suppressedGroups: number;
    recentAlerts: number;
  } {
    const now = Date.now();
    const recentWindow = 60 * 60 * 1000; // Last hour

    const suppressedGroups = Array.from(this.alertGroups.values()).filter(
      (g) => g.suppressed && g.suppressedUntil && now < g.suppressedUntil
    ).length;

    const recentAlerts = this.alertHistory.filter(
      (a) => now - a.lastOccurrence < recentWindow
    ).length;

    return {
      totalAlerts: this.alertHistory.length,
      activeGroups: this.alertGroups.size,
      suppressedGroups,
      recentAlerts,
    };
  }

  /**
   * Get alert history
   */
  getHistory(limit = 100): AggregatedAlert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Clear old alert groups
   */
  clearOldGroups(maxAgeMs = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.alertGroups.forEach((group, key) => {
      if (now - group.alert.lastOccurrence > maxAgeMs) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.alertGroups.delete(key));

    if (keysToDelete.length > 0) {
      logger.debug(`[AlertAggregator] Cleared ${keysToDelete.length} old alert groups`);
    }
  }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

let instance: AlertAggregator | null = null;

export function getAlertAggregator(): AlertAggregator {
  if (!instance) {
    instance = new AlertAggregator();
    // Clean up old groups every hour
    setInterval(
      () => {
        instance?.clearOldGroups();
      },
      60 * 60 * 1000
    );
  }
  return instance;
}

// ==========================================
// EXPORTS
// ==========================================

export default AlertAggregator;
export type { AggregatedAlert, AlertGroup };
