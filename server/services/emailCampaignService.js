/**
 * Email Campaign Service
 * Manages email campaigns
 */

import { getDatabase } from '../src/database/Database.ts';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';



const EmailCampaignService = {
    /**
     * Get campaigns for an organization
     */
    getCampaigns: (organizationId = null, status = null) => {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM email_campaigns WHERE 1=1';
            const params = [];

            if (organizationId) {
                query += ' AND organization_id = ?';
                params.push(organizationId);
            }
            if (status) {
                query += ' AND status = ?';
                params.push(status);
            }

            query += ' ORDER BY created_at DESC';

            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Create campaign
     */
    createCampaign: (campaignData) => {
        return new Promise((resolve, reject) => {
            const id = uuidv4();
            db.run(
                `INSERT INTO email_campaigns 
                 (id, organization_id, name, template_id, subject, body_html, recipient_filter_json, status, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    campaignData.organizationId || null,
                    campaignData.name,
                    campaignData.templateId || null,
                    campaignData.subject,
                    campaignData.bodyHtml,
                    JSON.stringify(campaignData.recipientFilter || {}),
                    campaignData.status || 'draft',
                    campaignData.createdBy
                ],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id, ...campaignData });
                }
            );
        });
    },

    /**
     * Update campaign
     */
    updateCampaign: (campaignId, updates) => {
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];

            if (updates.status) {
                fields.push('status = ?');
                values.push(updates.status);
                if (updates.status === 'sent' && !updates.sentAt) {
                    fields.push('sent_at = datetime("now")');
                }
            }
            if (updates.scheduledAt !== undefined) {
                fields.push('scheduled_at = ?');
                values.push(updates.scheduledAt);
            }
            if (updates.totalRecipients !== undefined) {
                fields.push('total_recipients = ?');
                values.push(updates.totalRecipients);
            }
            if (updates.sentCount !== undefined) {
                fields.push('sent_count = ?');
                values.push(updates.sentCount);
            }
            if (updates.openedCount !== undefined) {
                fields.push('opened_count = ?');
                values.push(updates.openedCount);
            }
            if (updates.clickedCount !== undefined) {
                fields.push('clicked_count = ?');
                values.push(updates.clickedCount);
            }
            if (updates.bouncedCount !== undefined) {
                fields.push('bounced_count = ?');
                values.push(updates.bouncedCount);
            }

            if (fields.length === 0) {
                return resolve({ updated: false });
            }

            values.push(campaignId);
            db.run(
                `UPDATE email_campaigns SET ${fields.join(', ')} WHERE id = ?`,
                values,
                function (err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    }
};

export default EmailCampaignService;









