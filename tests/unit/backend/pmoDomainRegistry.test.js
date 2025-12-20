
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('PMODomainRegistry', () => {
    let PMODomainRegistry;
    let dbMock;

    beforeEach(async () => {
        vi.resetModules();
        PMODomainRegistry = (await import('../../../server/services/pmoDomainRegistry.js')).default;

        dbMock = {
            all: vi.fn(),
            get: vi.fn()
        };
        PMODomainRegistry._setDb(dbMock);
    });

    describe('getAllDomains', () => {
        it('should return domains', async () => {
            dbMock.all.mockImplementation((sql, params, cb) => cb(null, [{ id: 'd1' }]));
            const res = await PMODomainRegistry.getAllDomains();
            expect(res).toEqual([{ id: 'd1' }]);
        });
    });

    describe('getDomain', () => {
        it('should return domain', async () => {
            dbMock.get.mockImplementation((sql, params, cb) => cb(null, { id: 'd1' }));
            const res = await PMODomainRegistry.getDomain('d1');
            expect(res).toBeDefined();
        });
    });
});
