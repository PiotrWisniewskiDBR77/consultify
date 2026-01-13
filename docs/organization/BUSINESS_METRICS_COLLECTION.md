# Business Metrics Data Collection Guide

**Purpose**: Populate the Business Metrics Dashboard with real production data  
**Target**: Complete within 2-3 days  
**Owner**: Product + Finance + Engineering

---

## Overview

This guide provides SQL queries and data collection methods to populate all metrics in `/docs/metrics/BUSINESS_METRICS.md`.

**Data Sources**:

1. PostgreSQL production database
2. Stripe API (payment data)
3. Application analytics logs
4. Support ticket system (if separate)

---

## Metric Categories & Queries

### 1. Revenue Metrics (MRR/ARR)

#### Monthly Recurring Revenue (MRR)

```sql
-- Total MRR (current month)
SELECT
  SUM(
    CASE
      WHEN billing_interval = 'monthly' THEN amount
      WHEN billing_interval = 'annual' THEN amount / 12
      ELSE 0
    END
  ) as total_mrr
FROM subscriptions
WHERE
  status = 'active'
  AND deleted_at IS NULL;

-- New MRR (this month)
SELECT SUM(mrr_amount) as new_mrr
FROM subscriptions
WHERE
  status = 'active'
  AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE);

-- Churned MRR (this month)
SELECT SUM(mrr_amount) as churned_mrr
FROM subscriptions
WHERE
  status = 'canceled'
  AND DATE_TRUNC('month', canceled_at) = DATE_TRUNC('month', CURRENT_DATE);
```

#### Annual Recurring Revenue (ARR)

```sql
-- ARR = MRR × 12
SELECT (SUM(mrr_amount) * 12) as arr
FROM (
  -- Same MRR calculation as above
  ...
) mrr_data;
```

---

### 2. Customer Metrics

#### Customer Counts

```sql
-- Total customers (organizations)
SELECT COUNT(*) as total_customers
FROM organizations
WHERE deleted_at IS NULL;

-- Paying customers
SELECT COUNT(DISTINCT organization_id) as paying_customers
FROM subscriptions
WHERE
  status = 'active'
  AND deleted_at IS NULL;

-- Free trial users
SELECT COUNT(*) as trial_users
FROM users
WHERE
  subscription_tier = 'trial'
  AND trial_end_date > CURRENT_DATE;
```

#### Customer Acquisition Cost (CAC)

```sql
-- CAC = Total Sales & Marketing Spend / New Customers
-- (Requires manual input from finance for S&M spend)

-- New customers this month
SELECT COUNT(*) as new_customers_this_month
FROM organizations
WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE);

-- Then calculate:
-- CAC = [Monthly S&M Spend from Finance] / new_customers_this_month
```

#### Churn Rate

```sql
-- Monthly churn rate
SELECT
  COUNT(CASE WHEN canceled_at IS NOT NULL THEN 1 END)::float /
  COUNT(*)::float * 100 as monthly_churn_percentage
FROM subscriptions
WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');

-- Logo retention (% of customers retained)
SELECT
  (1 - (churned_customers::float / total_customers::float)) * 100 as logo_retention
FROM (
  SELECT
    COUNT(*) FILTER (WHERE created_at < CURRENT_DATE - INTERVAL '1 year') as total_customers,
    COUNT(*) FILTER (WHERE canceled_at >= CURRENT_DATE - INTERVAL '1 year') as churned_customers
  FROM subscriptions
) retention_data;
```

---

### 3. Growth Metrics

#### User Growth

```sql
-- Monthly active users (MAU)
SELECT COUNT(DISTINCT user_id) as mau
FROM activity_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Weekly active users (WAU)
SELECT COUNT(DISTINCT user_id) as wau
FROM activity_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- DAU/MAU ratio (engagement)
SELECT
  (dau::float / mau::float) * 100 as dau_mau_ratio
FROM (
  SELECT
    (SELECT COUNT(DISTINCT user_id) FROM activity_logs WHERE created_at >= CURRENT_DATE - INTERVAL '1 day') as dau,
    (SELECT COUNT(DISTINCT user_id) FROM activity_logs WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as mau
) engagement;
```

#### MoM Growth

