import { flagOn, parseMaybeJson } from '../../utils/pgFlags.js';
import { AppError, type AuthenticatedRequest, catchAsync, deps } from './shared.js';

export const getLifecycleStages = catchAsync(async (req, res, next) => {
  const stages = await deps.db.all(
    'SELECT * FROM customer_lifecycle_stages ORDER BY order_index ASC'
  );
  // flagOn: is_active may be int4 (1), int8/bigint ("1"), or native boolean on
  // Postgres — a raw `=== 1` silently renders every stage as inactive.
  res.json(stages.map((s: any) => ({ ...s, isActive: flagOn(s.is_active) })));
});

export const createLifecycleStage = catchAsync(async (req, res, next) => {
  const { name, description, orderIndex, color } = req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    'INSERT INTO customer_lifecycle_stages (id, name, description, order_index, color) VALUES (?, ?, ?, ?, ?)',
    [id, name, description, orderIndex || 0, color || '#6B7280']
  );

  res.json({ id, name, description, orderIndex, color });
});

export const updateLifecycleStage = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, description, orderIndex, color, isActive } = req.body;

  await deps.db.run(
    'UPDATE customer_lifecycle_stages SET name = ?, description = ?, order_index = ?, color = ?, is_active = ? WHERE id = ?',
    [name, description, orderIndex, color, isActive ? 1 : 0, id]
  );

  res.json({ message: 'Stage updated' });
});

export const deleteLifecycleStage = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await deps.db.run('DELETE FROM customer_lifecycle_stages WHERE id = ?', [id]);
  res.json({ message: 'Stage deleted' });
});

export const transitionOrganization = catchAsync(async (req, res, next) => {
  const { organizationId, fromStageId, toStageId, notes } = req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO customer_lifecycle_transitions (id, organization_id, from_stage_id, to_stage_id, transitioned_by, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
    [id, organizationId, fromStageId, toStageId, (req as AuthenticatedRequest).user!.id, notes]
  );

  res.json({ id, organizationId, fromStageId, toStageId });
});

export const getLifecycleTransitions = catchAsync(async (req, res, next) => {
  const { organizationId, limit = 100 } = req.query;

  let sql = `
        SELECT t.*, 
               fs.name as from_stage_name, ts.name as to_stage_name,
               o.name as organization_name, u.email as transitioned_by_email
        FROM customer_lifecycle_transitions t
        LEFT JOIN customer_lifecycle_stages fs ON t.from_stage_id = fs.id
        LEFT JOIN customer_lifecycle_stages ts ON t.to_stage_id = ts.id
        LEFT JOIN organizations o ON t.organization_id = o.id
        LEFT JOIN users u ON t.transitioned_by = u.id
        WHERE 1=1
    `;
  const params = [];

  if (organizationId) {
    sql += ' AND t.organization_id = ?';
    params.push(organizationId);
  }

  sql += ' ORDER BY t.transitioned_at DESC LIMIT ?';
  params.push(parseInt(String(limit)));

  const transitions = await deps.db.all(sql, params);
  res.json(transitions);
});

export const getLifecycleStats = catchAsync(async (req, res, next) => {
  const stageStats = await deps.db.all(`
        SELECT s.id, s.name, s.color, COUNT(DISTINCT t.organization_id) as org_count
        FROM customer_lifecycle_stages s
        LEFT JOIN (
            SELECT organization_id, to_stage_id
            FROM customer_lifecycle_transitions t1
            WHERE transitioned_at = (
                SELECT MAX(transitioned_at) FROM customer_lifecycle_transitions t2
                WHERE t2.organization_id = t1.organization_id
            )
        ) t ON s.id = t.to_stage_id
        GROUP BY s.id, s.name, s.color
        ORDER BY s.order_index
    `);

  const totalTransitions = await deps.db.get(
    'SELECT COUNT(*) as count FROM customer_lifecycle_transitions'
  );

  res.json({ stageStats, totalTransitions: (totalTransitions as any)?.count || 0 });
});

