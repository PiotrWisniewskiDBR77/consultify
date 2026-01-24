// @ts-nocheck
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();

class ReportRepository {
  constructor() {
    this.db = db;
  }

  /**
   * Get report by ID and Organization ID
   * @param {string|number} reportId
   * @param {string|number} organizationId
   * @returns {Promise<Object|null>}
   */
  async getReportById(reportId, organizationId) {
    const sql = `
            SELECT 
                r.*,
                a.name as assessment_name,
                a.axis_data,
                a.progress,
                a.is_complete,
                p.name as project_name,
                o.name as organization_name,
                o.transformation_context
            FROM assessment_reports r
            LEFT JOIN assessments a ON r.assessment_id = a.id
            LEFT JOIN projects p ON r.project_id = p.id
            LEFT JOIN organizations o ON r.organization_id = o.id
            WHERE r.id = ? AND r.organization_id = ?
        `;

    return new Promise((resolve, reject) => {
      this.db.get(sql, [reportId, organizationId], (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        resolve(row);
      });
    });
  }

  /**
   * Get report sections
   * @param {string|number} reportId
   * @returns {Promise<Array>}
   */
  async getReportSections(reportId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM report_sections WHERE report_id = ? ORDER BY order_index',
        [reportId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get assessment data
   * @param {string|number} assessmentId
   * @returns {Promise<Object|null>}
   */
  async getAssessmentData(assessmentId) {
    const sql = `
            SELECT 
                a.*,
                p.name as project_name,
                o.name as organization_name,
                o.transformation_context
            FROM assessments a
            LEFT JOIN projects p ON a.project_id = p.id
            LEFT JOIN organizations o ON a.organization_id = o.id
            WHERE a.id = ?
        `;

    return new Promise((resolve, reject) => {
      this.db.get(sql, [assessmentId], (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }

  /**
   * Get template configuration
   * @param {string|number} templateId
   * @returns {Promise<Object|null>}
   */
  async getTemplateConfig(templateId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT section_config FROM report_templates WHERE id = ?',
        [templateId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        }
      );
    });
  }

  /**
   * Delete sections for a report
   * @param {string|number} reportId
   * @returns {Promise<void>}
   */
  async deleteReportSections(reportId) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM report_sections WHERE report_id = ?', [reportId], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  /**
   * Insert a report section
   * @param {Object} section
   * @returns {Promise<void>}
   */
  async createReportSection(section) {
    const sql = `
            INSERT INTO report_sections 
            (id, report_id, section_type, axis_id, area_id, title, content, data_snapshot, order_index, is_ai_generated, last_edited_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    return new Promise((resolve, reject) => {
      this.db.run(
        sql,
        [
          section.id,
          section.reportId,
          section.sectionType,
          section.axisId,
          section.areaId,
          section.title,
          section.content,
          JSON.stringify(section.dataSnapshot),
          section.orderIndex,
          section.isAiGenerated ? 1 : 0,
          section.lastEditedBy,
          section.createdAt,
          section.updatedAt,
        ],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }
}

export default new ReportRepository();
