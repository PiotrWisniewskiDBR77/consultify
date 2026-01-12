import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PMOValidation from '../../../../server/middleware/pmoValidation';

describe('PMO Validation Middleware', () => {
    let req;
    let res;
    let next;
    let mockDb;
    let mockStatusMachine;

    beforeEach(() => {
        req = {
            body: {},
            params: { id: '123' },
            organizationId: 'org1',
            userId: 'user1'
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
            statusCode: 200
        };
        next = vi.fn();

        mockDb = {
            get: vi.fn(),
            run: vi.fn()
        };

        mockStatusMachine = {
            validateInitiativeTransition: vi.fn(),
            validateTaskTransition: vi.fn()
        };

        PMOValidation._setDb(mockDb);
        PMOValidation._setStatusMachine(mockStatusMachine);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('validateInitiative', () => {
        it('should pass if owner is present', () => {
            req.body.ownerId = 'some-owner';
            PMOValidation.validateInitiative(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should fail if owner is missing', () => {
            PMOValidation.validateInitiative(req, res, next);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Initiative must have an owner' }));
        });
    });

    describe('validateTask', () => {
        it('should fail if initiative missing', () => {
            PMOValidation.validateTask(req, res, next);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should pass if initiative exists', () => {
            req.body.initiativeId = 'init1';
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { id: 'init1' }));

            PMOValidation.validateTask(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should fail if initiative not found in db', () => {
            req.body.initiativeId = 'init1';
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, null));

            PMOValidation.validateTask(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Initiative not found' }));
        });
    });

    describe('validateInitiativeStatus', () => {
        it('should skip if no status in body', () => {
            PMOValidation.validateInitiativeStatus(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should attach initiative details on success', () => {
            req.body.status = 'approved';
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { status: 'new', project_id: 'p1' }));
            mockStatusMachine.validateInitiativeTransition.mockReturnValue({ valid: true });

            PMOValidation.validateInitiativeStatus(req, res, next);

            expect(req.previousStatus).toBe('new');
            expect(req.projectId).toBe('p1');
            expect(next).toHaveBeenCalled();
        });

        it('should block invalid transition', () => {
            req.body.status = 'approved';
            mockDb.get.mockImplementation((sql, params, cb) => cb(null, { status: 'new', project_id: 'p1' }));
            mockStatusMachine.validateInitiativeTransition.mockReturnValue({ valid: false, reason: 'Bad move' });

            PMOValidation.validateInitiativeStatus(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Bad move' }));
        });
    });
});
