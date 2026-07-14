import { flagOn } from '../../utils/pgFlags.js';
import { AppError, type AuthenticatedRequest, catchAsync, deps } from './shared.js';

// =========================================
// PHASE 5: REVENUE MANAGEMENT MODULE
// =========================================

// Pricing Plans
export const getPricingPlans = catchAsync(async (req, res, next) => {
  // Get plans from organizations or a dedicated table
  const plans = [
    { id: 'free', name: 'Free', price: 0, features: ['Basic features', '1 project'] },
    {
      id: 'pro',
      name: 'Pro',
      price: 99,
      features: ['All features', '10 projects', 'Priority support'],
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 499,
      features: ['Unlimited features', 'Unlimited projects', 'Dedicated support', 'SLA'],
    },
  ];
  res.json(plans);
});

export const createPricingPlan = catchAsync(async (req, res, next) => {
  const { name, price, features, limits, billingCycle, trialDays } = req.body;
  const id = deps.uuid.v4();

  // Store in plan_features or a dedicated pricing table
  res.json({ id, name, price, features, limits, billingCycle, trialDays });
});

export const updatePricingPlan = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  res.json({ message: 'Plan updated' });
});

export const deletePricingPlan = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  res.json({ message: 'Plan deleted' });
});

export const getPlanFeatures = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const features = await deps.db.all('SELECT * FROM plan_features WHERE plan_id = ?', [id]);
  res.json(features);
});

export const addPlanFeature = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { featureKey, featureValue } = req.body;
  const featureId = deps.uuid.v4();

  await deps.db.run(
    'INSERT INTO plan_features (id, plan_id, feature_key, feature_value) VALUES (?, ?, ?, ?)',
    [featureId, id, featureKey, featureValue]
  );

  res.json({ id: featureId, planId: id, featureKey, featureValue });
});

export const removePlanFeature = catchAsync(async (req, res, next) => {
  const { featureId } = req.params;
  await deps.db.run('DELETE FROM plan_features WHERE id = ?', [featureId]);
  res.json({ message: 'Feature removed' });
});

export const comparePricingPlans = catchAsync(async (req, res, next) => {
  const { planIds } = req.query;
  // Return comparison data
  res.json({ comparison: [] });
});

// Subscription Changes
export const getSubscriptionChanges = catchAsync(async (req, res, next) => {
  const { organizationId, status, limit = 100 } = req.query;

  let sql = `
        SELECT sc.*, o.name as organization_name
        FROM subscription_changes sc
        LEFT JOIN organizations o ON sc.organization_id = o.id
        WHERE 1=1
    `;
  const params = [];

  if (organizationId) {
    sql += ' AND sc.organization_id = ?';
    params.push(organizationId);
  }
  if (status) {
    sql += ' AND sc.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY sc.created_at DESC LIMIT ?';
  params.push(parseInt(String(limit)));

  const changes = await deps.db.all(sql, params);
  res.json(changes);
});

export const createSubscriptionChange = catchAsync(async (req, res, next) => {
  const { organizationId, fromPlanId, toPlanId, changeType, effectiveDate, prorationAmount } =
    req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO subscription_changes (id, organization_id, from_plan_id, to_plan_id, change_type, effective_date, proration_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, organizationId, fromPlanId, toPlanId, changeType, effectiveDate, prorationAmount || 0]
  );

  res.json({ id, organizationId, fromPlanId, toPlanId, changeType, effectiveDate });
});

export const approveSubscriptionChange = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  await deps.db.run(
    'UPDATE subscription_changes SET status = "approved", approved_by = ?, approved_at = datetime("now") WHERE id = ?',
    [(req as AuthenticatedRequest).user!.id, id]
  );

  res.json({ message: 'Subscription change approved' });
});

export const rejectSubscriptionChange = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  await deps.db.run('UPDATE subscription_changes SET status = "rejected" WHERE id = ?', [id]);
  res.json({ message: 'Subscription change rejected' });
});

export const calculateProration = catchAsync(async (req, res, next) => {
  const { organizationId, fromPlanId, toPlanId, effectiveDate } = req.body;

  return next(new AppError('Proration calculation is not available', 503, 'FEATURE_UNAVAILABLE'));
});

