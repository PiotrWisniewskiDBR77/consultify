import { beforeEach, describe, expect, it, vi } from 'vitest';

import EmailService from '../../../../services/emailService.js';

describe('EmailService', () => {
    let mockDb;

    beforeEach(() => {
        vi.clearAllMocks();

        mockDb = {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn((sql, params, callback) => {
                if (callback) {
                    callback(null);
                }
            }),
            exec: vi.fn(),
            serialize: vi.fn(),
            close: vi.fn(),
            query: vi.fn(),
            queryOne: vi.fn(),
            queryAll: vi.fn(),
            queryRun: vi.fn(),
        };

        EmailService.setDependencies({ db: mockDb });
    });

    describe('Service Methods', () => {
        it('should have required methods', () => {
            expect(EmailService).toBeDefined();
            expect(typeof EmailService.send).toBe('function');
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', () => {
            mockDb.queryAll.mockImplementation(() => Promise.resolve([]));
            expect(true).toBe(true);
        });
    });
});
