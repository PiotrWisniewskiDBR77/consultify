/**
 * Support Ticket Service Tests - Mock-Based Unit Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const createSupportTicketService = () => {
    const tickets = new Map();
    let counter = 0;

    return {
        create: async (data) => {
            if (!data.subject) return { success: false, error: 'Subject required', status: 400 };
            const id = `ticket-${++counter}`;
            tickets.set(id, { id, ...data, status: 'open', createdAt: new Date() });
            return { success: true, data: { id }, status: 201 };
        },

        get: async (ticketId) => {
            const ticket = tickets.get(ticketId);
            if (!ticket) return { success: false, error: 'Not found', status: 404 };
            return { success: true, data: ticket, status: 200 };
        },

        updateStatus: async (ticketId, status) => {
            const ticket = tickets.get(ticketId);
            if (!ticket) return { success: false, error: 'Not found', status: 404 };
            ticket.status = status;
            return { success: true, data: ticket, status: 200 };
        },

        list: async (filters = {}) => {
            let result = Array.from(tickets.values());
            if (filters.status) result = result.filter(t => t.status === filters.status);
            return { success: true, data: result, status: 200 };
        }
    };
};

describe('SupportTicketService', () => {
    let ticketService;

    beforeEach(() => {
        vi.clearAllMocks();
        ticketService = createSupportTicketService();
    });

    it('should create ticket', async () => {
        const result = await ticketService.create({ subject: 'Help needed', description: 'Issue with login' });
        expect(result.success).toBe(true);
        expect(result.status).toBe(201);
    });

    it('should get ticket by ID', async () => {
        const created = await ticketService.create({ subject: 'Test ticket' });
        const result = await ticketService.get(created.data.id);
        expect(result.success).toBe(true);
        expect(result.data.subject).toBe('Test ticket');
    });

    it('should update ticket status', async () => {
        const created = await ticketService.create({ subject: 'Bug report' });
        const result = await ticketService.updateStatus(created.data.id, 'resolved');
        expect(result.success).toBe(true);
        expect(result.data.status).toBe('resolved');
    });

    it('should list tickets with filter', async () => {
        await ticketService.create({ subject: 'Ticket 1' });
        const created = await ticketService.create({ subject: 'Ticket 2' });
        await ticketService.updateStatus(created.data.id, 'closed');
        const result = await ticketService.list({ status: 'open' });
        expect(result.data).toHaveLength(1);
    });
});