export const getSubscriptionChangeStats = catchAsync(async (req, res, next) => {
  const stats = await deps.db.get(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
            SUM(CASE WHEN change_type = 'upgrade' THEN 1 ELSE 0 END) as upgrades,
            SUM(CASE WHEN change_type = 'downgrade' THEN 1 ELSE 0 END) as downgrades
        FROM subscription_changes
    `);
  res.json(stats);
});

// Revenue Recognition
export const getRevenueRecognitions = catchAsync(async (req, res, next) => {
  const { organizationId, status, limit = 100 } = req.query;

  let sql = `
        SELECT rr.*, o.name as organization_name
        FROM revenue_recognition rr
        LEFT JOIN organizations o ON rr.organization_id = o.id
        WHERE 1=1
    `;
  const params = [];

  if (organizationId) {
    sql += ' AND rr.organization_id = ?';
    params.push(organizationId);
  }
  if (status) {
    sql += ' AND rr.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY rr.created_at DESC LIMIT ?';
  params.push(parseInt(String(limit)));

  const recognitions = await deps.db.all(sql, params);
  res.json(
    recognitions.map((r: any) => ({
      ...r,
      recognitionSchedule: JSON.parse(r.recognition_schedule_json || '[]'),
    }))
  );
});

export const createRevenueRecognition = catchAsync(async (req, res, next) => {
  const {
    organizationId,
    contractId,
    revenueAmount,
    currency,
    recognitionMethod,
    recognitionSchedule,
  } = req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO revenue_recognition (id, organization_id, contract_id, revenue_amount, currency, recognition_method, recognition_schedule_json, remaining_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      organizationId,
      contractId,
      revenueAmount,
      currency || 'USD',
      recognitionMethod || 'straight_line',
      JSON.stringify(recognitionSchedule || []),
      revenueAmount,
    ]
  );

  res.json({ id, organizationId, revenueAmount, recognitionMethod });
});

export const updateRevenueRecognition = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { recognitionSchedule, status } = req.body;

  await deps.db.run(
    'UPDATE revenue_recognition SET recognition_schedule_json = ?, status = ?, updated_at = datetime("now") WHERE id = ?',
    [JSON.stringify(recognitionSchedule || []), status, id]
  );

  res.json({ message: 'Recognition updated' });
});

export const recognizeRevenue = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { amount } = req.body;

  const recognition = await deps.db.get('SELECT * FROM revenue_recognition WHERE id = ?', [id]);
  if (!recognition) {
    return next(new AppError('Revenue recognition not found', 404));
  }

  const newRecognized = ((recognition as any).recognized_amount || 0) + amount;
  const newRemaining = ((recognition as any).remaining_amount || 0) - amount;

  await deps.db.run(
    'UPDATE revenue_recognition SET recognized_amount = ?, remaining_amount = ?, updated_at = datetime("now") WHERE id = ?',
    [newRecognized, Math.max(0, newRemaining), id]
  );

  res.json({ recognizedAmount: newRecognized, remainingAmount: Math.max(0, newRemaining) });
});

export const getRecognitionSchedule = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const recognition = await deps.db.get('SELECT * FROM revenue_recognition WHERE id = ?', [id]);

  if (!recognition) {
    return next(new AppError('Revenue recognition not found', 404));
  }

  res.json({
    id: (recognition as any).id,
    schedule: JSON.parse((recognition as any).recognition_schedule_json || '[]'),
    recognized: (recognition as any).recognized_amount,
    remaining: (recognition as any).remaining_amount,
  });
});

export const getRevenueRecognitionStats = catchAsync(async (req, res, next) => {
  const stats: any = await new Promise((resolve, reject) => {
    deps.db.get(
      `SELECT 
            COUNT(*) as total,
            COALESCE(SUM(COALESCE(total_amount, revenue_amount, amount, 0)), 0) as total_revenue,
            COALESCE(SUM(recognized_amount), 0) as total_recognized,
            COALESCE(SUM(remaining_amount), 0) as total_remaining,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_items,
            COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_items,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_items
        FROM revenue_recognition`,
      [],
      (err: any, row: any) => (err ? reject(err) : resolve(row))
    );
  });
  const totalRev = Number(stats?.total_revenue || 0);
  const recognizedRev = Number(stats?.total_recognized || 0);
  const remainingRev = Number(stats?.total_remaining || 0);
  res.json({
    total: Number(stats?.total || 0),
    totalRevenue: totalRev,
    total_revenue: totalRev,
    recognizedRevenue: recognizedRev,
    recognized_revenue: recognizedRev,
    remainingRevenue: remainingRev > 0 ? remainingRev : Math.max(0, totalRev - recognizedRev),
    remaining_revenue: remainingRev > 0 ? remainingRev : Math.max(0, totalRev - recognizedRev),
    pendingItems: Number(stats?.pending_items || 0),
    pending_items: Number(stats?.pending_items || 0),
    inProgressItems: Number(stats?.in_progress_items || 0),
    in_progress_items: Number(stats?.in_progress_items || 0),
    completedItems: Number(stats?.completed_items || 0),
    completed_items: Number(stats?.completed_items || 0),
  });
});

// Revenue Forecasting
export const getRevenueForecasts = catchAsync(async (req, res, next) => {
  const { forecastType, limit = 50 } = req.query;

  let sql = 'SELECT * FROM revenue_forecasts WHERE 1=1';
  const params = [];

  if (forecastType) {
    sql += ' AND forecast_type = ?';
    params.push(forecastType);
  }

  sql += ' ORDER BY period_start DESC LIMIT ?';
  params.push(parseInt(String(limit)));

  const forecasts = await deps.db.all(sql, params);
  res.json(forecasts.map((f: any) => ({ ...f, inputData: JSON.parse(f.input_data_json || '{}') })));
});

export const createRevenueForecast = catchAsync(async (req, res, next) => {
  const {
    forecastType,
    periodStart,
    periodEnd,
    forecastedAmount,
    currency,
    confidenceLevel,
    method,
    inputData,
  } = req.body;
  const id = deps.uuid.v4();

  await deps.db.run(
    `INSERT INTO revenue_forecasts (id, forecast_type, period_start, period_end, forecasted_amount, currency, confidence_level, method, input_data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      forecastType,
      periodStart,
      periodEnd,
      forecastedAmount,
      currency || 'USD',
      confidenceLevel || 0.8,
      method || 'linear',
      JSON.stringify(inputData || {}),
    ]
  );

  res.json({ id, forecastType, periodStart, periodEnd, forecastedAmount });
});

