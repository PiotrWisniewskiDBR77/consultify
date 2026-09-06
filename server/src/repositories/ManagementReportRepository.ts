// @ts-nocheck
import { getDatabase } from '../database/index.js';
const db = getDatabase();

class ManagementReportRepository {
  constructor() {
    this.db = db;
  }

  // ==========================================
  // CORE REPORT OPERATIONS
  // ==========================================

  async saveReport(report) {
    const sql = `
            INSERT INTO management_reports 
            (id, organization_id, project_id, report_type, scope, title, period_start, period_end, status, generated_by, content, ai_narrative, ai_warnings, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    const params = [
      report.id,
      report.organizationId,
      report.projectId,
      report.reportType,
      report.scope,
      report.title,
      report.periodStart,
      report.periodEnd,
      report.status,
      report.generatedBy,
      JSON.stringify(report.content),
      report.aiNarrative,
      JSON.stringify(report.aiWarnings),
      report.createdAt,
    ];

    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getReportById(reportId) {
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT * FROM management_reports WHERE id = ?`, [reportId], (err, row) => {
        if (err) reject(err);
        else if (row) {
          row.content = row.content ? JSON.parse(row.content) : null;
          row.aiWarnings = row.ai_warnings ? JSON.parse(row.ai_warnings) : [];
          resolve(row);
        } else {
          resolve(null);
        }
      });
    });
  }

  async getReportByIdForOrganization(reportId, organizationId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM management_reports WHERE id = ? AND organization_id = ?`,
        [reportId, organizationId],
        (err, row) => {
          if (err) reject(err);
          else if (row) {
            row.content = row.content ? JSON.parse(row.content) : null;
            row.aiWarnings = row.ai_warnings ? JSON.parse(row.ai_warnings) : [];
            resolve(row);
          } else resolve(null);
        }
      );
    });
  }

  async updateStatus(reportId, status) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE management_reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, reportId],
        (err) => {
          if (err) reject(err);
          else resolve({ success: true });
        }
      );
    });
  }

  // DEC-131 P1-4 follow-up: org-filtered on purpose. The service already
  // asserts tenant ownership before calling this, but a share token is the
  // one artefact here that is honoured WITHOUT a session, so the write itself
  // also refuses to land on a foreign row.
  async createShareLink(reportId, shareToken, expiresAt, organizationId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE management_reports SET share_token = ?, share_expires_at = ?
          WHERE id = ? AND organization_id = ?`,
        [shareToken, expiresAt, reportId, organizationId],
        (err) => {
          if (err) reject(err);
          else resolve(true);
        }
      );
    });
  }

  async getByShareToken(shareToken) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM management_reports 
                 WHERE share_token = ? AND (share_expires_at IS NULL OR share_expires_at > datetime('now'))`,
        [shareToken],
        (err, row) => {
          if (err) reject(err);
          else if (row) {
            row.content = row.content ? JSON.parse(row.content) : null;
            resolve(row);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  async getReports(filters) {
    const {
      organizationId,
      projectId,
      reportType,
      scope,
      status,
      fromDate,
      toDate,
      limit = 20,
      offset = 0,
    } = filters;

    // Build WHERE clause
    let whereClause = 'WHERE mr.organization_id = ?';
    const params = [organizationId];

    if (projectId) {
      whereClause += ` AND mr.project_id = ?`;
      params.push(projectId);
    }
    if (reportType) {
      whereClause += ` AND mr.report_type = ?`;
      params.push(reportType);
    }
    if (scope) {
      whereClause += ` AND mr.scope = ?`;
      params.push(scope);
    }
    if (status) {
      whereClause += ` AND mr.status = ?`;
      params.push(status);
    }
    if (fromDate) {
      whereClause += ` AND mr.created_at >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      whereClause += ` AND mr.created_at <= ?`;
      params.push(toDate);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM management_reports mr ${whereClause}`;

    // Get paginated data
    const dataQuery = `
            SELECT mr.*, u.first_name, u.last_name, u.email,
                   p.name as project_name
            FROM management_reports mr
            LEFT JOIN users u ON mr.generated_by = u.id
            LEFT JOIN projects p ON mr.project_id = p.id
            ${whereClause}
            ORDER BY mr.created_at DESC LIMIT ? OFFSET ?
        `;
    const dataParams = [...params, limit, offset];

    return new Promise((resolve, reject) => {
      // Get count first
      this.db.get(countQuery, params, (err, countRow) => {
        if (err) return reject(err);

        const total = countRow?.total || 0;

        // Then get data
        this.db.all(dataQuery, dataParams, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows, total });
        });
      });
    });
  }

  async getProjectById(projectId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT p.*, u.first_name || ' ' || u.last_name as owner_name
                 FROM projects p
                 LEFT JOIN users u ON p.owner_id = u.id
                 WHERE p.id = ?`,
        [projectId],
        (err, row) => resolve(row)
      );
    });
  }

  // DEC-140: tenant-scoped project lookup for the generateReport() entry
  // gate. Unlike getProjectById() above (deliberately unscoped — it backs
  // reads that already ran the gate and need the row again), this is the
  // ONLY project lookup allowed to decide whether a caller may touch a
  // project's data at all.
  async getProjectByIdForOrganization(projectId, organizationId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT p.*, u.first_name || ' ' || u.last_name as owner_name
                 FROM projects p
                 LEFT JOIN users u ON p.owner_id = u.id
                 WHERE p.id = ? AND p.organization_id = ?`,
        [projectId, organizationId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });
  }

  async getActiveProjects(organizationId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT p.*, u.first_name || ' ' || u.last_name as owner_name
                 FROM projects p
                 LEFT JOIN users u ON p.owner_id = u.id
                 WHERE p.organization_id = ? AND (p.is_closed = 0 OR p.is_closed IS NULL)
                 ORDER BY p.name`,
        [organizationId],
        (err, rows) => resolve(rows || [])
      );
    });
  }

  async finalizeReport(reportId, integrityHash, userId) {
    return new Promise((resolve, reject) => {
      const sql = `
                UPDATE management_reports 
                SET status = 'FINAL', 
                    locked_at = CURRENT_TIMESTAMP, 
                    locked_by = ?,
                    finalized_at = CURRENT_TIMESTAMP,
                    finalized_by = ?,
                    integrity_hash = ?,
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;
      const params = [userId, userId, integrityHash, reportId];

      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async unlockReport(reportId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `
                UPDATE management_reports 
                SET status = 'DRAFT',
                    locked_at = NULL,
                    locked_by = NULL,
                    approval_status = 'NONE',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
        [reportId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // ==========================================
  // COMMENTS & COLLABORATION
  // ==========================================

  async addComment(comment) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `
                INSERT INTO management_report_comments
                (id, report_id, version_id, section_id, content, parent_comment_id, mentions, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        [
          comment.id,
          comment.reportId,
          comment.versionId,
          comment.sectionId,
          comment.content,
          comment.parentCommentId,
          JSON.stringify(comment.mentions || []),
          comment.createdBy,
          comment.createdAt,
          comment.updatedAt,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getComments(reportId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
                SELECT c.*, u.first_name, u.last_name, u.email, u.avatar_url,
                       resolved.first_name as resolved_by_first_name, 
                       resolved.last_name as resolved_by_last_name
                FROM management_report_comments c
                LEFT JOIN users u ON c.created_by = u.id
                LEFT JOIN users resolved ON c.resolved_by = resolved.id
                WHERE c.report_id = ?
                ORDER BY c.created_at ASC
            `,
        [reportId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  async getCommentById(commentId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM management_report_comments WHERE id = ?',
        [commentId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async resolveComment(commentId, userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `
                UPDATE management_report_comments 
                SET is_resolved = 1, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
        [userId, commentId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async deleteComment(commentId) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM management_report_comments WHERE id = ?', [commentId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getUser(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id, first_name, last_name, email, role FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  // ==========================================
  // AGGREGATION & STATISTICS (Replacements for private helpers)
  // ==========================================

  async getTaskStatistics(projectId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as "inProgress",
                    SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked,
                    SUM(CASE WHEN due_date < date('now') AND status != 'DONE' THEN 1 ELSE 0 END) as overdue
                FROM tasks WHERE project_id = ?
            `,
        [projectId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || { total: 0, completed: 0, inProgress: 0, blocked: 0, overdue: 0 });
        }
      );
    });
  }

  async getInitiativeStatistics(projectId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status IN ('EXECUTING', 'DONE') THEN 1 ELSE 0 END) as "onTrack",
                    SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as "atRisk"
                FROM initiatives WHERE project_id = ?
            `,
        [projectId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || { total: 0, onTrack: 0, atRisk: 0 });
        }
      );
    });
  }

  async getDecisionStatistics(projectId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `
                SELECT 
                    SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending
                FROM decisions WHERE project_id = ?
            `,
        [projectId],
        (err, row) => {
          if (err) {
            const message = err.message || '';
            if (message.includes('no such table') || message.includes('does not exist')) {
              resolve({ approved: 0, pending: 0 });
              return;
            }
            reject(err);
          } else resolve(row || { approved: 0, pending: 0 });
        }
      );
    });
  }

  async getCompletedTasks(projectId, periodStart, periodEnd) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
                SELECT t.id, t.title, t.updated_at as "completedAt", 
                       u.id as "completedById", u.first_name || ' ' || u.last_name as "completedByName",
                       i.id as "initiativeId", i.title as "initiativeTitle"
                FROM tasks t
                LEFT JOIN users u ON t.assignee_id = u.id
                LEFT JOIN initiatives i ON t.initiative_id = i.id
                WHERE t.project_id = ? 
                  AND t.status = 'DONE'
                  AND t.updated_at >= ? AND t.updated_at <= ?
                ORDER BY t.updated_at DESC
                LIMIT 30
            `,
        [projectId, periodStart, periodEnd],
        (err, rows) => {
          if (err) {
            const message = err.message || '';
            if (message.includes('no such table') || message.includes('no such column')) {
              resolve([]);
              return;
            }
            reject(err);
          } else resolve(rows || []);
        }
      );
    });
  }

  async getInProgressTasks(projectId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
                SELECT t.id, t.title, t.progress, t.due_date,
                       u.id as "assigneeId", u.first_name || ' ' || u.last_name as "assigneeName"
                FROM tasks t
                LEFT JOIN users u ON t.assignee_id = u.id
                WHERE t.project_id = ? AND t.status = 'IN_PROGRESS'
                ORDER BY t.due_date ASC
                LIMIT 30
            `,
        [projectId],
        (err, rows) => {
          if (err) {
            const message = err.message || '';
            if (message.includes('no such table') || message.includes('no such column')) {
              resolve([]);
              return;
            }
            reject(err);
          } else resolve(rows || []);
        }
      );
    });
  }

  async getBlockedTasks(projectId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
                SELECT t.id, t.title, t.blocked_reason, t.updated_at,
                       u.id as "ownerId", u.first_name || ' ' || u.last_name as "ownerName"
                FROM tasks t
                LEFT JOIN users u ON t.assignee_id = u.id
                WHERE t.project_id = ? AND t.status = 'BLOCKED'
                ORDER BY t.updated_at ASC
            `,
        [projectId],
        (err, rows) => {
          if (err) {
            const message = err.message || '';
            if (message.includes('no such table') || message.includes('no such column')) {
              resolve([]);
              return;
            }
            reject(err);
          } else resolve(rows || []);
        }
      );
    });
  }

  async getPendingProjectDecisions(projectId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
                SELECT d.id, d.title, d.description, d.type as decision_type, d.status, d.created_at,
                       u.id as "ownerId", u.first_name || ' ' || u.last_name as "ownerName"
                FROM decisions d
                LEFT JOIN users u ON d.decision_maker_id = u.id
                WHERE d.project_id = ? AND d.status IN ('pending', 'escalated')
                ORDER BY d.created_at ASC
            `,
        [projectId],
        (err, rows) => {
          if (err) {
            const message = err.message || '';
            if (message.includes('no such table') || message.includes('no such column')) {
              resolve([]);
              return;
            }
            reject(err);
          } else resolve(rows || []);
        }
      );
    });
  }

  async getUpcomingTasks(projectId, dueDateLimit) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
                SELECT t.id, t.title, t.due_date, t.priority,
                       u.id as "assigneeId", u.first_name || ' ' || u.last_name as "assigneeName"
                FROM tasks t
                LEFT JOIN users u ON t.assignee_id = u.id
                WHERE t.project_id = ? 
                  AND t.status IN ('TODO', 'IN_PROGRESS')
                  AND t.due_date <= ?
                ORDER BY t.due_date ASC
                LIMIT 20
            `,
        [projectId, dueDateLimit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  async getRiskStatistics(projectId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN severity IN ('critical', 'CRITICAL') THEN 1 ELSE 0 END) as critical,
                    SUM(CASE WHEN severity IN ('high', 'HIGH') THEN 1 ELSE 0 END) as high
                FROM risk_register WHERE project_id = ? AND status NOT IN ('resolved', 'accepted')
            `,
        [projectId],
        (err, row) => {
          if (err) {
            const message = err.message || '';
            if (message.includes('no such table') || message.includes('no such column')) {
              resolve({ total: 0, critical: 0, high: 0 });
              return;
            }
            reject(err);
          } else resolve(row || {});
        }
      );
    });
  }

  async getBudgetMetrics(projectId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `
                SELECT 
                    planned_budget,
                    actual_spend,
                    forecast_at_completion,
                    variance_percent,
                    CASE 
                        WHEN planned_budget IS NULL OR planned_budget = 0 THEN 'NOT_TRACKED'
                        ELSE 'TRACKED'
                    END as tracking_status
                FROM project_budgets 
                WHERE project_id = ?
            `,
        [projectId],
        (err, row) => {
          if (err) {
            // Safe failure for optional budget data
            resolve(null);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  async getCustomKPIs(projectId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
                SELECT pk.*, u.first_name || ' ' || u.last_name as owner_name
                FROM project_kpis pk
                LEFT JOIN users u ON pk.owner_id = u.id
                WHERE pk.project_id = ? AND pk.status = 'ACTIVE'
                ORDER BY pk.display_order, pk.category, pk.name
            `,
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  async getBasicTaskMetrics(projectId) {
    // 1.1-Z2 #1 (DATABASE_ERROR na PORTFOLIO_HEALTH, zmierzone na żywo 06.09):
    // poprzedni komentarz twierdził, że `tasks.progress` jest TEXT na realnym
    // Postgresie — nieprawda. Migracje `000_z_core_baseline.sql:364` i
    // `20260801_exe002004_idempotency_keys.sql:84` deklarują
    // `progress INTEGER DEFAULT 0`, potwierdzone `\d tasks` na żywej bazie
    // (typ: integer). `NULLIF(progress, '')` porównywało kolumnę INTEGER z
    // literałem tekstowym '' — Postgres usiłował rzutować '' na integer i
    // padał (22P02 invalid input syntax for type integer) zanim doszło do
    // zewnętrznego CAST(...AS NUMERIC). Naprawa: rzutuj najpierw na TEXT
    // (`CAST(progress AS TEXT)`, NIE `progress::text` — to składnia wyłącznie
    // Postgresa, a to repozytorium przez `getDatabase()` obsługuje też
    // SQLite), dopiero wtedy NULLIF('') i CAST AS NUMERIC. NULL/empty nadal
    // jest wykluczane z AVG (NULL-skipping), prawdziwe wartości integer/text
    // przechodzą bez błędu typu — na obu silnikach.
    // Aliases double-quoted: Postgres folds unquoted identifiers to lowercase
    // (the systemic "SQLite-izm" — MEMORY finding_unquoted_camelcase_aliases),
    // and callers (managementReportsService.generatePortfolioHealthReport)
    // read taskMetrics.overdueTasks / .blocked / .avgProgress in camelCase —
    // unquoted, this method silently returned undefined for every camelCase
    // field on Postgres even once the AVG(TEXT) crash was fixed.
    return new Promise((resolve, reject) => {
      this.db.get(
        `
                SELECT
                    COUNT(*) as "totalTasks",
                    SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as "completedTasks",
                    AVG(CAST(NULLIF(CAST(progress AS TEXT), '') AS NUMERIC)) as "avgProgress",
                    SUM(CASE WHEN due_date < date('now') AND status != 'DONE' THEN 1 ELSE 0 END) as "overdueTasks",
                    SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked
                FROM tasks WHERE project_id = ?
            `,
        [projectId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || {});
        }
      );
    });
  }

  async getActiveRisksAndIssues(projectId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
                SELECT r.*, u.first_name || ' ' || u.last_name as "ownerName"
                FROM risk_register r
                LEFT JOIN users u ON r.owner_id = u.id
                WHERE r.project_id = ? AND r.status NOT IN ('resolved', 'accepted')
                ORDER BY 
                    CASE r.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
            `,
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  async getBoardDecisions(projectId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
                SELECT d.*, u.first_name || ' ' || u.last_name as "requestedByName"
                FROM decisions d
                LEFT JOIN users u ON d.requested_by = u.id
                WHERE d.project_id = ? 
                  AND d.status = 'PENDING'
                  AND (d.escalation_level >= 2 OR d.decision_type IN ('BUDGET', 'SCOPE', 'STRATEGIC'))
                ORDER BY d.created_at ASC
            `,
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  async getMilestones(projectId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
                SELECT id, title as name, due_date as "plannedDate", status
                FROM initiatives
                WHERE project_id = ? AND is_milestone = 1 AND status != 'DONE'
                ORDER BY due_date ASC
                LIMIT 5
            `,
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  async getStageGates(projectId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
                SELECT id, gate_type as name, gate_type as "gateType", target_date as "plannedDate", status
                FROM stage_gates
                WHERE project_id = ? AND status != 'PASSED'
                ORDER BY target_date ASC
                LIMIT 3
            `,
        [projectId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }
}

export default new ManagementReportRepository();