export const getSuccessPlaybooks = catchAsync(async (req, res, next) => {
  const { isActive } = req.query;

  let sql = 'SELECT * FROM customer_success_playbooks WHERE 1=1';
  const params = [];

  if (isActive !== undefined) {
    sql += ' AND is_active = ?';
    params.push(isActive === 'true' ? 1 : 0);
  }

  sql += ' ORDER BY name ASC';
  const playbooks = await deps.db.all(sql, params);

  res.json(
    playbooks.map((p: any) => ({
      ...p,
      // parseMaybeJson: *_json columns are native jsonb (object) on Postgres —
      // a raw JSON.parse() throws on "[object Object]". flagOn: see above.
      triggerConditions: parseMaybeJson(p.trigger_conditions_json, {}),
      actions: parseMaybeJson(p.actions_json, []),
      isActive: flagOn(p.is_active),
    }))
  );
});

export const createSuccessPlaybook = catchAsync(async (req, res, next) => {
  const { name, description, triggerConditions, actions } = req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO customer_success_playbooks (id, name, description, trigger_conditions_json, actions_json, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      description,
      JSON.stringify(triggerConditions || {}),
      JSON.stringify(actions || []),
      (req as AuthenticatedRequest).user!.id,
    ]
  );

  res.json({ id, name, description, triggerConditions, actions });
});

export const updateSuccessPlaybook = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { name, description, triggerConditions, actions, isActive } = req.body;

  await deps.db.run(
    `UPDATE customer_success_playbooks SET name = ?, description = ?, trigger_conditions_json = ?, 
         actions_json = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?`,
    [
      name,
      description,
      JSON.stringify(triggerConditions || {}),
      JSON.stringify(actions || []),
      isActive ? 1 : 0,
      id,
    ]
  );

  res.json({ message: 'Playbook updated' });
});

export const deleteSuccessPlaybook = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await deps.db.run('DELETE FROM customer_success_playbooks WHERE id = ?', [id]);
  res.json({ message: 'Playbook deleted' });
});

export const executeSuccessPlaybook = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { organizationId } = req.body;

  const playbook = await deps.db.get('SELECT * FROM customer_success_playbooks WHERE id = ?', [id]);
  if (!playbook) {
    return next(new AppError('Playbook not found', 404));
  }

  const actions = JSON.parse((playbook as any).actions_json || '[]');
  const actionId = deps.uuid.v4();

  // Record action
  await deps.db.run(
    `INSERT INTO customer_success_actions (id, playbook_id, organization_id, action_type, status, executed_at)
         VALUES (?, ?, ?, ?, 'completed', datetime('now'))`,
    [actionId, id, organizationId, 'execute_playbook']
  );

  res.json({ actionId, playbookId: id, organizationId, actionsExecuted: actions.length });
});

export const getSuccessActions = catchAsync(async (req, res, next) => {
  const { playbookId, organizationId, status, limit = 100 } = req.query;

  let sql = `
        SELECT a.*, p.name as playbook_name, o.name as organization_name
        FROM customer_success_actions a
        LEFT JOIN customer_success_playbooks p ON a.playbook_id = p.id
        LEFT JOIN organizations o ON a.organization_id = o.id
        WHERE 1=1
    `;
  const params = [];

  if (playbookId) {
    sql += ' AND a.playbook_id = ?';
    params.push(playbookId);
  }
  if (organizationId) {
    sql += ' AND a.organization_id = ?';
    params.push(organizationId);
  }
  if (status) {
    sql += ' AND a.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY a.created_at DESC LIMIT ?';
  params.push(parseInt(String(limit)));

  const actions = await deps.db.all(sql, params);
  res.json(actions.map((a: any) => ({ ...a, result: JSON.parse(a.result_json || '{}') })));
});

export const getPlaybookStats = catchAsync(async (req, res, next) => {
  const stats = await deps.db.get(`
        SELECT 
            (SELECT COUNT(*) FROM customer_success_playbooks) as total_playbooks,
            (SELECT COUNT(*) FROM customer_success_playbooks WHERE is_active = 1) as active_playbooks,
            (SELECT COUNT(*) FROM customer_success_actions) as total_actions,
            (SELECT COUNT(*) FROM customer_success_actions WHERE status = 'completed') as completed_actions
    `);
  res.json(stats);
});

export const getCustomerContracts = catchAsync(async (req, res, next) => {
  const { organizationId, status, limit = 100 } = req.query;

  let sql = `
        SELECT c.*, o.name as organization_name
        FROM customer_contracts c
        LEFT JOIN organizations o ON c.organization_id = o.id
        WHERE 1=1
    `;
  const params = [];

  if (organizationId) {
    sql += ' AND c.organization_id = ?';
    params.push(organizationId);
  }
  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY c.start_date DESC LIMIT ?';
  params.push(parseInt(String(limit)));

  const contracts = await deps.db.all(sql, params);
  res.json(contracts.map((c: any) => ({ ...c, terms: JSON.parse(c.terms_json || '{}') })));
});

export const createCustomerContract = catchAsync(async (req, res, next) => {
  const {
    organizationId,
    contractType,
    startDate,
    endDate,
    renewalDate,
    value,
    currency,
    terms,
    documentUrl,
  } = req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO customer_contracts (id, organization_id, contract_type, start_date, end_date, renewal_date, value, currency, terms_json, document_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      organizationId,
      contractType,
      startDate,
      endDate,
      renewalDate,
      value || 0,
      currency || 'USD',
      JSON.stringify(terms || {}),
      documentUrl,
    ]
  );

  res.json({ id, organizationId, contractType, startDate, endDate, value });
});