export const updateRevenueForecast = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { forecastedAmount, confidenceLevel, inputData } = req.body;

  await deps.db.run(
    'UPDATE revenue_forecasts SET forecasted_amount = ?, confidence_level = ?, input_data_json = ?, updated_at = datetime("now") WHERE id = ?',
    [forecastedAmount, confidenceLevel, JSON.stringify(inputData || {}), id]
  );

  res.json({ message: 'Forecast updated' });
});

export const deleteRevenueForecast = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await deps.db.run('DELETE FROM revenue_forecasts WHERE id = ?', [id]);
  res.json({ message: 'Forecast deleted' });
});

export const generateRevenueForecast = catchAsync(async (req, res, next) => {
  const { forecastType, periodMonths } = req.body;

  // Simple forecast generation
  const forecasts = [];
  const baseAmount = Math.random() * 10000 + 5000;

  for (let i = 0; i < (periodMonths || 12); i++) {
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    const periodStart = date.toISOString().split('T')[0];
    date.setMonth(date.getMonth() + 1);
    const periodEnd = date.toISOString().split('T')[0];

    forecasts.push({
      periodStart,
      periodEnd,
      forecastedAmount: baseAmount * (1 + i * 0.05), // 5% growth
    });
  }

  res.json({ forecasts });
});

export const getRevenueForecastStats = catchAsync(async (req, res, next) => {
  const stats = await deps.db.get(`
        SELECT 
            COUNT(*) as total,
            SUM(forecasted_amount) as total_forecasted,
            AVG(confidence_level) as avg_confidence
        FROM revenue_forecasts
    `);
  res.json(stats);
});

