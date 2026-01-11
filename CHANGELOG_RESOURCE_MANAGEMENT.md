# Changelog

All notable changes to the Consultify Resource Allocation Management system.

## [1.0.0] - 2026-01-11

### Added

**Backend - API Endpoints**

- New subscription plans management API (SuperAdmin)
  - GET /api/superadmin/subscription-plans - List all subscription plans
  - POST /api/superadmin/subscription-plans - Create new plan
  - PUT /api/superadmin/subscription-plans/:id - Update existing plan
  - DELETE /api/superadmin/subscription-plans/:id - Delete plan
- Organization resource management API (SuperAdmin)
  - GET /api/superadmin/organizations/:id/resources - Get resource usage and budget
  - PUT /api/superadmin/organizations/:id/budget - Update organization budget
  - PUT /api/superadmin/organizations/:id/quotas - Override resource quotas
  - POST /api/superadmin/organizations/:id/charge-resource-change - Bill for resource changes
- Budget management API (Admin)
  - GET /api/admin/budget - Get budget status
  - GET /api/admin/budget/expenses - Get expense history with filters

**Database**

- New table: `budget_expenses` for tracking all organization expenses
- New table: `user_quotas` for per-user resource quotas
- Extended `organizations` table with budget tracking fields:
  - monthly_budget_usd
  - budget_spent_current_period
  - budget_alert_threshold
  - budget_period_start
  - memory_usage_mb_current
  - cpu_usage_percent_avg
- Extended `subscription_plans` table with resource limits:
  - memory_limit_mb
  - cpu_quota_percent
  - max_concurrent_ai_jobs

**Frontend - SuperAdmin Components**

- SubscriptionPlansManager (`src/views/superadmin/SubscriptionPlansManager.tsx`)
  - Full CRUD operations for subscription plans
  - Resource limits configuration (Memory, CPU, Tokens, Storage, AI Jobs)
  - Search and filter functionality
  - Active/Inactive toggle
  - Stripe integration support
- OrganizationResourceManager (`src/views/superadmin/OrganizationResourceManager.tsx`)
  - Real-time resource usage dashboards with gauges
  - Budget management interface
  - Quota override functionality
  - Billing integration for resource changes
  - Recent expenses tracking
- ResourceLimitInput (`src/components/superadmin/ResourceLimitInput.tsx`)
  - Reusable slider/input component for resource limits
  - Configurable min/max/step values

**Frontend - Admin Components**

- BudgetDashboard (`src/views/admin/BudgetDashboard.tsx`)
  - Budget overview cards (Monthly, Spent, Remaining)
  - Progress bar with alert threshold visualization
  - Spending trend chart (Line chart)
  - Category breakdown chart (Pie chart)
  - Expense history table with pagination
  - Category filtering

**Frontend - UI Components**

- ToastNotification system (`src/components/ui/ToastNotification.tsx`)
  - Success, Error, Warning, Info toast types
  - Auto-dismiss with manual close option
  - Slide-in animations
- LoadingSkeleton components (`src/components/ui/LoadingSkeleton.tsx`)
  - TableSkeleton, CardSkeleton, DashboardSkeleton, FormSkeleton
  - Shimmer animation effect

**Services**

- BudgetTrackingService (`server/src/services/budgetTrackingService.ts`)
  - Budget initialization and management
  - Expense recording
  - Budget alerts and notifications
  - Period-based tracking

**Middleware**

- Resource quota middleware (`server/src/middleware/resourceQuota.middleware.ts`)
  - Memory quota enforcement
  - CPU quota enforcement
  - Budget quota enforcement

**Testing**

- Backend integration tests (`tests/integration/resource-management-api.test.ts`)
  - 50+ test cases for all API endpoints
  - Authorization tests
  - Error handling tests
- Frontend component tests (`tests/frontend/resource-management-components.test.tsx`)
  - React Testing Library tests for all components
  - Loading states, error states, user interactions
- E2E tests (`tests/e2e/resource-management-flows.spec.ts`)
  - Complete user flow tests with Playwright
  - SuperAdmin and Admin role tests

**Documentation**

- Complete API documentation with schemas and examples
- Implementation walkthrough guide
- Production deployment guide
- User guides for SuperAdmin and Admin roles

**Routes**

- /superadmin/subscription-plans - Subscription Plans Manager
- /superadmin/resource-management - Organization Resource Manager
- /admin/budget - Budget Dashboard

### Changed

- Updated router.tsx with lazy-loaded resource management components
- Enhanced plan limits configuration with new resource fields
- Improved error handling across all components

### Security

- All SuperAdmin endpoints protected with requireSuperAdmin middleware
- Admin endpoints scoped to user's organization
- Input validation on all forms
- SQL injection prevention with parameterized queries

### Performance

- Lazy-loaded components for optimal code splitting
- React Query caching for reduced API calls
- Optimized re-renders with proper memoization

---

## Migration Guide

### Database Migration

Run the following migration:

```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < server/src/database/migrations/add_resource_tables.sql
```

### Seed Initial Data

Update existing subscription plans with resource limits:

```sql
UPDATE subscription_plans
SET memory_limit_mb = 512, cpu_quota_percent = 20, max_concurrent_ai_jobs = 2
WHERE name = 'Free';

UPDATE subscription_plans
SET memory_limit_mb = 2048, cpu_quota_percent = 50, max_concurrent_ai_jobs = 10
WHERE name = 'Pro';

UPDATE subscription_plans
SET memory_limit_mb = 8192, cpu_quota_percent = 100, max_concurrent_ai_jobs = 50
WHERE name = 'Enterprise';
```

### Breaking Changes

None - All changes are additive and backward compatible.

---

## Contributors

- Development Team - Full implementation
- Product Team - Requirements and specifications

---

## Support

For questions or issues, contact: support@consultify.com
