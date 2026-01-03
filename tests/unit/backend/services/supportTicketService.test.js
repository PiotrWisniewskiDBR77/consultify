/**
 * Unit tests for SupportTicketService
 */

const SupportTicketService = require('../../../../server/services/supportTicketService');
const db = require('../../../../server/database');

jest.mock('../../../../server/database');

describe('SupportTicketService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
            db.run.mockImplementation((query, params, callback) => {
                callback(null, { changes: 1 });
            });

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
        });
    });

    describe('getTickets', () => {
        it('should return tickets with filters', async () => {
            const mockTickets = [
                { id: '1', ticket_number: 'TKT-001', subject: 'Test', status: 'open' }
            ];
            db.all.mockImplementation((query, params, callback) => {
                callback(null, mockTickets);
            });

            const result = await SupportTicketService.getTickets({ status: 'open' });
            expect(result).toEqual(mockTickets);
        });
    });
});

