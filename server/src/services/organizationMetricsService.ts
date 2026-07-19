/**
 * Organization Metrics Service
 * Provides business metrics for organizations
 */

import { createDatabase } from '../database/Database.js';
import logger from '../utils/Logger.js';

interface OrganizationMetricsOverview {
  activeUsers: number;
  selfServeUsers: number;
  orgStatus: 'trial' | 'paid' | 'enterprise';
  daysLeft?: number;
  conversionTarget?: string;
  seatConfiguration?: {
    seatsUsed: number;
    totalSeats: number;
    seatsRemaining: number;
    utilizationPercent: number;
  };
}

interface OrganizationHelpMetrics {
  byPlaybook: Array<{
    playbookKey: string;
    started: number;
    completed: number;
    completionRate: number;
  }>;
  totalStarted: number;
  totalCompleted: number;
  overallCompletionRate: number;
}

interface OrganizationTeamMetrics {
  invitations: {
    sent: number;
    accepted: number;
    pending: number;
    acceptanceRate: number;
  };
  seatManagement?: {
    seatsUsed: number;
    totalSeats: number;
    seatsRemaining: number;
    utilizationPercent: number;
  };
}

class OrganizationMetricsService {
  /**
   * Get organization overview metrics
   */
  async getOverview(organizationId: string): Promise<OrganizationMetricsOverview> {
    try {
      const db = await createDatabase();

      // Get active users (users who logged in within last 30 days)
      // Try user_sessions first, fallback to users table
      const activeUsersResult = await db
        .query<{ count: number }>(
          `
                SELECT COUNT(DISTINCT us.user_id) as count
                FROM user_sessions us
                INNER JOIN users u ON us.user_id = u.id
                WHERE u.organization_id = $1
                AND (us.last_active_at >= NOW() - INTERVAL '30 days' OR us.created_at >= NOW() - INTERVAL '30 days')
                `,
          [organizationId]
        )
        .catch(() => {
          // Fallback: count users with recent activity from activity_logs or just total users
          return db
            .query<{ count: number }>(
              `
                    SELECT COUNT(DISTINCT user_id) as count
                    FROM users
                    WHERE organization_id = $1
                    AND deleted_at IS NULL
                    `,
              [organizationId]
            )
            .catch(() => ({ rows: [{ count: 0 }] }));
        });

      const activeUsers = activeUsersResult.rows[0]?.count || 0;

      // Get total users in organization
      const totalUsersResult = await db
        .query<{ count: number }>(
          `
                SELECT COUNT(*) as count
                FROM users
                WHERE organization_id = $1
                AND deleted_at IS NULL
                `,
          [organizationId]
        )
        .catch(() => ({ rows: [{ count: 0 }] }));

      const totalUsers = totalUsersResult.rows[0]?.count || 0;

      // Get organization status (trial/paid/enterprise)
      const orgResult = await db
        .query<{
          status: string;
          plan: string;
          trial_ends_at?: string;
        }>(
          `
                SELECT 
                    status,
                    plan,
                    trial_ends_at
                FROM organizations
                WHERE id = $1
                `,
          [organizationId]
        )
        .catch(() => ({ rows: [] }));

      const org = orgResult.rows[0];
      const orgStatus =
        org?.status === 'trial' ? 'trial' : org?.plan === 'enterprise' ? 'enterprise' : 'paid';

      let daysLeft: number | undefined;
      if (org?.trial_ends_at) {
        const trialEnd = new Date(org.trial_ends_at);
        const now = new Date();
        daysLeft = Math.max(
          0,
          Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        );
      }

      // Get seat configuration if available
      const seatResult = await db
        .query<{
          seats_used: number;
          total_seats: number;
        }>(
          `
                SELECT 
                    COUNT(DISTINCT om.user_id) as seats_used,
                    COALESCE(MAX(ob.seats_limit), 0) as total_seats
                FROM organization_members om
                LEFT JOIN organization_billing ob ON om.organization_id = ob.organization_id
                WHERE om.organization_id = $1
                AND (om.status IS NULL OR om.status = 'ACTIVE')
                `,
          [organizationId]
        )
        .catch(() => ({ rows: [{ seats_used: 0, total_seats: 0 }] }));

      const seats = seatResult.rows[0];
      const seatsUsed = seats?.seats_used || 0;
      const totalSeats = seats?.total_seats || 0;
      const seatsRemaining = Math.max(0, totalSeats - seatsUsed);
      const utilizationPercent = totalSeats > 0 ? Math.round((seatsUsed / totalSeats) * 100) : 0;

      return {
        activeUsers: activeUsers || totalUsers,
        selfServeUsers: activeUsers,
        orgStatus,
        daysLeft,
        conversionTarget: orgStatus === 'trial' ? 'Paid' : 'Enterprise',
        seatConfiguration:
          totalSeats > 0
            ? {
                seatsUsed,
                totalSeats,
                seatsRemaining,
                utilizationPercent,
              }
            : undefined,
      };
    } catch (error: any) {
      logger.error('[OrganizationMetricsService] Error fetching overview:', error);
      // Return defaults on error
      return {
        activeUsers: 0,
        selfServeUsers: 0,
        orgStatus: 'trial',
        conversionTarget: 'Paid',
      };
    }
  }

