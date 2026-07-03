/**
 * Text-to-SQL Service
 *
 * Translates natural language questions into SQL queries against
 * read-only database views. Includes schema awareness, query sandboxing,
 * and result formatting.
 */
import { all as dbAll } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export interface TextToSqlResult {
  question: string;
  generatedSql: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  columns: string[];
  dataDomain: string;
  warning?: string;
}

const DOMAIN_SCHEMAS: Record<
  string,
  { tables: string[]; description: string; sampleColumns: string[] }
> = {
  initiatives: {
    tables: ['initiatives'],
    description: 'Initiatives with ROI, status, priority, timeline, budget, and category data',
    sampleColumns: [
      'id',
      'title',
      'description',
      'status',
      'priority',
      'category',
      'expected_roi',
      'estimated_cost',
      'estimated_benefit',
      'start_date',
      'end_date',
      'owner_id',
      'organization_id',
      'created_at',
    ],
  },
  assessments: {
    tables: ['assessment_dimensions', 'assessment_scores'],
    description: 'Assessment dimensions, scores, maturity levels, and improvement areas',
    sampleColumns: [
      'id',
      'dimension_name',
      'score',
      'max_score',
      'maturity_level',
      'assessment_id',
      'organization_id',
      'created_at',
    ],
  },
  financials: {
    tables: ['financial_analyses', 'financial_statements'],
    description: 'Financial analyses, statements, revenue, costs, and projections',
    sampleColumns: [
      'id',
      'type',
      'period',
      'revenue',
      'costs',
      'profit',
      'margin',
      'organization_id',
      'created_at',
    ],
  },
  tasks: {
    tables: ['tasks'],
    description: 'Tasks with assignee, status, priority, due dates, and initiative linkage',
    sampleColumns: [
      'id',
      'title',
      'status',
      'priority',
      'assignee_id',
      'initiative_id',
      'due_date',
      'completed_at',
      'organization_id',
    ],
  },
  decisions: {
    tables: ['decisions'],
    description: 'Decisions with type, status, impact, stakeholders, and outcomes',
    sampleColumns: [
      'id',
      'title',
      'decision_type',
      'status',
      'impact_level',
      'decided_by',
      'decided_at',
      'organization_id',
    ],
  },
  kpis: {
    tables: ['kpi_values', 'kpi_definitions'],
    description: 'KPI definitions, target values, actual values, and trends',
    sampleColumns: [
      'id',
      'kpi_name',
      'target_value',
      'actual_value',
      'unit',
      'period',
      'organization_id',
      'created_at',
    ],
  },
};

const FORBIDDEN_PATTERNS = [
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b/i,
  /\b(EXEC|EXECUTE|CALL)\b/i,
  /;\s*(INSERT|UPDATE|DELETE|DROP)/i,
  /--/,
  /\/\*/,
];

class TextToSqlService {
  async query(input: {
    question: string;
    dataDomain?: string;
    organizationId: string;
    limit?: number;
  }): Promise<TextToSqlResult> {
    const domain = input.dataDomain || this.inferDomain(input.question);
    const schema = DOMAIN_SCHEMAS[domain];

    if (!schema) {
      throw new Error(
        `Unknown data domain: ${domain}. Available: ${Object.keys(DOMAIN_SCHEMAS).join(', ')}`
      );
    }

    const sql = this.generateSql(
      input.question,
      domain,
      schema,
      input.organizationId,
      input.limit || 25
    );

    this.validateSql(sql);

    try {
      const rows = (await dbAll(sql.query, sql.params)) as Record<string, unknown>[];
      const safeRows = (rows || []).slice(0, input.limit || 25);
      const columns = safeRows.length > 0 ? Object.keys(safeRows[0]) : [];

      return {
        question: input.question,
        generatedSql: sql.query,
        rows: safeRows,
        rowCount: safeRows.length,
        columns,
        dataDomain: domain,
        warning:
          safeRows.length >= (input.limit || 25)
            ? `Results truncated to ${input.limit || 25} rows`
            : undefined,
      };
    } catch (err: any) {
      logger.warn(`[TextToSQL] Query execution failed: ${err?.message}`);
      throw new Error(`Query execution failed: ${err?.message}`);
    }
  }

