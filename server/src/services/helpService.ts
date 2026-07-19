/**
 * Help Service
 * FLOW-HELP-001: Help & Education System
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface HelpArticle {
  id: string;
  category: string;
  subcategory?: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  videoUrl?: string;
  videoDurationSeconds?: number;
  relatedModule?: string;
  tags: string[];
  isPublished: boolean;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
}

export interface ModuleHelp {
  id: string;
  moduleKey: string;
  title: string;
  shortDescription: string;
  videoUrl?: string;
  videoDurationSeconds?: number;
  articleId?: string;
  tips: string[];
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  organizationId: string;
  userId: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assignedTo?: string;
  resolution?: string;
  satisfactionRating?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderType: 'user' | 'support' | 'system' | 'ai';
  senderId?: string;
  senderName?: string;
  message: string;
  attachments: string[];
  isInternal: boolean;
  createdAt: string;
}

// ==========================================
// SERVICE
// ==========================================

class HelpService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  // ==========================================
  // ARTICLES
  // ==========================================

  /**
   * Get articles with filters
   */
  async getArticles(filters?: {
    category?: string;
    relatedModule?: string;
    search?: string;
    limit?: number;
  }): Promise<HelpArticle[]> {
    const db = await this.getDb();

    let query = `SELECT * FROM help_articles WHERE is_published = 1`;
    const params: (string | number)[] = [];

    if (filters?.category) {
      query += ` AND category = ?`;
      params.push(filters.category);
    }

    if (filters?.relatedModule) {
      query += ` AND related_module = ?`;
      params.push(filters.relatedModule);
    }

    if (filters?.search) {
      query += ` AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY sort_order, title`;

    if (filters?.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
    }

    const articles = await db.all<{
      id: string;
      category: string;
      subcategory: string;
      title: string;
      slug: string;
      content: string;
      excerpt: string;
      video_url: string;
      video_duration_seconds: number;
      related_module: string;
      tags: string;
      is_published: number;
      view_count: number;
      helpful_count: number;
      not_helpful_count: number;
    }>(query, params);

    return (articles || []).map((a) => ({
      id: a.id,
      category: a.category,
      subcategory: a.subcategory,
      title: a.title,
      slug: a.slug,
      content: a.content,
      excerpt: a.excerpt,
      videoUrl: a.video_url,
      videoDurationSeconds: a.video_duration_seconds,
      relatedModule: a.related_module,
      tags: JSON.parse(a.tags || '[]'),
      isPublished: a.is_published === 1,
      viewCount: a.view_count,
      helpfulCount: a.helpful_count,
      notHelpfulCount: a.not_helpful_count,
    }));
  }

  /**
   * Get article by slug
   */
  async getArticleBySlug(slug: string, userId?: string): Promise<HelpArticle | null> {
    const db = await this.getDb();

    const article = await db.get<{
      id: string;
      category: string;
      subcategory: string;
      title: string;
      slug: string;
      content: string;
      excerpt: string;
      video_url: string;
      video_duration_seconds: number;
      related_module: string;
      tags: string;
      is_published: number;
      view_count: number;
      helpful_count: number;
      not_helpful_count: number;
    }>(`SELECT * FROM help_articles WHERE slug = ? AND is_published = 1`, [slug]);

    if (!article) return null;

    // Increment view count
    await db.run(`UPDATE help_articles SET view_count = view_count + 1 WHERE id = ?`, [article.id]);

    // Log interaction
    if (userId) {
      await this.logInteraction(userId, 'article_view', article.id, 'article');
    }

    return {
      id: article.id,
      category: article.category,
      subcategory: article.subcategory,
      title: article.title,
      slug: article.slug,
      content: article.content,
      excerpt: article.excerpt,
      videoUrl: article.video_url,
      videoDurationSeconds: article.video_duration_seconds,
      relatedModule: article.related_module,
      tags: JSON.parse(article.tags || '[]'),
      isPublished: article.is_published === 1,
      viewCount: article.view_count + 1,
      helpfulCount: article.helpful_count,
      notHelpfulCount: article.not_helpful_count,
    };
  }

  /**
   * Submit article feedback
   */
  async submitArticleFeedback(
    articleId: string,
    userId: string,
    isHelpful: boolean,
    comment?: string
  ): Promise<void> {
    const db = await this.getDb();

    // Update article counts
    const field = isHelpful ? 'helpful_count' : 'not_helpful_count';
    await db.run(`UPDATE help_articles SET ${field} = ${field} + 1 WHERE id = ?`, [articleId]);

    // Log interaction
    await this.logInteraction(
      userId,
      'feedback',
      articleId,
      'article',
      isHelpful ? 1 : -1,
      comment
    );
  }

  // ==========================================
  // MODULE HELP
  // ==========================================

  /**
   * Get module help
   */
  async getModuleHelp(moduleKey: string): Promise<ModuleHelp | null> {
    const db = await this.getDb();

    const help = await db.get<{
      id: string;
      module_key: string;
      title: string;
      short_description: string;
      video_url: string;
      video_duration_seconds: number;
      article_id: string;
      tips: string;
    }>(`SELECT * FROM module_help WHERE module_key = ? AND is_active = 1`, [moduleKey]);

    if (!help) return null;

    return {
      id: help.id,
      moduleKey: help.module_key,
      title: help.title,
      shortDescription: help.short_description,
      videoUrl: help.video_url,
      videoDurationSeconds: help.video_duration_seconds,
      articleId: help.article_id,
      tips: JSON.parse(help.tips || '[]'),
    };
  }

  // ==========================================
  // TOOLTIP DISMISSAL
  // ==========================================

  /**
   * Dismiss tooltip
   */
  async dismissTooltip(
    userId: string,
    tooltipId: string,
    duration: '15_days' | '30_days' | '60_days' | 'forever'
  ): Promise<void> {
    const db = await this.getDb();
    const id = uuidv4();
    const now = new Date();

    let showAgainAt: string | null = null;
    if (duration !== 'forever') {
      const days = duration === '15_days' ? 15 : duration === '30_days' ? 30 : 60;
      showAgainAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    }

    // NOTE: real unique constraint on tooltip_dismissals is (user_id, tooltip_id), not `id`
    // (id is a freshly generated UUID per call). Without an explicit conflict target on the
    // real constraint, Postgres never replaces the prior dismissal row — it just accumulates
    // duplicates and downstream reads of the latest dismiss_duration/show_again_at go stale.
    await db.run(
      `INSERT INTO tooltip_dismissals (id, user_id, tooltip_id, dismiss_duration, show_again_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (user_id, tooltip_id) DO UPDATE SET
               dismiss_duration = EXCLUDED.dismiss_duration,
               show_again_at = EXCLUDED.show_again_at`,
      [id, userId, tooltipId, duration, showAgainAt]
    );
  }

  /**
   * Check if tooltip is dismissed
   */
  async isTooltipDismissed(userId: string, tooltipId: string): Promise<boolean> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const dismissal = await db.get<{ show_again_at: string | null }>(
      `SELECT show_again_at FROM tooltip_dismissals 
             WHERE user_id = ? AND tooltip_id = ?`,
      [userId, tooltipId]
    );

    if (!dismissal) return false;

    // Forever dismissed
    if (!dismissal.show_again_at) return true;

    // Check if still within dismissal period
    return dismissal.show_again_at > now;
  }

  // ==========================================
  // SUPPORT TICKETS
  // ==========================================

  /**
   * Create support ticket
   */
  async createTicket(input: {
    organizationId: string;
    userId: string;
    subject: string;
    description: string;
    category?: string;
    priority?: string;
    relatedModule?: string;
  }): Promise<SupportTicket> {
    const db = await this.getDb();
    const id = `ticket-${uuidv4()}`;
    const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO support_tickets (
                id, ticket_number, organization_id, user_id, subject, description,
                category, priority, related_module, created_at, updated_at, last_activity_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        ticketNumber,
        input.organizationId,
        input.userId,
        input.subject,
        input.description,
        input.category || 'general',
        input.priority || 'medium',
        input.relatedModule || null,
        now,
        now,
        now,
      ]
    );

    // Add initial message
    await this.addTicketMessage(id, 'user', input.userId, input.description);

    logger.info(`[HelpService] Created support ticket ${ticketNumber}`);

    return this.getTicket(id) as Promise<SupportTicket>;
  }

  /**
   * Get ticket by ID
   */
  async getTicket(ticketId: string): Promise<SupportTicket | null> {
    const db = await this.getDb();

    const ticket = await db.get<{
      id: string;
      ticket_number: string;
      organization_id: string;
      user_id: string;
      subject: string;
      description: string;
      category: string;
      priority: string;
      status: string;
      assigned_to: string;
      resolution: string;
      satisfaction_rating: number;
      created_at: string;
      updated_at: string;
    }>(`SELECT * FROM support_tickets WHERE id = ?`, [ticketId]);

    if (!ticket) return null;

    return {
      id: ticket.id,
      ticketNumber: ticket.ticket_number,
      organizationId: ticket.organization_id,
      userId: ticket.user_id,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      assignedTo: ticket.assigned_to,
      resolution: ticket.resolution,
      satisfactionRating: ticket.satisfaction_rating,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
    };
  }

  /**
   * Get user's tickets
   */
  async getUserTickets(userId: string): Promise<SupportTicket[]> {
    const db = await this.getDb();

    const tickets = await db.all<{ id: string }>(
      `SELECT id FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );

    const result: SupportTicket[] = [];
    for (const t of tickets || []) {
      const ticket = await this.getTicket(t.id);
      if (ticket) result.push(ticket);
    }

    return result;
  }

  /**
   * Add message to ticket
   */
  async addTicketMessage(
    ticketId: string,
    senderType: 'user' | 'support' | 'system' | 'ai',
    senderId: string | null,
    message: string,
    isInternal: boolean = false
  ): Promise<string> {
    const db = await this.getDb();
    const id = `msg-${uuidv4()}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO ticket_messages (id, ticket_id, sender_type, sender_id, message, is_internal)
             VALUES (?, ?, ?, ?, ?, ?)`,
      [id, ticketId, senderType, senderId, message, isInternal ? 1 : 0]
    );

    // Update ticket last activity
    await db.run(`UPDATE support_tickets SET last_activity_at = ?, updated_at = ? WHERE id = ?`, [
      now,
      now,
      ticketId,
    ]);

    return id;
  }

  /**
   * Get ticket messages
   */
  async getTicketMessages(
    ticketId: string,
    includeInternal: boolean = false
  ): Promise<TicketMessage[]> {
    const db = await this.getDb();

    let query = `SELECT * FROM ticket_messages WHERE ticket_id = ?`;
    if (!includeInternal) {
      query += ` AND is_internal = 0`;
    }
    query += ` ORDER BY created_at ASC`;

    const messages = await db.all<{
      id: string;
      ticket_id: string;
      sender_type: string;
      sender_id: string;
      sender_name: string;
      message: string;
      attachments: string;
      is_internal: number;
      created_at: string;
    }>(query, [ticketId]);

    return (messages || []).map((m) => ({
      id: m.id,
      ticketId: m.ticket_id,
      senderType: m.sender_type as TicketMessage['senderType'],
      senderId: m.sender_id,
      senderName: m.sender_name,
      message: m.message,
      attachments: JSON.parse(m.attachments || '[]'),
      isInternal: m.is_internal === 1,
      createdAt: m.created_at,
    }));
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private async logInteraction(
    userId: string,
    interactionType: string,
    targetId: string,
    targetType: string,
    feedbackValue?: number,
    feedbackComment?: string
  ): Promise<void> {
    const db = await this.getDb();
    const id = uuidv4();

    await db.run(
      `INSERT INTO user_help_interactions (id, user_id, interaction_type, target_id, target_type, feedback_value, feedback_comment)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        interactionType,
        targetId,
        targetType,
        feedbackValue || null,
        feedbackComment || null,
      ]
    );
  }
}

