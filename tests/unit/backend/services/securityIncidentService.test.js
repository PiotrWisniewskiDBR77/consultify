import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Define mocks
const mocks = vi.hoisted(() => {
    return {
        db: {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn()
        },
        logger: {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn()
        },
        uuid: vi.fn(() => 'mock-uuid-1234')
    };
});

// Mock modules
vi.mock('../../../../server/src/database/Database.js', () => ({
    getDatabase: () => mocks.db,
    default: mocks.db
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
    default: mocks.logger
}));

vi.mock('uuid', () => ({
    v4: mocks.uuid
}));

let securityIncidentService;

describe('SecurityIncidentService', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        
        const module = await import('../../../../server/src/services/securityIncidentService.js');
        securityIncidentService = module.default || module;

        if (securityIncidentService.setDependencies) {
            securityIncidentService.setDependencies({
                db: mocks.db,
                uuidv4: mocks.uuid,
                logger: mocks.logger
            });
        }
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getIncidents', () => {
        it('should return all incidents', async () => {
            const mockIncidents = [{ id: '1', title: 'Leaked Key' }];
            mocks.db.all.mockResolvedValueOnce(mockIncidents);

            const result = await securityIncidentService.getIncidents();

            expect(mocks.db.all).toHaveBeenCalled();
            expect(result).toEqual(mockIncidents);
        });
    });

    describe('createIncident', () => {
        it('should create a new incident', async () => {
            const data = { title: 'DDoS', severity: 'high' };
            mocks.db.run.mockResolvedValueOnce({ changes: 1 });
            mocks.db.get.mockResolvedValueOnce({ id: 'mock-uuid-1234', ...data, status: 'open' });

            const result = await securityIncidentService.createIncident(data);

            expect(mocks.db.run).toHaveBeenCalled();
            expect(result.title).toBe('DDoS');
        });
    });

    describe('resolveIncident', () => {
        it('should mark incident as resolved', async () => {
            mocks.db.run.mockResolvedValueOnce({ changes: 1 });

            const result = await securityIncidentService.resolveIncident('i1', 'u1', 'Fixed');

            expect(result).toBe(true);
            expect(mocks.db.run).toHaveBeenCalledWith(
                expect.stringContaining("status = ?"),
                expect.arrayContaining(['resolved'])
            );
        });
    });
});
