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

let supportTicketService;

describe('SupportTicketService', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        
        const module = await import('../../../../server/src/services/supportTicketService.js');
        supportTicketService = module.default || module;

        if (supportTicketService.setDependencies) {
            supportTicketService.setDependencies({
                db: mocks.db,
                uuidv4: mocks.uuid,
                logger: mocks.logger
            });
        }
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getTickets', () => {
        it('should return all tickets', async () => {
            const mockTickets = [{ id: '1', subject: 'Test' }];
            mocks.db.all.mockResolvedValueOnce(mockTickets);

            const result = await supportTicketService.getTickets();

            expect(mocks.db.all).toHaveBeenCalled();
            expect(result).toEqual(mockTickets);
        });
    });

    describe('createTicket', () => {
        it('should create a new ticket', async () => {
            const ticketData = { userId: 'u1', subject: 'Help', description: 'Problem' };
            mocks.db.run.mockResolvedValueOnce({ lastID: 1, changes: 1 });
            mocks.db.get.mockResolvedValueOnce({ id: 'mock-uuid-1234', ...ticketData, status: 'open' });

            const result = await supportTicketService.createTicket(ticketData);

            expect(mocks.db.run).toHaveBeenCalled();
            expect(result.subject).toBe('Help');
            expect(result.id).toBe('mock-uuid-1234');
        });
    });

    describe('addComment', () => {
        it('should add a comment to a ticket', async () => {
            mocks.db.run.mockResolvedValueOnce({ lastID: 1, changes: 1 });

            const result = await supportTicketService.addComment('t1', 'u1', 'New comment');

            expect(mocks.db.run).toHaveBeenCalled();
            expect(result.commentText).toBe('New comment');
        });
    });
});