// Export singleton
const helpService = new HelpService();
export default helpService;

// Named exports
export const getArticles = (filters?: Parameters<typeof helpService.getArticles>[0]) =>
  helpService.getArticles(filters);
export const getArticleBySlug = (slug: string, userId?: string) =>
  helpService.getArticleBySlug(slug, userId);
export const submitArticleFeedback = (
  articleId: string,
  userId: string,
  isHelpful: boolean,
  comment?: string
) => helpService.submitArticleFeedback(articleId, userId, isHelpful, comment);
export const getModuleHelp = (moduleKey: string) => helpService.getModuleHelp(moduleKey);
export const dismissTooltip = (
  userId: string,
  tooltipId: string,
  duration: Parameters<typeof helpService.dismissTooltip>[2]
) => helpService.dismissTooltip(userId, tooltipId, duration);
export const isTooltipDismissed = (userId: string, tooltipId: string) =>
  helpService.isTooltipDismissed(userId, tooltipId);
export const createTicket = (input: Parameters<typeof helpService.createTicket>[0]) =>
  helpService.createTicket(input);
export const getTicket = (ticketId: string) => helpService.getTicket(ticketId);
export const getUserTickets = (userId: string) => helpService.getUserTickets(userId);
export const addTicketMessage = (
  ticketId: string,
  senderType: Parameters<typeof helpService.addTicketMessage>[1],
  senderId: string | null,
  message: string,
  isInternal?: boolean
) => helpService.addTicketMessage(ticketId, senderType, senderId, message, isInternal);
export const getTicketMessages = (ticketId: string, includeInternal?: boolean) =>
  helpService.getTicketMessages(ticketId, includeInternal);
