/**
 * Threat Intelligence Service Tests - Mock-Based Unit Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const createThreatIntelligenceService = () => {
    const threats = [];
    const indicators = new Map();

    return {
        reportThreat: async (data) => {
            if (!data.type) return { success: false, error: 'Type required', status: 400 };
            const id = `threat-${Date.now()}`;
            threats.push({ id, ...data, reportedAt: new Date() });
            return { success: true, data: { id }, status: 201 };
        },

        getThreats: async (severity) => {
            let result = threats;
            if (severity) result = result.filter(t => t.severity === severity);
            return { success: true, data: result, status: 200 };
        },

        addIndicator: async (type, value) => {
            if (!type || !value) return { success: false, error: 'Type and value required', status: 400 };
            indicators.set(value, { type, addedAt: new Date() });
            return { success: true, status: 201 };
        },

        checkIndicator: async (value) => {
            const indicator = indicators.get(value);
            return { success: true, data: { isThreat: !!indicator, indicator }, status: 200 };
        }
    };
};

describe('ThreatIntelligenceService', () => {
    let threatService;

    beforeEach(() => {
        vi.clearAllMocks();
        threatService = createThreatIntelligenceService();
    });

    it('should report threat', async () => {
        const result = await threatService.reportThreat({ type: 'phishing', severity: 'high' });
        expect(result.success).toBe(true);
        expect(result.status).toBe(201);
    });

    it('should get threats by severity', async () => {
        await threatService.reportThreat({ type: 'malware', severity: 'critical' });
        await threatService.reportThreat({ type: 'spam', severity: 'low' });
        const result = await threatService.getThreats('critical');
        expect(result.data).toHaveLength(1);
    });

    it('should add and check indicator', async () => {
        await threatService.addIndicator('ip', '192.168.1.1');
        const result = await threatService.checkIndicator('192.168.1.1');
        expect(result.success).toBe(true);
        expect(result.data.isThreat).toBe(true);
    });

    it('should return false for unknown indicator', async () => {
        const result = await threatService.checkIndicator('safe.com');
        expect(result.data.isThreat).toBe(false);
    });
});
