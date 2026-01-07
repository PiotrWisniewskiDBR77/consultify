/**
 * Error Monitoring and Logging Tests
 * Tests for error tracking, monitoring, and alerting
 * 
 * @module tests/monitoring/error-monitor.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Error tracker
const createErrorTracker = (options = {}) => {
    const { maxErrors = 1000, sampleRate = 1 } = options;
    const errors = [];
    const fingerprints = new Map(); // For grouping similar errors
    const listeners = [];

    const generateFingerprint = (error) => {
        const stack = error.stack || '';
        const firstLine = stack.split('\n')[1] || '';
        return `${error.name}:${error.message}:${firstLine}`.slice(0, 200);
    };

    const shouldCapture = () => Math.random() < sampleRate;

    return {
        capture: (error, context = {}) => {
            if (!shouldCapture()) return null;

            const fingerprint = generateFingerprint(error);
            const existing = fingerprints.get(fingerprint);

            const errorRecord = {
                id: crypto.randomUUID(),
                fingerprint,
                name: error.name,
                message: error.message,
                stack: error.stack,
                context,
                timestamp: Date.now(),
                count: 1,
            };

            if (existing) {
                existing.count++;
                existing.lastOccurrence = Date.now();
                return existing;
            }

            errors.push(errorRecord);
            fingerprints.set(fingerprint, errorRecord);

            // Enforce max errors
            if (errors.length > maxErrors) {
                const removed = errors.shift();
                fingerprints.delete(removed.fingerprint);
            }

            listeners.forEach(fn => fn(errorRecord));

            return errorRecord;
        },

        captureMessage: (message, level = 'error', context = {}) => {
            return this.capture(new Error(message), { ...context, level });
        },

        getErrors: () => [...errors],

        getErrorById: (id) => errors.find(e => e.id === id),

        getErrorsByFingerprint: (fingerprint) => {
            return fingerprints.get(fingerprint) || null;
        },

        getGroupedErrors: () => {
            return [...fingerprints.values()].sort((a, b) => b.count - a.count);
        },

        getErrorCount: () => errors.length,

        getTotalOccurrences: () => {
            return errors.reduce((sum, e) => sum + e.count, 0);
        },

        clear: () => {
            errors.length = 0;
            fingerprints.clear();
        },

        onError: (listener) => {
            listeners.push(listener);
            return () => {
                const idx = listeners.indexOf(listener);
                if (idx !== -1) listeners.splice(idx, 1);
            };
        },
    };
};

// Alert manager
const createAlertManager = () => {
    const rules = new Map();
    const alerts = [];
    const handlers = [];

    return {
        addRule: (id, config) => {
            rules.set(id, {
                id,
                name: config.name,
                condition: config.condition,
                threshold: config.threshold,
                window: config.window || 60000, // 1 minute default
                cooldown: config.cooldown || 300000, // 5 minutes default
                severity: config.severity || 'warning',
                lastTriggered: null,
                enabled: true,
            });
        },

        removeRule: (id) => rules.delete(id),

        enableRule: (id) => {
            const rule = rules.get(id);
            if (rule) rule.enabled = true;
        },

        disableRule: (id) => {
            const rule = rules.get(id);
            if (rule) rule.enabled = false;
        },

        checkRule: (id, value) => {
            const rule = rules.get(id);
            if (!rule || !rule.enabled) return null;

            const now = Date.now();
            if (rule.lastTriggered && now - rule.lastTriggered < rule.cooldown) {
                return null;
            }

            let triggered = false;
            switch (rule.condition) {
                case 'gt': triggered = value > rule.threshold; break;
                case 'gte': triggered = value >= rule.threshold; break;
                case 'lt': triggered = value < rule.threshold; break;
                case 'lte': triggered = value <= rule.threshold; break;
                case 'eq': triggered = value === rule.threshold; break;
            }

            if (triggered) {
                rule.lastTriggered = now;
                const alert = {
                    id: crypto.randomUUID(),
                    ruleId: id,
                    ruleName: rule.name,
                    severity: rule.severity,
                    value,
                    threshold: rule.threshold,
                    timestamp: now,
                    acknowledged: false,
                };
                alerts.push(alert);
                handlers.forEach(fn => fn(alert));
                return alert;
            }

            return null;
        },

        acknowledge: (alertId) => {
            const alert = alerts.find(a => a.id === alertId);
            if (alert) {
                alert.acknowledged = true;
                alert.acknowledgedAt = Date.now();
                return true;
            }
            return false;
        },

        getAlerts: (filter = {}) => {
            let result = [...alerts];
            if (filter.severity) {
                result = result.filter(a => a.severity === filter.severity);
            }
            if (filter.acknowledged !== undefined) {
                result = result.filter(a => a.acknowledged === filter.acknowledged);
            }
            return result.sort((a, b) => b.timestamp - a.timestamp);
        },

        getActiveAlerts: () => this.getAlerts({ acknowledged: false }),

        onAlert: (handler) => {
            handlers.push(handler);
            return () => {
                const idx = handlers.indexOf(handler);
                if (idx !== -1) handlers.splice(idx, 1);
            };
        },

        getRules: () => [...rules.values()],
    };
};

// Health checker
const createHealthChecker = () => {
    const checks = new Map();
    const results = new Map();

    return {
        registerCheck: (name, checker, options = {}) => {
            checks.set(name, {
                name,
                checker,
                timeout: options.timeout || 5000,
                critical: options.critical ?? true,
            });
        },

        unregisterCheck: (name) => checks.delete(name),

        runCheck: async (name) => {
            const check = checks.get(name);
            if (!check) return null;

            const start = Date.now();
            try {
                const result = await Promise.race([
                    check.checker(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), check.timeout)
                    ),
                ]);

                const status = {
                    name,
                    status: 'healthy',
                    duration: Date.now() - start,
                    timestamp: Date.now(),
                    result,
                };
                results.set(name, status);
                return status;

            } catch (error) {
                const status = {
                    name,
                    status: 'unhealthy',
                    duration: Date.now() - start,
                    timestamp: Date.now(),
                    error: error.message,
                };
                results.set(name, status);
                return status;
            }
        },

        runAllChecks: async () => {
            const promises = [...checks.keys()].map(name => this.runCheck(name));
            return Promise.all(promises);
        },

        getOverallHealth: () => {
            const allResults = [...results.values()];
            const criticalUnhealthy = allResults.filter(r => {
                const check = checks.get(r.name);
                return check?.critical && r.status === 'unhealthy';
            });

            return {
                status: criticalUnhealthy.length > 0 ? 'unhealthy' : 'healthy',
                checks: allResults,
                timestamp: Date.now(),
            };
        },

        getCheckResult: (name) => results.get(name) || null,
    };
};

// Log aggregator
const createLogAggregator = () => {
    const logs = [];
    const maxLogs = 10000;

    return {
        log: (level, message, metadata = {}) => {
            const entry = {
                id: crypto.randomUUID(),
                level,
                message,
                metadata,
                timestamp: Date.now(),
            };

            logs.push(entry);

            if (logs.length > maxLogs) {
                logs.shift();
            }

            return entry;
        },

        debug: (message, metadata) => this.log('debug', message, metadata),
        info: (message, metadata) => this.log('info', message, metadata),
        warn: (message, metadata) => this.log('warn', message, metadata),
        error: (message, metadata) => this.log('error', message, metadata),

        query: (filters = {}) => {
            let result = [...logs];

            if (filters.level) {
                result = result.filter(l => l.level === filters.level);
            }
            if (filters.since) {
                result = result.filter(l => l.timestamp >= filters.since);
            }
            if (filters.until) {
                result = result.filter(l => l.timestamp <= filters.until);
            }
            if (filters.search) {
                const term = filters.search.toLowerCase();
                result = result.filter(l => l.message.toLowerCase().includes(term));
            }

            return result.sort((a, b) => b.timestamp - a.timestamp);
        },

        getStats: () => {
            const counts = { debug: 0, info: 0, warn: 0, error: 0 };
            logs.forEach(l => counts[l.level]++);
            return {
                total: logs.length,
                ...counts,
            };
        },

        clear: () => {
            logs.length = 0;
        },
    };
};

describe('Error Tracker Tests', () => {
    let tracker;

    beforeEach(() => {
        tracker = createErrorTracker();
    });

    it('should capture error', () => {
        const error = new Error('Test error');
        const record = tracker.capture(error);

        expect(record.message).toBe('Test error');
        expect(record.id).toBeTruthy();
    });

    it('should capture with context', () => {
        const error = new Error('Failed');
        const record = tracker.capture(error, { userId: 'user-1', page: '/home' });

        expect(record.context.userId).toBe('user-1');
    });

    it('should group similar errors', () => {
        const error1 = new Error('Same error');
        const error2 = new Error('Same error');

        tracker.capture(error1);
        tracker.capture(error2);

        const grouped = tracker.getGroupedErrors();
        expect(grouped[0].count).toBe(2);
    });

    it('should notify on new error', () => {
        const handler = vi.fn();
        tracker.onError(handler);

        tracker.capture(new Error('Test'));

        expect(handler).toHaveBeenCalled();
    });

    it('should capture message', () => {
        const record = tracker.captureMessage('Something went wrong', 'warning');

        expect(record.context.level).toBe('warning');
    });
});

describe('Alert Manager Tests', () => {
    let alertManager;

    beforeEach(() => {
        alertManager = createAlertManager();
    });

    it('should add and check rule', () => {
        alertManager.addRule('high-errors', {
            name: 'High Error Rate',
            condition: 'gt',
            threshold: 100,
            severity: 'critical',
        });

        const alert = alertManager.checkRule('high-errors', 150);

        expect(alert).not.toBeNull();
        expect(alert.severity).toBe('critical');
    });

    it('should not trigger below threshold', () => {
        alertManager.addRule('test', {
            name: 'Test',
            condition: 'gt',
            threshold: 100,
        });

        const alert = alertManager.checkRule('test', 50);
        expect(alert).toBeNull();
    });

    it('should respect cooldown', () => {
        alertManager.addRule('test', {
            name: 'Test',
            condition: 'gt',
            threshold: 0,
            cooldown: 300000,
        });

        alertManager.checkRule('test', 10);
        const second = alertManager.checkRule('test', 20);

        expect(second).toBeNull(); // Still in cooldown
    });

    it('should acknowledge alert', () => {
        alertManager.addRule('test', {
            name: 'Test',
            condition: 'eq',
            threshold: 1,
        });

        const alert = alertManager.checkRule('test', 1);
        alertManager.acknowledge(alert.id);

        expect(alertManager.getActiveAlerts()).toHaveLength(0);
    });

    it('should filter alerts', () => {
        alertManager.addRule('critical', {
            name: 'Critical',
            condition: 'gt',
            threshold: 0,
            severity: 'critical',
            cooldown: 0,
        });
        alertManager.addRule('warning', {
            name: 'Warning',
            condition: 'gt',
            threshold: 0,
            severity: 'warning',
            cooldown: 0,
        });

        alertManager.checkRule('critical', 1);
        alertManager.checkRule('warning', 1);

        const criticals = alertManager.getAlerts({ severity: 'critical' });
        expect(criticals).toHaveLength(1);
    });
});

describe('Health Checker Tests', () => {
    let healthChecker;

    beforeEach(() => {
        healthChecker = createHealthChecker();
    });

    it('should run health check', async () => {
        healthChecker.registerCheck('db', async () => ({ connected: true }));

        const result = await healthChecker.runCheck('db');

        expect(result.status).toBe('healthy');
        expect(result.result.connected).toBe(true);
    });

    it('should handle failed check', async () => {
        healthChecker.registerCheck('failing', async () => {
            throw new Error('Connection failed');
        });

        const result = await healthChecker.runCheck('failing');

        expect(result.status).toBe('unhealthy');
        expect(result.error).toBe('Connection failed');
    });

    it('should handle timeout', async () => {
        healthChecker.registerCheck('slow', async () => {
            await new Promise(r => setTimeout(r, 10000));
        }, { timeout: 100 });

        const result = await healthChecker.runCheck('slow');

        expect(result.status).toBe('unhealthy');
        expect(result.error).toBe('Timeout');
    });

    it('should get overall health', async () => {
        healthChecker.registerCheck('ok', async () => true, { critical: true });
        healthChecker.registerCheck('fail', async () => { throw new Error(); }, { critical: true });

        await healthChecker.runAllChecks();
        const overall = healthChecker.getOverallHealth();

        expect(overall.status).toBe('unhealthy');
    });
});

describe('Log Aggregator Tests', () => {
    let logger;

    beforeEach(() => {
        logger = createLogAggregator();
    });

    it('should log messages', () => {
        logger.info('Application started');
        logger.error('Something failed');

        const stats = logger.getStats();
        expect(stats.info).toBe(1);
        expect(stats.error).toBe(1);
    });

    it('should query by level', () => {
        logger.debug('Debug');
        logger.info('Info');
        logger.error('Error');

        const errors = logger.query({ level: 'error' });
        expect(errors).toHaveLength(1);
    });

    it('should search logs', () => {
        logger.info('User logged in: john@example.com');
        logger.info('User logged out: jane@example.com');
        logger.error('Login failed for unknown user');

        const results = logger.query({ search: 'logged in' });
        expect(results).toHaveLength(1);
    });

    it('should query by time range', () => {
        const before = Date.now();
        logger.info('Before');

        const after = Date.now() + 1;
        logger.info('After');

        const results = logger.query({ until: before });
        expect(results).toHaveLength(1);
    });
});
