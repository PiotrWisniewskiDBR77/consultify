import { beforeEach, describe, expect, it, vi } from 'vitest';

import ActivityService from '../../../../services/activityService.js';

describe('ActivityService', () => {
    let mockDb;

    beforeEach(() => {
        mockDb = {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn((sql, params, cb) => {
                if (cb) cb(null);
            }),
            exec: vi.fn(),
            serialize: vi.fn(),
            close: vi.fn(),
            query: vi.fn(),
            queryOne: vi.fn(),
            queryAll: vi.fn(),
            queryRun: vi.fn(),
        };

        ActivityService.setDependencies({ db: mockDb });
    });

    it('should be defined', () => {
        expect(ActivityService).toBeDefined();
    });

    it('should have log method', () => {
        expect(typeof ActivityService.log).toBe('function');
    });

    it('should have getRecent method', () => {
        expect(typeof ActivityService.getRecent).toBe('function');
    });
});


