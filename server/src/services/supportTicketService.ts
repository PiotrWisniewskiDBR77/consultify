/**
 * Support Ticket Service
 * Manages support tickets, status updates, and comments.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import _logger from '../utils/Logger.js';
import { getTableColumns } from '../utils/dbSchema.js';
import * as queryHelpers from '../utils/queryHelpers.js';

class SupportTicketServiceClass {
  private db: IDatabase;
  private uuidv4: typeof uuidv4;
  private logger: any;
  private initialized = false;

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
 
  private async ensureTables(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS support_tickets (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        user_id TEXT,
        ticket_number TEXT UNIQUE,
        subject TEXT NOT NULL,
        description TEXT,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'open',
        category TEXT,
        assigned_to TEXT,
        tags_json TEXT DEFAULT '[]',
        metadata_json TEXT DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity_at TIMESTAMP,
        resolved_at TIMESTAMP,
        closed_at TIMESTAMP,
        first_response_at TIMESTAMP
      )`
    );

    await queryHelpers.queryRun(
      `CREATE TABLE IF NOT EXISTS support_ticket_comments (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        comment_text TEXT NOT NULL,
        is_internal INTEGER DEFAULT 0,
        attachments_json TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    );
  }

  async getTickets(filters: any = {}): Promise<any[]> {
    await this.ensureTables();
    const cols = await getTableColumns('support_tickets');
    const where: string[] = [];
    const params: any[] = [];

    if (filters.organizationId && cols.has('organization_id')) {
      where.push('organization_id = ?');
      params.push(filters.organizationId);
    }
    if (filters.userId && cols.has('user_id')) {
      where.push('user_id = ?');
      params.push(filters.userId);
    }
    if (filters.status && cols.has('status')) {
      where.push('status = ?');
      params.push(filters.status);
    }
    if (filters.priority && cols.has('priority')) {
      where.push('priority = ?');
      params.push(filters.priority);
    }
    if (filters.assignedTo && cols.has('assigned_to')) {
      where.push('assigned_to = ?');
      params.push(filters.assignedTo);
    }

    const orderBy = cols.has('created_at')
      ? 'ORDER BY created_at DESC, id DESC'
      : 'ORDER BY id DESC';
    const limit = Number.isFinite(Number(filters.limit))
      ? Math.min(Math.max(Number(filters.limit), 1), 500)
      : 50;
    params.push(limit);

    const query = `SELECT * FROM support_tickets ${
      where.length ? `WHERE ${where.join(' AND ')}` : ''
    } ${orderBy} LIMIT ?`;
    return await this.db.all(query, params);
  }

  async createTicket(data: any): Promise<any> {
    const id = this.uuidv4();
    await this.ensureTables();
    const cols = await getTableColumns('support_tickets');
    const now = new Date().toISOString();
    const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;
    const {
      userId,
      subject,
      description,
      priority = 'medium',
      category = 'general',
      organizationId,
    } = data;

    let resolvedOrganizationId = organizationId || data.organization_id || null;
    if (!resolvedOrganizationId && cols.has('organization_id')) {
      const ownerRow = userId
        ? await this.db
            .get('SELECT organization_id FROM users WHERE id = ?', [userId])
            .catch(() => null)
        : null;
      resolvedOrganizationId = (ownerRow as any)?.organization_id || null;
    }
    if (!resolvedOrganizationId && cols.has('organization_id')) {
      const orgRow = await this.db
        .get('SELECT id FROM organizations ORDER BY created_at DESC LIMIT 1', [])
        .catch(() => null);
      resolvedOrganizationId = (orgRow as any)?.id || null;
    }

    const insert: Record<string, any> = {
      id,
      user_id: userId,
      subject,
      description,
      priority,
      status: 'open',
      organization_id: resolvedOrganizationId,
      ticket_number: ticketNumber,
      category: category || 'general',
      created_at: now,
      updated_at: now,
      last_activity_at: now,
    };

    const insertColumns = Object.keys(insert).filter(
      (column) => cols.has(column) && insert[column] !== undefined
    );
    const placeholders = insertColumns.map(() => '?').join(', ');
    const values = insertColumns.map((column) => insert[column]);

    await this.db.run(
      `INSERT INTO support_tickets (${insertColumns.join(', ')}) VALUES (${placeholders})`,
      values
    );

    return await this.getTicketById(id);
  }

  async getTicketById(id: string): Promise<any> {
    await this.ensureTables();
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
    await this.ensureTables();
    const cols = await getTableColumns('support_tickets');
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.status && cols.has('status')) {
      fields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.priority && cols.has('priority')) {
      fields.push('priority = ?');
      params.push(updates.priority);
    }
    if ((updates.assignedTo || updates.assigneeId) && cols.has('assigned_to')) {
      fields.push('assigned_to = ?');
      params.push(updates.assignedTo || updates.assigneeId);
    }
    if (cols.has('updated_at')) {
      fields.push('updated_at = ?');
      params.push(new Date().toISOString());
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
    const now = new Date().toISOString();
    await this.ensureTables();
    const cols = await getTableColumns('support_ticket_comments');
    const insert: Record<string, any> = {
      id,
      ticket_id: ticketId,
      user_id: userId,
      comment_text: text,
      is_internal: isInternal ? 1 : 0,
      created_at: now,
    };
    const insertColumns = Object.keys(insert).filter(
      (column) => cols.has(column) && insert[column] !== undefined
    );
    await this.db.run(
      `INSERT INTO support_ticket_comments (${insertColumns.join(', ')}) VALUES (${insertColumns
        .map(() => '?')
        .join(', ')})`,
      insertColumns.map((column) => insert[column])
    );
    await this.db.run(
      'UPDATE support_tickets SET last_activity_at = ?, updated_at = ? WHERE id = ?',
      [now, now, ticketId]
    ).catch(() => undefined);
    return {
      id,
      ticketId,
      userId,
      commentText: text,
      comment_text: text,
      isInternal,
      created_at: now,
    };
  }
}

const supportTicketService = new SupportTicketServiceClass();
export default supportTicketService;
