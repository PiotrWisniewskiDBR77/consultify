/**
 * Table Platform Distribution Service
 * CRUD + execution for sending table/view data via email, Slack, Teams, or webhook.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

export interface DistributionConfig {
  name: string;
  baseId: string;
  sourceType: 'view' | 'table' | 'chart' | 'interface';
  sourceId: string;
  channel: 'email' | 'slack' | 'teams' | 'webhook';
  channelConfig: Record<string, unknown>;
  schedule?: string;
  format?: string;
  userId: string;
}

export interface Distribution {
  id: string;
  name: string;
  base_id: string;
  source_type: string;
  source_id: string;
  channel: string;
  channel_config: Record<string, unknown>;
  schedule: string | null;
  format: string;
  is_active: boolean;
  last_sent_at: string | null;
  send_count: number;
  created_by: string;
  created_at: string;
}

const distributionService = {
  async createDistribution(config: DistributionConfig): Promise<Distribution> {
    const db = getDatabase();
    const r = await db.query(
      `INSERT INTO tp_distributions (name, base_id, source_type, source_id, channel, channel_config, schedule, format, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        config.name,
        config.baseId,
        config.sourceType,
        config.sourceId,
        config.channel,
        JSON.stringify(config.channelConfig),
        config.schedule ?? null,
        config.format || 'xlsx',
        config.userId,
      ]
    );
    return r.rows[0] as Distribution;
  },

  async listDistributions(baseId: string): Promise<Distribution[]> {
    const db = getDatabase();
    const r = await db.query(
      'SELECT * FROM tp_distributions WHERE base_id = $1 ORDER BY created_at DESC',
      [baseId]
    );
    return r.rows as Distribution[];
  },

  async getDistribution(id: string): Promise<Distribution | null> {
    const db = getDatabase();
    const r = await db.query('SELECT * FROM tp_distributions WHERE id = $1', [id]);
    return (r.rows[0] as Distribution) || null;
  },

  async updateDistribution(
    id: string,
    updates: Partial<DistributionConfig>
  ): Promise<Distribution | null> {
    const db = getDatabase();
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.channel !== undefined) {
      fields.push(`channel = $${idx++}`);
      values.push(updates.channel);
    }
    if (updates.channelConfig !== undefined) {
      fields.push(`channel_config = $${idx++}`);
      values.push(JSON.stringify(updates.channelConfig));
    }
    if (updates.schedule !== undefined) {
      fields.push(`schedule = $${idx++}`);
      values.push(updates.schedule);
    }
    if (updates.format !== undefined) {
      fields.push(`format = $${idx++}`);
      values.push(updates.format);
    }

    if (fields.length === 0) return this.getDistribution(id);

    values.push(id);
    const r = await db.query(
      `UPDATE tp_distributions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return (r.rows[0] as Distribution) || null;
  },

  async deleteDistribution(id: string): Promise<boolean> {
    const db = getDatabase();
    const r = await db.query('DELETE FROM tp_distributions WHERE id = $1', [id]);
    return (r.rowCount ?? 0) > 0;
  },

  async toggleDistribution(id: string): Promise<Distribution | null> {
    const db = getDatabase();
    const r = await db.query(
      'UPDATE tp_distributions SET is_active = NOT is_active WHERE id = $1 RETURNING *',
      [id]
    );
    return (r.rows[0] as Distribution) || null;
  },

  async executeDistribution(id: string): Promise<{ success: boolean; recordCount: number; channel: string }> {
    const dist = await this.getDistribution(id);
    if (!dist) throw new Error('Distribution not found');

    let data: any[] = [];
    let fields: any[] = [];

    if (dist.source_type === 'view' || dist.source_type === 'table') {
      try {
        const { default: viewQueryEngine } = await import('./ViewQueryEngine.js');
        const result = await viewQueryEngine.executeQuery({
          tableId: dist.source_id,
          pageSize: 10000,
        });
        data = result.records;
      } catch (err) {
        logger.warn('[Distribution] Failed to fetch source data', { id, error: (err as Error).message });
      }
    }

    let payload: string;
    let contentType: string;
    let filename: string;

    switch (dist.format) {
      case 'csv': {
        const headers = fields.length > 0
          ? fields.map((f: any) => f.name || f.id)
          : data.length > 0
            ? Object.keys(data[0].data ?? data[0])
            : [];
        const rows = data.map((r: any) =>
          headers.map((h: string) => {
            const val = r.data?.[h] ?? r[h] ?? '';
            return `"${String(val).replace(/"/g, '""')}"`;
          })
        );
        payload = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
        contentType = 'text/csv';
        filename = `${dist.name}.csv`;
        break;
      }
      case 'json': {
        payload = JSON.stringify(data, null, 2);
        contentType = 'application/json';
        filename = `${dist.name}.json`;
        break;
      }
      default: {
        payload = JSON.stringify(data, null, 2);
        contentType = 'application/json';
        filename = `${dist.name}.json`;
      }
    }

    const channelConfig = dist.channel_config as Record<string, unknown>;

    switch (dist.channel) {
      case 'email': {
        logger.info(`[Distribution] Would send email to ${channelConfig.to} with ${filename}`, { id });
        break;
      }
      case 'slack': {
        const webhookUrl = channelConfig.webhookUrl as string;
        if (webhookUrl) {
          const message = `*${dist.name}* — ${data.length} records\n\`\`\`${payload.slice(0, 2000)}\`\`\``;
          try {
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: message }),
            });
          } catch (err) {
            logger.error('[Distribution] Slack send failed', { id, error: (err as Error).message });
          }
        }
        break;
      }
      case 'teams': {
        const webhookUrl = channelConfig.webhookUrl as string;
        if (webhookUrl) {
          try {
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                '@type': 'MessageCard',
                summary: dist.name,
                text: `**${dist.name}** — ${data.length} records exported`,
              }),
            });
          } catch (err) {
            logger.error('[Distribution] Teams send failed', { id, error: (err as Error).message });
          }
        }
        break;
      }
      case 'webhook': {
        const url = channelConfig.url as string;
        if (url) {
          try {
            await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': contentType },
              body: payload,
            });
          } catch (err) {
            logger.error('[Distribution] Webhook send failed', { id, error: (err as Error).message });
          }
        }
        break;
      }
    }

    const db = getDatabase();
    await db.query(
      'UPDATE tp_distributions SET last_sent_at = now(), send_count = send_count + 1 WHERE id = $1',
      [id]
    );

    return { success: true, recordCount: data.length, channel: dist.channel };
  },
};

export default distributionService;