  /**
   * Get help/playbook metrics for organization
   */
  async getHelpMetrics(organizationId: string): Promise<OrganizationHelpMetrics> {
    try {
      const db = await createDatabase();

      // Get playbook completion data from help_analytics
      const playbookResult = await db
        .query<{
          playbook_key: string;
          started: number;
          completed: number;
        }>(
          `
                SELECT 
                    COALESCE(metadata->>'playbookKey', 'unknown') as playbook_key,
                    COUNT(CASE WHEN event_type = 'view' OR event_type = 'click' THEN 1 END) as started,
                    COUNT(CASE WHEN event_type = 'complete' THEN 1 END) as completed
                FROM help_analytics
                WHERE organization_id = $1
                AND content_type = 'module'
                AND created_at >= NOW() - INTERVAL '30 days'
                GROUP BY playbook_key
                `,
          [organizationId]
        )
        .catch(() => ({ rows: [] }));

      const byPlaybook = playbookResult.rows.map((row) => {
        const started = Number(row.started) || 0;
        const completed = Number(row.completed) || 0;
        const completionRate = started > 0 ? Math.round((completed / started) * 100) : 0;

        return {
          playbookKey: row.playbook_key || 'unknown',
          started,
          completed,
          completionRate,
        };
      });

      // If no data, return empty structure
      if (byPlaybook.length === 0) {
        return {
          byPlaybook: [],
          totalStarted: 0,
          totalCompleted: 0,
          overallCompletionRate: 0,
        };
      }

      const totalStarted = byPlaybook.reduce((sum, p) => sum + p.started, 0);
      const totalCompleted = byPlaybook.reduce((sum, p) => sum + p.completed, 0);
      const overallCompletionRate =
        totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 100) : 0;

      return {
        byPlaybook,
        totalStarted,
        totalCompleted,
        overallCompletionRate,
      };
    } catch (error: any) {
      logger.error('[OrganizationMetricsService] Error fetching help metrics:', error);
      return {
        byPlaybook: [],
        totalStarted: 0,
        totalCompleted: 0,
        overallCompletionRate: 0,
      };
    }
  }

  /**
   * Get team/invitation metrics for organization
   */
  async getTeamMetrics(organizationId: string): Promise<OrganizationTeamMetrics> {
    try {
      const db = await createDatabase();

      // Get invitation data - check if invitations table exists
      // For now, we'll use organization_members to infer invitations
      const membersResult = await db
        .query<{ count: number }>(
          `
                SELECT COUNT(*) as count
                FROM organization_members
                WHERE organization_id = $1
                AND deleted_at IS NULL
                `,
          [organizationId]
        )
        .catch(() => ({ rows: [{ count: 0 }] }));

      const totalMembers = membersResult.rows[0]?.count || 0;

      // Get active users (accepted invitations)
      const activeResult = await db
        .query<{ count: number }>(
          `
                SELECT COUNT(DISTINCT us.user_id) as count
                FROM user_sessions us
                INNER JOIN users u ON us.user_id = u.id
                WHERE u.organization_id = $1
                AND (us.last_active_at >= NOW() - INTERVAL '30 days' OR us.created_at >= NOW() - INTERVAL '30 days')
                `,
          [organizationId]
        )
        .catch(() => {
          // Fallback: count total members
          return db
            .query<{ count: number }>(
              `
                    SELECT COUNT(*) as count
                    FROM organization_members
                    WHERE organization_id = $1
                    AND (status IS NULL OR status = 'ACTIVE')
                    `,
              [organizationId]
            )
            .catch(() => ({ rows: [{ count: 0 }] }));
        });

      const accepted = activeResult.rows[0]?.count || 0;
      const sent = totalMembers; // Assume all members were invited
      const pending = Math.max(0, sent - accepted);
      const acceptanceRate = sent > 0 ? Math.round((accepted / sent) * 100) : 0;

      // Get seat configuration
      const seatResult = await db
        .query<{
          seats_used: number;
          total_seats: number;
        }>(
          `
                SELECT 
                    COUNT(DISTINCT om.user_id) as seats_used,
                    COALESCE(MAX(ob.seats_limit), 0) as total_seats
                FROM organization_members om
                LEFT JOIN organization_billing ob ON om.organization_id = ob.organization_id
                WHERE om.organization_id = $1
                AND (om.status IS NULL OR om.status = 'ACTIVE')
                `,
          [organizationId]
        )
        .catch(() => ({ rows: [{ seats_used: 0, total_seats: 0 }] }));

      const seats = seatResult.rows[0];
      const seatsUsed = seats?.seats_used || 0;
      const totalSeats = seats?.total_seats || 0;
      const seatsRemaining = Math.max(0, totalSeats - seatsUsed);
      const utilizationPercent = totalSeats > 0 ? Math.round((seatsUsed / totalSeats) * 100) : 0;

      return {
        invitations: {
          sent,
          accepted,
          pending,
          acceptanceRate,
        },
        seatManagement:
          totalSeats > 0
            ? {
                seatsUsed,
                totalSeats,
                seatsRemaining,
                utilizationPercent,
              }
            : undefined,
      };
    } catch (error: any) {
      logger.error('[OrganizationMetricsService] Error fetching team metrics:', error);
      return {
        invitations: {
          sent: 0,
          accepted: 0,
          pending: 0,
          acceptanceRate: 0,
        },
      };
    }
  }

  /**
   * Get AI analytics metrics for organization
   */
  async getAIAnalytics(organizationId: string): Promise<{
    successRate: number;
    avgResponseTime: number;
    totalTokens: number;
    estCost: number;
    usageTrend: Array<{ date: string; tokens: number; cost: number }>;
    byProvider: Array<{ provider: string; tokens: number; cost: number; successRate: number }>;
    topFailureModes: Array<{ mode: string; count: number }>;
  }> {
    try {
      const db = await createDatabase();

      // Get overall stats for last 30 days
      const statsResult = await db
        .query<{
          total_calls: number;
          success_calls: number;
          total_tokens: number;
          avg_latency: number;
        }>(
          `
                SELECT 
                    COUNT(*) as total_calls,
                    COUNT(CASE WHEN status = 'success' THEN 1 END) as success_calls,
                    COALESCE(SUM(tokens_used), 0) as total_tokens,
                    COALESCE(AVG(latency_ms), 0) as avg_latency
                FROM ai_usage_logs
                WHERE organization_id = $1
                AND created_at >= datetime('now', '-30 days')
                `,
          [organizationId]
        )
        .catch(() => ({
          rows: [{ total_calls: 0, success_calls: 0, total_tokens: 0, avg_latency: 0 }],
        }));

      const stats = statsResult.rows[0];
      const totalCalls = Number(stats?.total_calls) || 0;
      const successCalls = Number(stats?.success_calls) || 0;
      const totalTokens = Number(stats?.total_tokens) || 0;
      const avgLatency = Number(stats?.avg_latency) || 0;

      const successRate = totalCalls > 0 ? successCalls / totalCalls : 0;
      const avgResponseTime = avgLatency / 1000; // Convert to seconds
      // Estimate cost: ~$0.002 per 1K tokens (rough average)
      const estCost = (totalTokens / 1000) * 0.002;

      // Get usage trend by day
      const trendResult = await db
        .query<{
          date: string;
          tokens: number;
        }>(
          `
                SELECT 
                    date(created_at) as date,
                    COALESCE(SUM(tokens_used), 0) as tokens
                FROM ai_usage_logs
                WHERE organization_id = $1
                AND created_at >= datetime('now', '-30 days')
                GROUP BY date(created_at)
                ORDER BY date
                `,
          [organizationId]
        )
        .catch(() => ({ rows: [] }));

      const usageTrend = trendResult.rows.map((row) => ({
        date: row.date,
        tokens: Number(row.tokens) || 0,
        cost: ((Number(row.tokens) || 0) / 1000) * 0.002,
      }));

      // Get stats by provider
      const providerResult = await db
        .query<{
          provider: string;
          tokens: number;
          success_count: number;
          total_count: number;
        }>(
          `
                SELECT 
                    provider,
                    COALESCE(SUM(tokens_used), 0) as tokens,
                    COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
                    COUNT(*) as total_count
                FROM ai_usage_logs
                WHERE organization_id = $1
                AND created_at >= datetime('now', '-30 days')
                GROUP BY provider
                `,
          [organizationId]
        )
        .catch(() => ({ rows: [] }));

      const byProvider = providerResult.rows.map((row) => ({
        provider: row.provider || 'Unknown',
        tokens: Number(row.tokens) || 0,
        cost: ((Number(row.tokens) || 0) / 1000) * 0.002,
        successRate:
          Number(row.total_count) > 0 ? Number(row.success_count) / Number(row.total_count) : 0,
      }));

      // Get top failure modes
      const failureResult = await db
        .query<{
          mode: string;
          count: number;
        }>(
          `
                SELECT 
                    COALESCE(error_message, 'Unknown Error') as mode,
                    COUNT(*) as count
                FROM ai_usage_logs
                WHERE organization_id = $1
                AND status != 'success'
                AND created_at >= datetime('now', '-30 days')
                GROUP BY error_message
                ORDER BY count DESC
                LIMIT 5
                `,
          [organizationId]
        )
        .catch(() => ({ rows: [] }));

      const topFailureModes = failureResult.rows.map((row) => ({
        mode: row.mode,
        count: Number(row.count) || 0,
      }));

      return {
        successRate,
        avgResponseTime,
        totalTokens,
        estCost,
        usageTrend,
        byProvider,
        topFailureModes,
      };
    } catch (error: any) {
      logger.error('[OrganizationMetricsService] Error fetching AI analytics:', error);
      return {
        successRate: 0,
        avgResponseTime: 0,
        totalTokens: 0,
        estCost: 0,
        usageTrend: [],
        byProvider: [],
        topFailureModes: [],
      };
    }
  }
  /**
   * Get recent metric events for organization
   */
  async getMetricEvents(
    organizationId: string,
    limit: number = 20
  ): Promise<{
    events: Array<{
      id: string;
      event_type: string;
      created_at: string;
      source: string;
      context: Record<string, any>;
    }>;
  }> {
    try {
      const db = await createDatabase();

      // Get recent events from multiple sources
      const eventsResult = await db
        .query<{
          id: string;
          event_type: string;
          created_at: string;
          source: string;
          context: string;
        }>(
          `
                SELECT 
                    id,
                    event_type,
                    created_at,
                    'help_analytics' as source,
                    jsonb_build_object('playbookKey', COALESCE(NULLIF(metadata, '')::jsonb ->> 'playbookKey', content_type))::text as context
                FROM help_analytics
                WHERE organization_id = $1
                AND created_at >= NOW() - INTERVAL '30 days'

                UNION ALL

                SELECT
                    id,
                    'user_' || COALESCE(status, 'active') as event_type,
                    COALESCE(updated_at, created_at) as created_at,
                    'organization_members' as source,
                    jsonb_build_object('email', user_id)::text as context
                FROM organization_members
                WHERE organization_id = $1
                AND created_at >= datetime('now', '-30 days')
                
                ORDER BY created_at DESC
                LIMIT $2
                `,
          [organizationId, limit]
        )
        .catch(() => ({ rows: [] }));

      const events = eventsResult.rows.map((row) => ({
        id: row.id,
        event_type: row.event_type || 'system_event',
        created_at: row.created_at,
        source: row.source,
        context: row.context ? JSON.parse(row.context) : {},
      }));

      return { events };
    } catch (error: any) {
      logger.error('[OrganizationMetricsService] Error fetching metric events:', error);
      return { events: [] };
    }
  }
}

let instance: OrganizationMetricsService | null = null;

export function getOrganizationMetricsService(): OrganizationMetricsService {
  if (!instance) {
    instance = new OrganizationMetricsService();
  }
  return instance;
}

export default OrganizationMetricsService;