```sql
-- Month-over-month user growth
WITH monthly_users AS (
  SELECT
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as user_count
  FROM users
  GROUP BY DATE_TRUNC('month', created_at)
  ORDER BY month DESC
  LIMIT 2
)
SELECT
  ((current_month.user_count - previous_month.user_count)::float / previous_month.user_count::float) * 100 as mom_growth_pct
FROM
  (SELECT user_count FROM monthly_users LIMIT 1) current_month,
  (SELECT user_count FROM monthly_users OFFSET 1 LIMIT 1) previous_month;
```

---

### 4. Conversion Funnel

```sql
-- Sign-ups → Activated → Trial → Paying
WITH funnel AS (
  SELECT
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as signups,
    COUNT(*) FILTER (WHERE activated_at IS NOT NULL AND activated_at >= CURRENT_DATE - INTERVAL '30 days') as activated,
    COUNT(*) FILTER (WHERE subscription_tier = 'trial' AND created_at >= CURRENT_DATE - INTERVAL '30 days') as trials,
    COUNT(*) FILTER (WHERE subscription_status = 'active' AND subscription_start_date >= CURRENT_DATE - INTERVAL '30 days') as paying
  FROM users
)
SELECT
  signups,
  activated,
  trials,
  paying,
  (activated::float / signups::float * 100) as activation_rate,
  (trials::float / activated::float * 100) as trial_rate,
  (paying::float / trials::float * 100) as conversion_rate
FROM funnel;
```

---

### 5. Product Usage Metrics

#### AI/Assessment Usage

```sql
-- Assessments completed (this month)
SELECT COUNT(*) as assessments_completed
FROM assessments
WHERE
  status = 'completed'
  AND completed_at >= DATE_TRUNC('month', CURRENT_DATE);

-- AI recommendations generated
SELECT COUNT(*) as ai_recommendations
FROM ai_requests
WHERE
  created_at >= DATE_TRUNC('month', CURRENT_DATE)
  AND status = 'success';

-- Cache hit rate
SELECT
  (cache_hits::float / (cache_hits + cache_misses)::float * 100) as cache_hit_rate_pct
FROM (
  SELECT
    COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
    COUNT(*) FILTER (WHERE cache_hit = false) as cache_misses
  FROM ai_requests
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
) cache_stats;
```

---

### 6. Cohort Analysis

#### Monthly Cohorts (Retention)

```sql
-- Cohort retention by signup month
WITH cohorts AS (
  SELECT
    user_id,
    DATE_TRUNC('month', created_at) as cohort_month,
    created_at
  FROM users
),
activity AS (
  SELECT
    user_id,
    DATE_TRUNC('month', created_at) as activity_month
  FROM activity_logs
  GROUP BY user_id, DATE_TRUNC('month', created_at)
)
SELECT
  cohorts.cohort_month,
  COUNT(DISTINCT cohorts.user_id) as cohort_size,
  COUNT(DISTINCT CASE WHEN activity.activity_month = cohorts.cohort_month THEN cohorts.user_id END) as month_0,
  COUNT(DISTINCT CASE WHEN activity.activity_month = cohorts.cohort_month + INTERVAL '1 month' THEN cohorts.user_id END) as month_1,
  COUNT(DISTINCT CASE WHEN activity.activity_month = cohorts.cohort_month + INTERVAL '3 months' THEN cohorts.user_id END) as month_3,
  COUNT(DISTINCT CASE WHEN activity.activity_month = cohorts.cohort_month + INTERVAL '6 months' THEN cohorts.user_id END) as month_6
FROM cohorts
LEFT JOIN activity ON cohorts.user_id = activity.user_id
GROUP BY cohorts.cohort_month
ORDER BY cohorts.cohort_month DESC
LIMIT 6;
```

---

## Stripe API Data Collection

### Setup

```bash
# Install Stripe CLI (if not already)
brew install stripe/stripe-cli/stripe

# Login
stripe login
```

### Revenue from Stripe

```bash
# MRR from active subscriptions
stripe subscriptions list --status active --limit 100 | \
  jq '[.data[].items.data[].price.unit_amount] | add / 100'

# Or use Stripe Dashboard → Reports → MRR
```

### Python Script for Stripe Data