export const updateCustomerContract = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { endDate, renewalDate, value, status, terms, documentUrl } = req.body;

  await deps.db.run(
    `UPDATE customer_contracts SET end_date = ?, renewal_date = ?, value = ?, status = ?, 
         terms_json = ?, document_url = ?, updated_at = datetime('now') WHERE id = ?`,
    [endDate, renewalDate, value, status, JSON.stringify(terms || {}), documentUrl, id]
  );

  res.json({ message: 'Contract updated' });
});

export const deleteCustomerContract = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await deps.db.run('DELETE FROM customer_contracts WHERE id = ?', [id]);
  res.json({ message: 'Contract deleted' });
});

export const createContractAmendment = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { amendmentType, amendmentDate, changes } = req.body;
  const amendmentId = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO contract_amendments (id, contract_id, amendment_type, amendment_date, changes_json, approved_by, approved_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      amendmentId,
      id,
      amendmentType,
      amendmentDate,
      JSON.stringify(changes || {}),
      (req as AuthenticatedRequest).user!.id,
    ]
  );

  res.json({ id: amendmentId, contractId: id, amendmentType, amendmentDate, changes });
});

export const getContractAmendments = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const amendments = await deps.db.all(
    `SELECT a.*, u.email as approved_by_email
         FROM contract_amendments a
         LEFT JOIN users u ON a.approved_by = u.id
         WHERE a.contract_id = ? ORDER BY a.amendment_date DESC`,
    [id]
  );

  res.json(amendments.map((a: any) => ({ ...a, changes: JSON.parse(a.changes_json || '{}') })));
});

export const getUpcomingRenewals = catchAsync(async (req, res, next) => {
  const { daysAhead = 90 } = req.query;

  const renewals = await deps.db.all(
    `SELECT c.*, o.name as organization_name
         FROM customer_contracts c
         LEFT JOIN organizations o ON c.organization_id = o.id
         WHERE c.renewal_date BETWEEN date('now') AND date('now', '+' || ? || ' days')
         AND c.status = 'active'
         ORDER BY c.renewal_date ASC`,
    [parseInt(String(daysAhead))]
  );

  res.json(renewals.map((r: any) => ({ ...r, terms: JSON.parse(r.terms_json || '{}') })));
});

export const getContractStats = catchAsync(async (req, res, next) => {
  const stats = await deps.db.get(`
        SELECT 
            COUNT(*) as total_contracts,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_contracts,
            SUM(CASE WHEN status = 'active' THEN value ELSE 0 END) as total_value,
            (SELECT COUNT(*) FROM customer_contracts WHERE renewal_date BETWEEN date('now') AND date('now', '+30 days')) as renewals_30d
        FROM customer_contracts
    `);
  res.json(stats);
});
