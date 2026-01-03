/**
 * Extended Unit Tests for RapidLean Service
 * Tests new methods added for observation support
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Use real in-memory DB instead of mocks
const db = require('../../../server/database');
const RapidLeanService = require('../../../server/services/rapidLeanService');

describe('RapidLeanService - Extended Methods', () => {
    beforeEach(async () => {
        // Clean up and ensure tables exist (setup.ts does this too, but let's be safe)
        await new Promise((resolve) => {
            db.run('DELETE FROM rapid_lean_observations', () => {
                resolve();
            });
        });
    });

    describe('getObservations', () => {
        it('should fetch and parse observations correctly from REAL DB', async () => {
            const observationId = 'obs-' + Date.now();
            const sql = `
                INSERT INTO rapid_lean_observations (
                    id, assessment_id, organization_id, template_id, location, answers, photos, notes, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            await new Promise((resolve, reject) => {
                db.run(sql, [
                    observationId, 'test-assessment', 'test-org', 'value_stream_template',
                    'Line A', '{"vs_1": true}', '["photo1.jpg"]', 'Test note', '2024-01-15T10:00:00Z'
                ], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            const observations = await RapidLeanService.getObservations('test-assessment');

            expect(Array.isArray(observations)).toBe(true);
            expect(observations.length).toBe(1);
            expect(observations[0].id).toBe(observationId);
            expect(observations[0].answers).toEqual({ vs_1: true });
        });

        it('should handle missing assessment', async () => {
            const observations = await RapidLeanService.getObservations('non-existent');
            expect(observations.length).toBe(0);
        });
    });

    describe('combineScores', () => {
        it('should weight base score higher than evidence', () => {
            const combined = RapidLeanService.combineScores(3.0, 5.0);
            expect(combined).toBeCloseTo(3.6, 1);
        });
    });
});