```python
import stripe
stripe.api_key = 'sk_live_...'  # From env var

# Get MRR
subscriptions = stripe.Subscription.list(status='active', limit=100)
mrr = sum([
    sub.items.data[0].price.unit_amount / 100  # Convert cents → dollars
    for sub in subscriptions.data
    if sub.items.data[0].price.recurring.interval == 'month'
])

print(f"MRR: ${mrr:,.2f}")
```

---

## Analytics Integration

### If using Google Analytics

```javascript
// Track user events
gtag('event', 'assessment_completed', {
  event_category: 'engagement',
  event_label: assessment_type,
});

// Pull data via Google Analytics API
// Or export to BigQuery for SQL analysis
```

### If using custom analytics

```sql
-- Event tracking
SELECT
  event_name,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as unique_users
FROM analytics_events
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY event_name
ORDER BY event_count DESC;
```

---

## Data Collection Workflow

### Step 1: Identify Data Sources (Day 1 Morning)

- [ ] PostgreSQL connection confirmed
- [ ] Stripe API access confirmed
- [ ] Analytics access confirmed
- [ ] Manual data sources identified (finance, support)

### Step 2: Run Queries (Day 1 Afternoon)

- [ ] Execute all SQL queries above
- [ ] Export results to CSV/spreadsheet
- [ ] Pull Stripe data
- [ ] Collect manual inputs from finance

### Step 3: Calculate Derived Metrics (Day 2 Morning)

- [ ] CAC = S&M Spend / New Customers
- [ ] LTV = ARPA × (1 / Churn Rate) × Gross Margin
- [ ] LTV:CAC Ratio
- [ ] Cohort retention percentages

### Step 4: Populate Dashboard (Day 2 Afternoon)

- [ ] Update `/docs/metrics/BUSINESS_METRICS.md`
- [ ] Replace all "TBD" with actual values
- [ ] Add date of last update
- [ ] Validate calculations

### Step 5: Review \u0026 Verify (Day 3)

- [ ] Cross-check with finance team
- [ ] Validate against Stripe dashboard
- [ ] Ensure all metrics populated
- [ ] Prepare summary for VC pitch

---

## Quick Reference: Key Metrics

| Metric         | Source              | Calculation                                     |
| -------------- | ------------------- | ----------------------------------------------- |
| **MRR**        | Subscriptions table | SUM(subscription amounts normalized to monthly) |
| **ARR**        | MRR                 | MRR × 12                                        |
| **CAC**        | Finance + DB        | S&M Spend / New Customers                       |
| **LTV**        | Subscriptions       | ARPA / Churn Rate × Gross Margin                |
| **Churn**      | Subscriptions       | Canceled / Total subscriptions                  |
| **MAU**        | Activity logs       | DISTINCT users in last 30 days                  |
| **Conversion** | Users table         | Paying / Trials                                 |

---

## Troubleshooting

### Issue: Missing data in production DB

**Solution**:

- Check if analytics/activity logging is enabled
- May need to implement tracking first
- Use Stripe data as fallback for revenue

### Issue: Can't access Stripe

**Solution**:

- Get API keys from founder/finance
- Or export CSV from Stripe Dashboard

### Issue: Cohort data incomplete

**Solution**:

- May only have data for recent cohorts
- Document "Insufficient data for cohorts before [DATE]"

---

## Output Format

Update `/docs/metrics/BUSINESS_METRICS.md`:

```markdown
### Monthly Recurring Revenue (MRR)

**Last Updated**: January 15, 2026

| Metric          | Value   |
| --------------- | ------- |
| **Total MRR**   | $12,450 |
| **New MRR**     | $2,100  |
| **Churn MRR**   | -$350   |
| **Net New MRR** | $1,750  |

---

**Data Source**: PostgreSQL production DB + Stripe  
**Data Collection Date**: 2026-01-15  
**Methodology**: See `/docs/organization/BUSINESS_METRICS_COLLECTION.md`
```

---

## Automation (Future)

**Goal**: Automate monthly metric updates

**Options**:

1. **Metabase/Tableau**: Connect to PostgreSQL, auto-refresh dashboards
2. **Python Script**: Cron job to run queries monthly
3. **Internal Admin Dashboard**: Build UI for metrics

**Timeline**: Post-fundraise (not critical for DD)

---

**Document Owner**: Product + Engineering  
**Last Updated**: January 11, 2026  
**Deadline**: Day 3 of Week 1
