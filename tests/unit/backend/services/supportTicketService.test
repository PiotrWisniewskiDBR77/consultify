/**
 * Unit tests for SupportTicketService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database
const { mockDb } = vi.hoisted(() => {
    return {
        mockDb: {
            run: vi.fn(),
            get: vi.fn(),
            all: vi.fn()
        }
    };
});

vi.mock('../../../../server/src/database/Database.ts', () => ({
    getDatabase: () => mockDb,
    default: mockDb,
    run: mockDb.run,
    get: mockDb.get,
    all: mockDb.all
}));

// Mock uuid
vi.mock('uuid', () => ({
    v4: () => 'mock-uuid-1234'
}));

import SupportTicketService from '../../../../server/services/supportTicketService.js';

describe('SupportTicketService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Since we are mocking Database.ts globally, 
        // and supportTicketService uses getDatabase(), 
        // it should use mockDb automatically.
        // But if it uses setDependencies:
        if (SupportTicketService.setDependencies) {
            SupportTicketService.setDependencies({ db: mockDb });
        }
    });

    describe('generateTicketNumber', () => {
        it('should generate unique ticket number', () => {
            const ticket1 = SupportTicketService.generateTicketNumber();
            const ticket2 = SupportTicketService.generateTicketNumber();

            expect(ticket1).toMatch(/^TKT-/);
            expect(ticket2).toMatch(/^TKT-/);
            expect(ticket1).not.toBe(ticket2);
        });
    });

    describe('createTicket', () => {
        it('should create a support ticket', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });

            const ticketData = {
                organizationId: 'org1',
                userId: 'user1',
                subject: 'Test Ticket',
                description: 'Test Description',
                priority: 'medium'
            };

            const result = await SupportTicketService.createTicket(ticketData);
            expect(result).toHaveProperty('ticketNumber');
            expect(result.subject).toBe('Test Ticket');
            expect(mockDb.run).toHaveBeenCalled();
        });
    });

    describe('getTickets', () => {
        it('should return tickets with filters', async () => {
            const mockTickets = [
                { id: '1', ticket_number: 'TKT-001', subject: 'Test', status: 'open' }
            ];
            mockDb.all.mockResolvedValue(mockTickets);

            const result = await SupportTicketService.getTickets({ status: 'open' });
            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('ticket_number', 'TKT-001');
            expect(mockDb.all).toHaveBeenCalled();
        });
    });

    describe('updateTicket', () => {
        it('should update a ticket', async () => {
            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await SupportTicketService.updateTicket('1', { status: 'closed' });
            expect(result.updated).toBe(true);
        });
    });
});