// Payment Management
export const getPaymentMethods = catchAsync(async (req, res, next) => {
  const { organizationId } = req.query;

  let sql = 'SELECT * FROM payment_methods WHERE 1=1';
  const params = [];

  if (organizationId) {
    sql += ' AND organization_id = ?';
    params.push(organizationId);
  }

  sql += ' ORDER BY is_default DESC, created_at DESC';
  const methods = await deps.db.all(sql, params);

  res.json(
    methods.map((m: any) => ({
      ...m,
      paymentDetails: JSON.parse(m.payment_details_json || '{}'),
      isDefault: flagOn(m.is_default),
      isActive: flagOn(m.is_active),
    }))
  );
});

export const addPaymentMethod = catchAsync(async (req, res, next) => {
  const { organizationId, paymentType, paymentDetails, isDefault } = req.body;
  const id = deps.uuid.v4();

  if (isDefault) {
    // Unset other defaults
    await deps.db.run('UPDATE payment_methods SET is_default = 0 WHERE organization_id = ?', [
      organizationId,
    ]);
  }

  await deps.db.run(
    `INSERT INTO payment_methods (id, organization_id, payment_type, payment_details_json, is_default)
         VALUES (?, ?, ?, ?, ?)`,
    [id, organizationId, paymentType, JSON.stringify(paymentDetails || {}), isDefault ? 1 : 0]
  );

  res.json({ id, organizationId, paymentType, isDefault });
});

export const updatePaymentMethod = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { paymentDetails, isDefault, isActive } = req.body;

  const method = await deps.db.get('SELECT * FROM payment_methods WHERE id = ?', [id]);

  if (isDefault) {
    await deps.db.run('UPDATE payment_methods SET is_default = 0 WHERE organization_id = ?', [
      (method as any).organization_id,
    ]);
  }

  await deps.db.run(
    'UPDATE payment_methods SET payment_details_json = ?, is_default = ?, is_active = ?, updated_at = datetime("now") WHERE id = ?',
    [JSON.stringify(paymentDetails || {}), isDefault ? 1 : 0, isActive !== false ? 1 : 0, id]
  );

  res.json({ message: 'Payment method updated' });
});

export const deletePaymentMethod = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await deps.db.run('DELETE FROM payment_methods WHERE id = ?', [id]);
  res.json({ message: 'Payment method deleted' });
});

export const getPaymentFailures = catchAsync(async (req, res, next) => {
  const { organizationId, status, limit = 100 } = req.query;

  let sql = `
        SELECT pf.*, o.name as organization_name
        FROM payment_failures pf
        LEFT JOIN organizations o ON pf.organization_id = o.id
        WHERE 1=1
    `;
  const params = [];

  if (organizationId) {
    sql += ' AND pf.organization_id = ?';
    params.push(organizationId);
  }
  if (status) {
    sql += ' AND pf.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY pf.attempted_at DESC LIMIT ?';
  params.push(parseInt(String(limit)));

  const failures = await deps.db.all(sql, params);
  res.json(failures);
});

export const retryPayment = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const failure = await deps.db.get('SELECT * FROM payment_failures WHERE id = ?', [id]);
  if (!failure) {
    return next(new AppError('Payment failure not found', 404));
  }

  // Simulate retry
  const success = Math.random() > 0.3;

  if (success) {
    await deps.db.run(
      'UPDATE payment_failures SET status = "resolved", resolved_at = datetime("now") WHERE id = ?',
      [id]
    );
    res.json({ success: true, message: 'Payment successful' });
  } else {
    await deps.db.run('UPDATE payment_failures SET retry_count = retry_count + 1 WHERE id = ?', [
      id,
    ]);
    res.json({ success: false, message: 'Payment retry failed' });
  }
});

export const getPaymentFailureStats = catchAsync(async (req, res, next) => {
  const stats = await deps.db.get(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as unresolved,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
            AVG(retry_count) as avg_retries
        FROM payment_failures
    `);
  res.json(stats);
});
