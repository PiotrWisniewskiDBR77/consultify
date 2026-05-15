/**
 * Support Ticket Service
 * Manages support tickets, status updates, and comments.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import _logger from '../utils/Logger.js';

class SupportTicketServiceClass {
  private db: IDatabase;
  private uuidv4: typeof uuidv4;
  private logger: any;

  constructor(deps?: { db?: IDatabase; uuidv4?: typeof uuidv4; logger?: any }) {
    this.db = deps?.db || getDatabase();
    this.uuidv4 = deps?.uuidv4 || uuidv4;
    this.logger = deps?.logger || _logger;
  }

  setDependencies(deps: { db?: IDatabase; uuidv4?: typeof uuidv4; logger?: any }) {
    if (deps.db) this.db = deps.db;
    if (deps.uuidv4) this.uuidv4 = deps.uuidv4;
    if (deps.logger) this.logger = deps.logger;
  }

  async getTickets(filters: any = {}): Promise<any[]> {
    const query = 'SELECT * FROM support_tickets ORDER BY created_at DESC';
    return await this.db.all(query, []);
  }

  async createTicket(data: any): Promise<any> {
    const id = this.uuidv4();
    const { userId, subject, description, priority = 'medium' } = data;

    await this.db.run(
      'INSERT INTO support_tickets (id, user_id, subject, description, priority, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId, subject, description, priority, 'open']
    );

    return await this.getTicketById(id);
  }

  async getTicketById(id: string): Promise<any> {
    return await this.db.get('SELECT * FROM support_tickets WHERE id = ?', [id]);
  }

  async getComments(ticketId: string): Promise<any[]> {
    return await this.db.all(
      `SELECT id, ticket_id, user_id, comment_text, is_internal, created_at
       FROM support_ticket_comments
       WHERE ticket_id = ?
       ORDER BY created_at ASC`,
      [ticketId]
    );
  }

  async updateTicket(id: string, updates: any): Promise<boolean> {
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.status) {
      fields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.priority) {
      fields.push('priority = ?');
      params.push(updates.priority);
    }

    if (fields.length === 0) return true;

    params.push(id);
    const result = await this.db.run(
      `UPDATE support_tickets SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
    return (result as any).changes > 0;
  }

  async addComment(
    ticketId: string,
    userId: string,
    text: string,
    isInternal: boolean = false
  ): Promise<any> {
    const id = this.uuidv4();
    await this.db.run(
      'INSERT INTO support_ticket_comments (id, ticket_id, user_id, comment_text, is_internal) VALUES (?, ?, ?, ?, ?)',
      [id, ticketId, userId, text, isInternal ? 1 : 0]
    );
    return { id, ticketId, userId, commentText: text, isInternal };
  }
}

const supportTicketService = new SupportTicketServiceClass();
export default supportTicketService;