  private inferDomain(question: string): string {
    const q = question.toLowerCase();
    if (/\b(initiative|projekt|roi|budżet|budget)\b/.test(q)) return 'initiatives';
    if (/\b(assessment|ocena|maturity|dojrzałość|dimension)\b/.test(q)) return 'assessments';
    if (/\b(financial|revenue|cost|profit|przychód|koszt|zysk)\b/.test(q)) return 'financials';
    if (/\b(task|zadanie|assignee|due date|termin)\b/.test(q)) return 'tasks';
    if (/\b(decision|decyzja|stakeholder)\b/.test(q)) return 'decisions';
    if (/\b(kpi|metric|target|cel|wskaźnik)\b/.test(q)) return 'kpis';
    return 'initiatives';
  }

  private generateSql(
    question: string,
    domain: string,
    schema: { tables: string[]; sampleColumns: string[] },
    orgId: string,
    limit: number
  ): { query: string; params: unknown[] } {
    const table = schema.tables[0];
    const q = question.toLowerCase();

    const conditions: string[] = ['organization_id = ?'];
    const params: unknown[] = [orgId];
    let orderBy = 'created_at DESC';
    let selectCols = '*';

    if (/\bstatus\s*=\s*['"]?(\w+)/i.test(q)) {
      const match = q.match(/status\s*=\s*['"]?(\w+)/i);
      if (match) {
        conditions.push('status = ?');
        params.push(match[1]);
      }
    }

    if (/\bpriority\s*=\s*['"]?(\w+)/i.test(q)) {
      const match = q.match(/priority\s*=\s*['"]?(\w+)/i);
      if (match) {
        conditions.push('priority = ?');
        params.push(match[1]);
      }
    }

    if (/roi\s*>\s*(\d+)/i.test(q)) {
      const match = q.match(/roi\s*>\s*(\d+)/i);
      if (match) {
        conditions.push('expected_roi > ?');
        params.push(Number(match[1]));
      }
    }

    if (/roi\s*<\s*(\d+)/i.test(q)) {
      const match = q.match(/roi\s*<\s*(\d+)/i);
      if (match) {
        conditions.push('expected_roi < ?');
        params.push(Number(match[1]));
      }
    }

    if (/\b(top|highest|biggest|largest|najwyż|największ)/i.test(q)) {
      if (domain === 'initiatives') orderBy = 'expected_roi DESC';
      if (domain === 'financials') orderBy = 'revenue DESC';
    }

    if (/\b(count|ile|how many|liczba)\b/i.test(q)) {
      selectCols = 'COUNT(*) as count';
      if (/\bby\s+(\w+)/i.test(q) || /\bwedług\s+(\w+)/i.test(q)) {
        const match = q.match(/(?:by|według)\s+(\w+)/i);
        if (match && schema.sampleColumns.includes(match[1])) {
          selectCols = `${match[1]}, COUNT(*) as count`;
          orderBy = 'count DESC';
        }
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const groupBy =
      selectCols.includes(',') && selectCols.includes('COUNT')
        ? `GROUP BY ${selectCols.split(',')[0].trim()}`
        : '';

    const query = `SELECT ${selectCols} FROM ${table} ${whereClause} ${groupBy} ORDER BY ${orderBy} LIMIT ?`;
    params.push(limit);

    return { query, params };
  }

  private validateSql(sql: { query: string }): void {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(sql.query)) {
        throw new Error(
          'Query contains forbidden SQL operations. Only SELECT queries are allowed.'
        );
      }
    }

    if (!/^\s*SELECT\b/i.test(sql.query)) {
      throw new Error('Only SELECT queries are allowed.');
    }
  }
}

export const textToSqlService = new TextToSqlService();
export default textToSqlService;
