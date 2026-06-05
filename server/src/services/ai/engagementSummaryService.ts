/**
 * Engagement Summary Service (R13)
 *
 * Generates periodic (weekly/monthly) engagement summaries for clients.
 * These are structured executive reports that can be exported as artifacts.
 *
 * Summary includes:
 * - Executive overview (what changed this period)
 * - Key decisions made (from Deep Thinking sessions)
 * - Risk register updates (new, escalated, resolved)
 * - Initiative progress scorecard (started/completed/blocked)
 * - Top 3 recommendations for next period
 *
 * @version 1.0.0
 */

import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';
import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface EngagementSummaryRequest {
  organizationId: string;
  projectId?: string;
  userId: string;
  period: 'weekly' | 'monthly';
  language?: string;
}

export interface EngagementSummary {
  period: string;
  dateRange: { from: string; to: string };
  /**
   * How the narrative parts (executiveOverview, recommendations) were produced.
   *
   * HONESTY FLAG: this service composes its prose deterministically from
   * aggregate metrics using fixed templates/heuristics — it does NOT call an
   * LLM. It is mounted under the `/ai` route namespace, so without this flag a
   * consumer could mistake the output for an AI-generated summary. The value is
   * always `'deterministic'` today; it exists so the UI/consumer can label the
   * report truthfully (e.g. "Auto-generated from metrics" rather than
   * "AI summary"). If an LLM-backed path is ever added, set this to `'ai'` on
   * that path only.
   */
  method: 'deterministic' | 'ai';
  executiveOverview: string;
  keyDecisions: Array<{
    title: string;
    outcome: string;
    date: string;
  }>;
  initiativeScorecard: {
    total: number;
    completed: number;
    inProgress: number;
    blocked: number;
    newlyCreated: number;
  };
  riskUpdates: Array<{
    title: string;
    status: string;
    impact: string;
  }>;
  taskMetrics: {
    completed: number;
    overdue: number;
    created: number;
  };
  aiInteractions: {
    totalConversations: number;
    deepThinkingSessions: number;
    researchQueries: number;
  };
  recommendations: string[];
}

// ==========================================
// SERVICE
// ==========================================

