
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('MyWorkService', () => {
    let MyWorkService;
    let dbMock;

    beforeEach(async () => {
        vi.resetModules();
        MyWorkService = (await import('../../../server/services/myWorkService.js')).default;

        dbMock = {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn()
        };
        MyWorkService._setDb(dbMock);
    });

    describe('getMyWork', () => {
        it('should aggregate work', async () => {
            // tasks
            dbMock.all.mockImplementationOnce((sql, params, cb) => cb(null, []));
            // alerts
            dbMock.all.mockImplementationOnce((sql, params, cb) => cb(null, []));
            // init owner check
            dbMock.get.mockImplementation((sql, params, cb) => cb(null, null));

            const result = await MyWorkService.getMyWork('user1');
            expect(result.myTasks.total).toBe(0);
        });
    });

    describe('errors', () => {
        it('should propagate db error', async () => {
            dbMock.all.mockImplementationOnce((sql, params, cb) => cb(new Error('Fail')));
            await expect(MyWorkService.getMyWork('user1')).rejects.toThrow('Fail');
        });
    });
});
