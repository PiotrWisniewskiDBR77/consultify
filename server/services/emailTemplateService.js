/**
 * Email Template Service
 * Manages email templates
 */

import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';



const EmailTemplateService = {
    /**
     * Get all templates
     */
    getTemplates: (category = null, activeOnly = false) => {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM email_templates WHERE 1=1';
            const params = [];

            if (category) {
                query += ' AND category = ?';
                params.push(category);
            }
            if (activeOnly) {
                query += ' AND is_active = 1';
            }

            query += ' ORDER BY category, name';

            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Get template by key
     */
    getTemplate: (templateKey) => {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM email_templates WHERE template_key = ?',
                [templateKey],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                }
            );
        });
    },

    /**
     * Create template
     */
    createTemplate: (templateData) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            db.run(
                `INSERT INTO email_templates 
                 (id, template_key, name, subject, body_html, body_text, variables_json, category)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    templateData.templateKey,
                    templateData.name,
                    templateData.subject,
                    templateData.bodyHtml,
                    templateData.bodyText || null,
                    JSON.stringify(templateData.variables || []),
                    templateData.category || null
                ],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint')) {
                            return reject(new Error('Template key already exists'));
                        }
                        return reject(err);
                    }
                    resolve({ id, ...templateData });
                }
            );
        });
    },

    /**
     * Update template
     */
    updateTemplate: (templateKey, updates) => {
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];

            if (updates.name) {
                fields.push('name = ?');
                values.push(updates.name);
            }
            if (updates.subject) {
                fields.push('subject = ?');
                values.push(updates.subject);
            }
            if (updates.bodyHtml) {
                fields.push('body_html = ?');
                values.push(updates.bodyHtml);
            }
            if (updates.bodyText !== undefined) {
                fields.push('body_text = ?');
                values.push(updates.bodyText);
            }
            if (updates.variables) {
                fields.push('variables_json = ?');
                values.push(JSON.stringify(updates.variables));
            }
            if (updates.category !== undefined) {
                fields.push('category = ?');
                values.push(updates.category);
            }
            if (updates.isActive !== undefined) {
                fields.push('is_active = ?');
                values.push(updates.isActive ? 1 : 0);
            }

            if (fields.length === 0) {
                return resolve({ updated: false });
            }

            fields.push('updated_at = datetime("now")');
            values.push(templateKey);

            db.run(
                `UPDATE email_templates SET ${fields.join(', ')} WHERE template_key = ?`,
                values,
                function (err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    }
};

export default EmailTemplateService;
