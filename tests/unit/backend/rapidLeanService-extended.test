/**
 * Extended Unit Tests for RapidLean Service
 * Tests new methods added for observation support
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

/**
 * Extended Unit Tests for RapidLean Service
 * Tests new methods added for observation support
 * CRITICAL FOR ENTERPRISE LEAN ASSESSMENT
 */
import RapidLeanService from '../../../server/src/services/rapidLeanService.js';

describe('RapidLeanService - Extended Methods', () => {
    let mocks;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks = setupStandardTest();
    });

    describe('getObservations', () => {
        it('should fetch and parse observations correctly', async () => {
            const mockRows = [{
                id: 'obs-1',
                assessment_id: 'test-assessment',
                organization_id: 'test-org',
                template_id: 'value_stream_template',
                answers: JSON.stringify({ vs_1: true }),
                photos: JSON.stringify(['photo1.jpg']),
                notes: 'Test note',
                timestamp: '2024-01-15T10:00:00Z'
            }];

            mocks.db.all.mockImplementation((sql, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                cb(null, mockRows);
            });

            const observations = await RapidLeanService.getObservations('test-assessment');

            expect(Array.isArray(observations)).toBe(true);
            expect(observations.length).toBe(1);
            expect(observations[0].id).toBe('obs-1');
            expect(observations[0].answers).toEqual({ vs_1: true });
            expect(mocks.db.all).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM rapid_lean_observations'),
                ['test-assessment'],
                expect.any(Function)
            );
        });

        it('should handle missing assessment (empty result)', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                cb(null, []);
            });

            const observations = await RapidLeanService.getObservations('non-existent');
            expect(observations.length).toBe(0);
        });

        it('should handle database errors', async () => {
            mocks.db.all.mockImplementation((sql, params, callback) => {
                const cb = typeof params === 'function' ? params : callback;
                cb(new Error('DB Error'));
            });

            await expect(RapidLeanService.getObservations('err-id'))
                .rejects.toThrow('DB Error');
        });
    });

    describe('combineScores', () => {
        it('should weight base score higher than evidence', () => {
            // Logic: base * 0.7 + evidence * 0.3
            const combined = RapidLeanService.combineScores(3.0, 5.0);
            // 3.0 * 0.7 = 2.1
            // 5.0 * 0.3 = 1.5
            // Total = 3.6
            expect(combined).toBeCloseTo(3.6, 1);
        });
    });
});





