/**
 * Compliance Service
 * 
 * Manages compliance records and reporting.
 * Features:
 * - Compliance framework tracking (GDPR, SOC2, ISO27001, HIPAA, PCI_DSS)
 * - Control verification
 * - Evidence management
 * - Compliance reporting
 */

import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';



class ComplianceService {
    /**
     * Create a compliance record
     */
    async createRecord(recordData) {
        const {
            framework,
            control_id,
            control_name,
            status,
            evidence = {},
            notes
        } = recordData;

        const id = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO compliance_records (
                    id, framework, control_id, control_name, status,
                    evidence, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, framework, control_id, control_name, status,
                    JSON.stringify(evidence), notes || null
                ],
                function (err) {
                    if (err) {
                        console.error('[Compliance] Error creating record:', err);
                        return reject(err);
                    }
                    resolve({ id, ...recordData });
                }
            );
        });
    }

    /**
     * Get compliance records
     */
    async getRecords(filters = {}) {
        const { framework, status, controlId } = filters;

        let query = 'SELECT * FROM compliance_records WHERE 1=1';
        const params = [];

        if (framework) {
            query += ' AND framework = ?';
            params.push(framework);
        }

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        if (controlId) {
            query += ' AND control_id = ?';
            params.push(controlId);
        }

        query += ' ORDER BY framework, control_id';

        return new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('[Compliance] Error fetching records:', err);
                    return reject(err);
                }

                const records = rows.map(row => ({
                    ...row,
                    evidence: row.evidence ? JSON.parse(row.evidence) : {}
                }));

                resolve(records);
            });
        });
    }

    /**
     * Get compliance record by ID
     */
    async getRecordById(id) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM compliance_records WHERE id = ?', [id], (err, row) => {
                if (err) {
                    console.error('[Compliance] Error fetching record:', err);
                    return reject(err);
                }

                if (!row) {
                    return resolve(null);
                }

                resolve({
                    ...row,
                    evidence: row.evidence ? JSON.parse(row.evidence) : {}
                });
            });
        });
    }

    /**
     * Update compliance record
     */
    async updateRecord(id, updates) {
        const {
            status,
            evidence,
            notes,
            verifiedBy
        } = updates;

        const updatesList = [];
        const params = [];

        if (status !== undefined) {
            updatesList.push('status = ?');
            params.push(status);
        }

        if (evidence !== undefined) {
            updatesList.push('evidence = ?');
            params.push(JSON.stringify(evidence));
        }

        if (notes !== undefined) {
            updatesList.push('notes = ?');
            params.push(notes);
        }

        if (verifiedBy !== undefined) {
            updatesList.push('verified_by = ?');
            updatesList.push('last_verified_at = ?');
            params.push(verifiedBy);
            params.push(new Date().toISOString());
        }

        if (updatesList.length === 0) {
            return this.getRecordById(id);
        }

        params.push(id);

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE compliance_records SET ${updatesList.join(', ')} WHERE id = ?`,
                params,
                function (err) {
                    if (err) {
                        console.error('[Compliance] Error updating record:', err);
                        return reject(err);
                    }
                    resolve(this.getRecordById(id));
                }.bind(this)
            );
        });
    }

    /**
     * Get compliance report for a framework
     */
    async getFrameworkReport(framework) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    COUNT(*) as total_controls,
                    COUNT(CASE WHEN status = 'compliant' THEN 1 END) as compliant,
                    COUNT(CASE WHEN status = 'non_compliant' THEN 1 END) as non_compliant,
                    COUNT(CASE WHEN status = 'not_applicable' THEN 1 END) as not_applicable
                 FROM compliance_records
                 WHERE framework = ?`,
                [framework],
                async (err, rows) => {
                    if (err) {
                        console.error('[Compliance] Error fetching report:', err);
                        return reject(err);
                    }

                    const summary = rows[0] || {
                        total_controls: 0,
                        compliant: 0,
                        non_compliant: 0,
                        not_applicable: 0
                    };

                    const records = await this.getRecords({ framework });

                    resolve({
                        framework,
                        summary,
                        records,
                        compliance_percentage: summary.total_controls > 0
                            ? Math.round((summary.compliant / summary.total_controls) * 100)
                            : 0
                    });
                }
            );
        });
    }

    /**
     * Get all supported frameworks
     */
    getSupportedFrameworks() {
        return [
            {
                id: 'GDPR',
                name: 'General Data Protection Regulation',
                description: 'EU data protection and privacy regulation'
            },
            {
                id: 'SOC2',
                name: 'SOC 2',
                description: 'Service Organization Control 2 - Security, availability, processing integrity, confidentiality, privacy'
            },
            {
                id: 'ISO27001',
                name: 'ISO/IEC 27001',
                description: 'Information security management system standard'
            },
            {
                id: 'HIPAA',
                name: 'HIPAA',
                description: 'Health Insurance Portability and Accountability Act'
            },
            {
                id: 'PCI_DSS',
                name: 'PCI DSS',
                description: 'Payment Card Industry Data Security Standard'
            }
        ];
    }
}

const complianceServiceInstance = new ComplianceService();
export default complianceServiceInstance;







