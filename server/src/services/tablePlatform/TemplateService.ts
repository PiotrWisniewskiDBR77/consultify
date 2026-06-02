import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import tabeleConsultingTemplatesSeeder from './seeds/tabeleConsultingTemplatesSeeder.js';

const templateService = {
  async listTemplates(category?: string) {
    const db = getDatabase();
    if (category) {
      const r = await db.query(
        'SELECT * FROM tp_base_templates WHERE category = $1 ORDER BY is_featured DESC, usage_count DESC',
        [category]
      );
      return r.rows;
    }
    const r = await db.query(
      'SELECT * FROM tp_base_templates ORDER BY is_featured DESC, usage_count DESC'
    );
    return r.rows;
  },

  async getTemplate(id: string) {
    const db = getDatabase();
    const r = await db.query('SELECT * FROM tp_base_templates WHERE id = $1', [id]);
    return r.rows[0] || null;
  },

  async createFromTemplate(
    templateId: string,
    workspaceId: string,
    baseName: string,
    userId: string,
    organizationId: string
  ) {
    const db = getDatabase();
    const tpl = await this.getTemplate(templateId);
    if (!tpl) throw new Error('Template not found');

    const snapshot = (tpl as any).schema_snapshot;
    const metadataService = (await import('./MetadataService.js')).default;

    const base = await metadataService.createBase(workspaceId, organizationId, baseName, userId);

    for (const tableDef of snapshot.tables || []) {
      const table = await metadataService.createTable(
        base.id,
        tableDef.name,
        tableDef.description,
        userId
      );
      for (const fieldDef of tableDef.fields || []) {
        await metadataService.createField(
          table.id,
          fieldDef.name,
          fieldDef.fieldType,
          fieldDef.options || {},
          userId
        );
      }
    }

    await db.query('UPDATE tp_base_templates SET usage_count = usage_count + 1 WHERE id = $1', [
      templateId,
    ]);

    return base;
  },

  async publishAsTemplate(
    baseId: string,
    name: string,
    description: string,
    category: string,
    userId: string
  ) {
    const db = getDatabase();
    const metadataService = (await import('./MetadataService.js')).default;

    const base = await metadataService.getBase(baseId);
    if (!base) throw new Error('Base not found');

    const tablesResult = await db.query(
      'SELECT * FROM tp_tables WHERE base_id = $1 ORDER BY created_at',
      [baseId]
    );
    const tables = [];
    for (const t of tablesResult.rows) {
      const fieldsResult = await db.query(
        'SELECT name, field_type as "fieldType", options FROM tp_fields WHERE table_id = $1 ORDER BY field_order',
        [(t as any).id]
      );
      tables.push({
        name: (t as any).name,
        description: (t as any).description,
        fields: fieldsResult.rows,
      });
    }

    const snapshot = { tables };
    const r = await db.query(
      'INSERT INTO tp_base_templates (name, description, category, schema_snapshot, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description, category, JSON.stringify(snapshot), userId]
    );
    return r.rows[0];
  },

  /**
   * Idempotent re-seeder for the 30-template Tabele consulting catalog
   * (Block A · EPIC-T5). Runs INSERT/UPDATE per `governance_rules.seed_id`
   * and is safe to call on every boot. Returns the seeder tally so callers
   * can log / report.
   */
  async seedTabeleConsultingTemplates() {
    return tabeleConsultingTemplatesSeeder.seed();
  },

  async seedDefaultTemplates() {
    const db = getDatabase();
    const existing = await db.query('SELECT COUNT(*) as count FROM tp_base_templates');
    if (parseInt((existing.rows[0] as any).count) > 0) {
      // Legacy seed already ran. Still apply the Tabele consulting catalog —
      // it is idempotent (keyed on governance_rules.seed_id) and additive
      // relative to the legacy 6 entries.
      try {
        await tabeleConsultingTemplatesSeeder.seed();
      } catch (err) {
        logger.error('[TemplateService] Tabele consulting seeder failed (post-legacy)', {
          error: (err as Error).message,
        });
      }
      return;
    }

    const defaults = [
      {
        name: 'CRM Pipeline',
        description: 'Track leads, contacts, and deals through your sales pipeline',
        category: 'sales',
        is_featured: true,
        schema_snapshot: {
          tables: [
            {
              name: 'Contacts',
              fields: [
                { name: 'Name', fieldType: 'singleLineText' },
                { name: 'Email', fieldType: 'email' },
                { name: 'Phone', fieldType: 'phone' },
                { name: 'Company', fieldType: 'singleLineText' },
                {
                  name: 'Status',
                  fieldType: 'singleSelect',
                  options: {
                    choices: [
                      { name: 'Lead', color: 'blue' },
                      { name: 'Qualified', color: 'yellow' },
                      { name: 'Customer', color: 'green' },
                      { name: 'Churned', color: 'red' },
                    ],
                  },
                },
                { name: 'Value', fieldType: 'currency', options: { symbol: '$', precision: 2 } },
                { name: 'Last Contact', fieldType: 'date' },
                { name: 'Notes', fieldType: 'longText' },
              ],
            },
            {
              name: 'Deals',
              fields: [
                { name: 'Deal Name', fieldType: 'singleLineText' },
                {
                  name: 'Stage',
                  fieldType: 'singleSelect',
                  options: {
                    choices: [
                      { name: 'Discovery', color: 'blue' },
                      { name: 'Proposal', color: 'yellow' },
                      { name: 'Negotiation', color: 'orange' },
                      { name: 'Closed Won', color: 'green' },
                      { name: 'Closed Lost', color: 'red' },
                    ],
                  },
                },
                { name: 'Amount', fieldType: 'currency', options: { symbol: '$', precision: 2 } },
                { name: 'Close Date', fieldType: 'date' },
                { name: 'Probability', fieldType: 'percent' },
              ],
            },
          ],
        },
      },
      {
        name: 'Project Tracker',
        description: 'Manage projects, tasks, and milestones with Kanban and Timeline views',
        category: 'project-management',
        is_featured: true,
        schema_snapshot: {
          tables: [
            {
              name: 'Tasks',
              fields: [
                { name: 'Task', fieldType: 'singleLineText' },
                {
                  name: 'Status',
                  fieldType: 'singleSelect',
                  options: {
                    choices: [
                      { name: 'To Do', color: 'gray' },
                      { name: 'In Progress', color: 'blue' },
                      { name: 'Review', color: 'yellow' },
                      { name: 'Done', color: 'green' },
                    ],
                  },
                },
                {
                  name: 'Priority',
                  fieldType: 'singleSelect',
                  options: {
                    choices: [
                      { name: 'Low', color: 'gray' },
                      { name: 'Medium', color: 'yellow' },
                      { name: 'High', color: 'orange' },
                      { name: 'Critical', color: 'red' },
                    ],
                  },
                },
                { name: 'Assignee', fieldType: 'singleLineText' },
                { name: 'Due Date', fieldType: 'date' },
                { name: 'Estimate (h)', fieldType: 'duration', options: { format: 'h:mm' } },
                { name: 'Description', fieldType: 'longText' },
              ],
            },
            {
              name: 'Milestones',
              fields: [
                { name: 'Milestone', fieldType: 'singleLineText' },
                { name: 'Target Date', fieldType: 'date' },
                {
                  name: 'Status',
                  fieldType: 'singleSelect',
                  options: {
                    choices: [
                      { name: 'Planned', color: 'gray' },
                      { name: 'On Track', color: 'green' },
                      { name: 'At Risk', color: 'yellow' },
                      { name: 'Delayed', color: 'red' },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
      {
        name: 'HR Onboarding',
        description: 'Streamline employee onboarding with checklists and timelines',
        category: 'hr',
        is_featured: true,
        schema_snapshot: {
          tables: [
            {
              name: 'New Hires',
              fields: [
                { name: 'Name', fieldType: 'singleLineText' },
                { name: 'Email', fieldType: 'email' },
                {
                  name: 'Department',
                  fieldType: 'singleSelect',
                  options: {
                    choices: [
                      { name: 'Engineering', color: 'blue' },
                      { name: 'Sales', color: 'green' },
                      { name: 'Marketing', color: 'purple' },
                      { name: 'Operations', color: 'orange' },
                    ],
                  },
                },
                { name: 'Start Date', fieldType: 'date' },
                { name: 'Manager', fieldType: 'singleLineText' },
                { name: 'Onboarding Status', fieldType: 'percent' },
              ],
            },
            {
              name: 'Onboarding Tasks',
              fields: [
                { name: 'Task', fieldType: 'singleLineText' },
                {
                  name: 'Category',
                  fieldType: 'singleSelect',
                  options: {
                    choices: [
                      { name: 'IT Setup', color: 'blue' },
                      { name: 'HR Paperwork', color: 'yellow' },
                      { name: 'Training', color: 'green' },
                      { name: 'Team Intro', color: 'purple' },
                    ],
                  },
                },
                { name: 'Due', fieldType: 'singleLineText' },
                { name: 'Completed', fieldType: 'checkbox' },
              ],
            },
          ],
        },
      },
      {
        name: 'Product Roadmap',
        description: 'Plan features, track releases, and prioritize your product backlog',
        category: 'product',
        is_featured: false,
        schema_snapshot: {
          tables: [
            {
              name: 'Features',
              fields: [
                { name: 'Feature', fieldType: 'singleLineText' },
                {
                  name: 'Quarter',
                  fieldType: 'singleSelect',
                  options: {
                    choices: [
                      { name: 'Q1', color: 'blue' },
                      { name: 'Q2', color: 'green' },
                      { name: 'Q3', color: 'yellow' },
                      { name: 'Q4', color: 'orange' },
                    ],
                  },
                },
                {
                  name: 'Status',
                  fieldType: 'singleSelect',
                  options: {
                    choices: [
                      { name: 'Idea', color: 'gray' },
                      { name: 'Planned', color: 'blue' },
                      { name: 'Building', color: 'yellow' },
                      { name: 'Shipped', color: 'green' },
                    ],
                  },
                },
                { name: 'Impact', fieldType: 'rating', options: { max: 5 } },
                { name: 'Effort', fieldType: 'rating', options: { max: 5 } },
                { name: 'Description', fieldType: 'longText' },
              ],
            },
          ],
        },
      },
      {
        name: 'Content Calendar',
        description: 'Plan and schedule content across channels with calendar and kanban views',
        category: 'marketing',
        is_featured: false,
        schema_snapshot: {
          tables: [
            {
              name: 'Content',
              fields: [
                { name: 'Title', fieldType: 'singleLineText' },
                {
                  name: 'Channel',
                  fieldType: 'singleSelect',
                  options: {
                    choices: [
                      { name: 'Blog', color: 'blue' },
                      { name: 'Social', color: 'purple' },
                      { name: 'Email', color: 'green' },
                      { name: 'Video', color: 'red' },
                    ],
                  },
                },
                {
                  name: 'Status',
                  fieldType: 'singleSelect',
                  options: {
                    choices: [
                      { name: 'Idea', color: 'gray' },
                      { name: 'Draft', color: 'blue' },
                      { name: 'Review', color: 'yellow' },
                      { name: 'Published', color: 'green' },
                    ],
                  },
                },
                { name: 'Publish Date', fieldType: 'date' },
                { name: 'Author', fieldType: 'singleLineText' },
                { name: 'URL', fieldType: 'url' },
              ],
            },
          ],
        },
      },
      {
        name: 'Bug Tracker',
        description: 'Track bugs, prioritize fixes, and manage releases',
        category: 'engineering',
        is_featured: false,
        schema_snapshot: {
          tables: [
            {
              name: 'Bugs',
              fields: [
                { name: 'Title', fieldType: 'singleLineText' },
                {
                  name: 'Severity',
                  fieldType: 'singleSelect',
                  options: {
                    choices: [
                      { name: 'Critical', color: 'red' },
                      { name: 'Major', color: 'orange' },
                      { name: 'Minor', color: 'yellow' },
                      { name: 'Cosmetic', color: 'gray' },
                    ],
                  },
                },
                {
                  name: 'Status',
                  fieldType: 'singleSelect',
                  options: {
                    choices: [
                      { name: 'Open', color: 'red' },
                      { name: 'In Progress', color: 'blue' },
                      { name: 'Fixed', color: 'green' },
                      { name: 'Closed', color: 'gray' },
                    ],
                  },
                },
                { name: 'Assignee', fieldType: 'singleLineText' },
                { name: 'Reported Date', fieldType: 'date' },
                { name: 'Steps to Reproduce', fieldType: 'longText' },
              ],
            },
          ],
        },
      },
    ];

    for (const tpl of defaults) {
      await db.query(
        'INSERT INTO tp_base_templates (name, description, category, is_featured, schema_snapshot) VALUES ($1, $2, $3, $4, $5)',
        [
          tpl.name,
          tpl.description,
          tpl.category,
          tpl.is_featured,
          JSON.stringify(tpl.schema_snapshot),
        ]
      );
    }
    logger.info('[TemplateService] Seeded 6 default templates');

    try {
      const tally = await tabeleConsultingTemplatesSeeder.seed();
      logger.info('[TemplateService] Tabele consulting seeder applied', tally);
    } catch (err) {
      logger.error('[TemplateService] Tabele consulting seeder failed (post-legacy fresh)', {
        error: (err as Error).message,
      });
    }
  },
};

export default templateService;