class EngagementSummaryService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  /**
   * Generate a comprehensive engagement summary for the specified period.
   */
  async generateSummary(request: EngagementSummaryRequest): Promise<EngagementSummary> {
    const db = await this.getDb();
    const periodDays = request.period === 'weekly' ? 7 : 30;
    const dateFrom = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
    const dateTo = new Date().toISOString();

    logger.info(
      `[EngagementSummary] Generating ${request.period} summary for org ${request.organizationId}`
    );

    // Run all data collection in parallel
    const [decisions, initiativeStats, riskUpdates, taskMetrics, aiMetrics] = await Promise.all([
      this.collectDecisions(db, request, dateFrom),
      this.collectInitiativeStats(db, request, dateFrom),
      this.collectRiskUpdates(db, request, dateFrom),
      this.collectTaskMetrics(db, request, dateFrom),
      this.collectAIMetrics(db, request, dateFrom),
    ]);

    // Build executive overview
    const executiveOverview = this.buildExecutiveOverview(
      request.period,
      initiativeStats,
      taskMetrics,
      decisions,
      riskUpdates,
      request.language
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      initiativeStats,
      taskMetrics,
      riskUpdates,
      request.language
    );

    return {
      period: request.period,
      dateRange: { from: dateFrom.slice(0, 10), to: dateTo.slice(0, 10) },
      // Narrative is template/rule-based, not LLM-generated — see `method` doc.
      method: 'deterministic',
      executiveOverview,
      keyDecisions: decisions,
      initiativeScorecard: initiativeStats,
      riskUpdates,
      taskMetrics,
      aiInteractions: aiMetrics,
      recommendations,
    };
  }

  /**
   * Format summary as a Markdown artifact ready for export.
   */
  formatAsArtifact(summary: EngagementSummary, language?: string): string {
    const isPl = language === 'pl';
    const lines: string[] = [];

    lines.push(
      `# ${isPl ? 'Raport Zaangażowania' : 'Engagement Report'} — ${summary.period === 'weekly' ? (isPl ? 'Tydzień' : 'Week') : isPl ? 'Miesiąc' : 'Month'}`
    );
    lines.push(
      `**${isPl ? 'Okres' : 'Period'}:** ${summary.dateRange.from} — ${summary.dateRange.to}\n`
    );

    lines.push(`## ${isPl ? 'Przegląd Wykonawczy' : 'Executive Overview'}`);
    lines.push(summary.executiveOverview + '\n');

    lines.push(`## ${isPl ? 'Scorecard Inicjatyw' : 'Initiative Scorecard'}`);
    const sc = summary.initiativeScorecard;
    lines.push(`| ${isPl ? 'Metryka' : 'Metric'} | ${isPl ? 'Wartość' : 'Value'} |`);
    lines.push('|---|---|');
    lines.push(`| ${isPl ? 'Łącznie aktywnych' : 'Total active'} | ${sc.total} |`);
    lines.push(`| ${isPl ? 'Ukończone' : 'Completed'} | ${sc.completed} |`);
    lines.push(`| ${isPl ? 'W toku' : 'In Progress'} | ${sc.inProgress} |`);
    lines.push(`| ${isPl ? 'Zablokowane' : 'Blocked'} | ${sc.blocked} |`);
    lines.push(`| ${isPl ? 'Nowo utworzone' : 'Newly Created'} | ${sc.newlyCreated} |\n`);

    if (summary.keyDecisions.length > 0) {
      lines.push(`## ${isPl ? 'Kluczowe Decyzje' : 'Key Decisions'}`);
      for (const d of summary.keyDecisions) {
        lines.push(`- **${d.title}** — ${d.outcome} *(${d.date})*`);
      }
      lines.push('');
    }

    if (summary.riskUpdates.length > 0) {
      lines.push(`## ${isPl ? 'Aktualizacja Ryzyk' : 'Risk Updates'}`);
      for (const r of summary.riskUpdates) {
        lines.push(`- [${r.status}] ${r.title} — ${isPl ? 'wpływ' : 'impact'}: ${r.impact}`);
      }
      lines.push('');
    }

    lines.push(`## ${isPl ? 'Metryki Zadań' : 'Task Metrics'}`);
    lines.push(`- ${isPl ? 'Ukończone' : 'Completed'}: ${summary.taskMetrics.completed}`);
    lines.push(`- ${isPl ? 'Przeterminowane' : 'Overdue'}: ${summary.taskMetrics.overdue}`);
    lines.push(`- ${isPl ? 'Utworzone' : 'Created'}: ${summary.taskMetrics.created}\n`);

    lines.push(`## ${isPl ? 'Aktywność AI' : 'AI Activity'}`);
    lines.push(
      `- ${isPl ? 'Konwersacje' : 'Conversations'}: ${summary.aiInteractions.totalConversations}`
    );
    lines.push(`- Deep Thinking: ${summary.aiInteractions.deepThinkingSessions}`);
    lines.push(
      `- ${isPl ? 'Badania' : 'Research queries'}: ${summary.aiInteractions.researchQueries}\n`
    );

    if (summary.recommendations.length > 0) {
      lines.push(
        `## ${isPl ? 'Rekomendacje na Następny Okres' : 'Recommendations for Next Period'}`
      );
      summary.recommendations.forEach((r, i) => {
        lines.push(`${i + 1}. ${r}`);
      });
    }

    // HONESTY FOOTER: be explicit that the prose is auto-composed from metrics
    // (rule-based), not written by an AI model, so the artifact never
    // misrepresents how it was generated.
    if (summary.method === 'deterministic') {
      lines.push('');
      lines.push('---');
      lines.push(
        isPl
          ? '_Raport wygenerowany automatycznie na podstawie metryk (reguły), bez modelu AI._'
          : '_Report auto-generated from metrics (rule-based), not written by an AI model._'
      );
    }

    return lines.join('\n');
  }

  // ==========================================
  // DATA COLLECTION
  // ==========================================

  private async collectDecisions(
    db: IDatabase,
    req: EngagementSummaryRequest,
    since: string
  ): Promise<EngagementSummary['keyDecisions']> {
    try {
      const rows = await db.all(
        `SELECT title, chosen_option, outcome, created_at FROM deep_thinking_decisions
         WHERE organization_id = ? AND created_at > ?
         ORDER BY created_at DESC LIMIT 5`,
        [req.organizationId, since]
      );
      return (rows || []).map((r: any) => ({
        title: r.title || 'Decision',
        outcome: r.chosen_option || r.outcome || 'Pending',
        date: r.created_at?.slice(0, 10) || '',
      }));
    } catch {
      return [];
    }
  }

  private async collectInitiativeStats(
    db: IDatabase,
    req: EngagementSummaryRequest,
    since: string
  ): Promise<EngagementSummary['initiativeScorecard']> {
    const projectFilter = req.projectId ? 'AND project_id = ?' : '';
    const params: any[] = req.projectId
      ? [req.organizationId, req.projectId]
      : [req.organizationId];

    try {
      const stats = (await db.get(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN i.status IN ('active', 'in_progress') THEN 1 ELSE 0 END) as in_progress,
           SUM(CASE WHEN i.status = 'blocked' THEN 1 ELSE 0 END) as blocked,
           SUM(CASE WHEN i.created_at > ? THEN 1 ELSE 0 END) as newly_created
         FROM initiatives i
         JOIN projects p ON i.project_id = p.id
         WHERE p.organization_id = ? ${projectFilter}`,
        [since, ...params]
      )) as any;

      return {
        total: stats?.total || 0,
        completed: stats?.completed || 0,
        inProgress: stats?.in_progress || 0,
        blocked: stats?.blocked || 0,
        newlyCreated: stats?.newly_created || 0,
      };
    } catch {
      return { total: 0, completed: 0, inProgress: 0, blocked: 0, newlyCreated: 0 };
    }
  }

  private async collectRiskUpdates(
    db: IDatabase,
    req: EngagementSummaryRequest,
    since: string
  ): Promise<EngagementSummary['riskUpdates']> {
    try {
      const rows = await db.all(
        `SELECT title, status, impact FROM raid_items
         WHERE organization_id = ? AND type = 'risk' AND updated_at > ?
         ORDER BY impact DESC LIMIT 5`,
        [req.organizationId, since]
      );
      return (rows || []).map((r: any) => ({
        title: r.title || 'Risk',
        status: r.status || 'open',
        impact: r.impact || 'medium',
      }));
    } catch {
      return [];
    }
  }

  private async collectTaskMetrics(
    db: IDatabase,
    req: EngagementSummaryRequest,
    since: string
  ): Promise<EngagementSummary['taskMetrics']> {
    try {
      const stats = (await db.get(
        `SELECT
           SUM(CASE WHEN t.status = 'completed' AND t.updated_at > ? THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN t.due_date < datetime('now') AND t.status NOT IN ('completed', 'cancelled') THEN 1 ELSE 0 END) as overdue,
           SUM(CASE WHEN t.created_at > ? THEN 1 ELSE 0 END) as created
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE p.organization_id = ?`,
        [since, since, req.organizationId]
      )) as any;

      return {
        completed: stats?.completed || 0,
        overdue: stats?.overdue || 0,
        created: stats?.created || 0,
      };
    } catch {
      return { completed: 0, overdue: 0, created: 0 };
    }
  }

  private async collectAIMetrics(
    db: IDatabase,
    req: EngagementSummaryRequest,
    since: string
  ): Promise<EngagementSummary['aiInteractions']> {
    try {
      const stats = (await db.get(
        `SELECT
           COUNT(DISTINCT c.id) as conversations,
           SUM(CASE WHEN c.metadata LIKE '%deepResearch%' THEN 1 ELSE 0 END) as deep_thinking,
           SUM(CASE WHEN c.metadata LIKE '%webSearch%' THEN 1 ELSE 0 END) as research
         FROM conversations c
         WHERE c.organization_id = ? AND c.created_at > ?`,
        [req.organizationId, since]
      )) as any;

      return {
        totalConversations: stats?.conversations || 0,
        deepThinkingSessions: stats?.deep_thinking || 0,
        researchQueries: stats?.research || 0,
      };
    } catch {
      return { totalConversations: 0, deepThinkingSessions: 0, researchQueries: 0 };
    }
  }

  // ==========================================
  // ANALYSIS
  // ==========================================

  private buildExecutiveOverview(
    period: string,
    initiatives: EngagementSummary['initiativeScorecard'],
    tasks: EngagementSummary['taskMetrics'],
    decisions: EngagementSummary['keyDecisions'],
    risks: EngagementSummary['riskUpdates'],
    language?: string
  ): string {
    const isPl = language === 'pl';

    const highlights: string[] = [];

    if (initiatives.completed > 0) {
      highlights.push(
        isPl
          ? `Ukończono ${initiatives.completed} inicjatyw${initiatives.completed > 1 ? '' : 'ę'}`
          : `Completed ${initiatives.completed} initiative${initiatives.completed > 1 ? 's' : ''}`
      );
    }

    if (initiatives.blocked > 0) {
      highlights.push(
        isPl
          ? `${initiatives.blocked} inicjatyw${initiatives.blocked > 1 ? '' : 'a'} zablokowanych`
          : `${initiatives.blocked} initiative${initiatives.blocked > 1 ? 's' : ''} blocked`
      );
    }

    if (tasks.completed > 0) {
      highlights.push(
        isPl ? `Zamknięto ${tasks.completed} zadań` : `Closed ${tasks.completed} tasks`
      );
    }

    if (tasks.overdue > 0) {
      highlights.push(
        isPl
          ? `${tasks.overdue} zadań przeterminowanych wymaga uwagi`
          : `${tasks.overdue} overdue tasks need attention`
      );
    }

    if (decisions.length > 0) {
      highlights.push(
        isPl
          ? `Podjęto ${decisions.length} kluczowych decyzji strategicznych`
          : `Made ${decisions.length} key strategic decisions`
      );
    }

    if (risks.length > 0) {
      const highRisks = risks.filter((r) => r.impact === 'high' || r.impact === 'critical').length;
      if (highRisks > 0) {
        highlights.push(
          isPl
            ? `${highRisks} ryzyk o wysokim wpływie wymaga eskalacji`
            : `${highRisks} high-impact risks require escalation`
        );
      }
    }

    return highlights.length > 0
      ? highlights.join('. ') + '.'
      : isPl
        ? 'Brak istotnych zmian w tym okresie.'
        : 'No significant changes in this period.';
  }

  private generateRecommendations(
    initiatives: EngagementSummary['initiativeScorecard'],
    tasks: EngagementSummary['taskMetrics'],
    risks: EngagementSummary['riskUpdates'],
    language?: string
  ): string[] {
    const isPl = language === 'pl';
    const recs: string[] = [];

    if (initiatives.blocked > 0) {
      recs.push(
        isPl
          ? `Zaplanuj sesję deblokowania dla ${initiatives.blocked} zablokowanych inicjatyw — zidentyfikuj root cause i przypisz właścicieli rozwiązań`
          : `Schedule an unblocking session for ${initiatives.blocked} blocked initiatives — identify root causes and assign resolution owners`
      );
    }

    if (tasks.overdue > tasks.completed * 0.3) {
      recs.push(
        isPl
          ? `Przeterminowania (${tasks.overdue}) przekraczają 30% ukończonych zadań — przeprowadź triaging z zespołem (deleguj, przesuń lub anuluj)`
          : `Overdue tasks (${tasks.overdue}) exceed 30% of completed — run a triage session (delegate, reschedule, or cancel)`
      );
    }

    const highRisks = risks.filter((r) => r.impact === 'high' || r.impact === 'critical');
    if (highRisks.length > 0) {
      recs.push(
        isPl
          ? `Eskaluj ${highRisks.length} ryzyk o wysokim wpływie do Steering Committee z proponowanymi mitigation actions`
          : `Escalate ${highRisks.length} high-impact risks to Steering Committee with proposed mitigation actions`
      );
    }

    if (initiatives.total > 0 && initiatives.completed / initiatives.total < 0.1) {
      recs.push(
        isPl
          ? `Niska stopa ukończenia inicjatyw (<10%) — rozważ zmniejszenie scope lub zwiększenie zasobów`
          : `Low initiative completion rate (<10%) — consider reducing scope or increasing resources`
      );
    }

    // Always add a strategic recommendation
    if (recs.length === 0) {
      recs.push(
        isPl
          ? `Zaplanuj przegląd strategiczny — upewnij się, że bieżące inicjatywy są nadal aligned z celami organizacji`
          : `Schedule a strategic review — ensure current initiatives remain aligned with organizational goals`
      );
    }

    return recs.slice(0, 3);
  }
}

const engagementSummaryService = new EngagementSummaryService();
export default engagementSummaryService;
export { EngagementSummaryService, engagementSummaryService };
