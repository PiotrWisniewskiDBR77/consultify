# 2. SaaS Business Model

## 2.1. Licensing Model

The system utilizes a **Tenant-Based Licensing** model with user seat tiers.

### Hierarchy
1.  **Tenant (Organization)**: The primary billing entity. Data is strictly isolated at this level.
2.  **User**: Named individuals with login credentials belonging to a Tenant.

### Plan Types
| Feature | Free (Trial) | Pro (Growth) | Enterprise (Corporate) |
| :--- | :--- | :--- | :--- |
| **Users** | Up to 3 | Up to 20 | Unlimited |
| **Projects/Initiatives** | Limited (3) | Unlimited | Unlimited |
| **AI Tokens** | 50k / month | 1M / month | Custom / Unlimited |
| **SSO** | No | Optional Add-on | Included |
| **Support** | Community | Email (24h SLA) | Dedicated CSM (4h SLA) |
| **Data Retention** | 30 Days | 1 Year | Unlimited (Audit Log) |

### Feature Flags
Access to specific modules (e.g., "AI Consultant", "Advanced Analytics") is controlled via backend logic layers (`OrganizationPlan` service), allowing granular feature enablement without code deployment.

## 2.2. Billing & Subscription

### Infrastructure
Recurring billing and subscription management are handled via **Stripe** integration. Consultify does not store raw credit card data (PCI-DSS compliance via Stripe Elements).

### Lifecycle
-   **Trial**: 14-day full access to Pro features. reverts to Free if not upgraded.
-   **Upgrade**: Instant access to new features. Prorated billing for the remainder of the cycle.
-   **Downgrade**: Applies at the end of the current billing cycle. Data exceeding plan limits (e.g., extra users) is locked (read-only) but not deleted immediately.
-   **Cancellation**: Account remains active until the period ends. Data is retained for 90 days post-cancellation before hard deletion.

### Invoicing
-   Automated PDF invoices sent to the Organization Admin email.
-   Support for multi-currency (USD, EUR, PLN) based on Tenant location.
-   VAT handling via Stripe Tax integration.

## 2.3. Multi-tenancy Strategy

### Logical Separation (Current Architecture)
-   **Database**: Shared schema (Postgres).
-   **Isolation**: Every query MUST include `organization_id` in the `WHERE` clause.
-   **Enforcement**: Middleware `requireOrganization` strictly validates user context before data access.

### Physical Separation (Enterprise Option)
-   For highly regulated clients (Banking/Defense), the architecture supports **Row-Level Security (RLS)** policies or dedicated database instances (Siloed Tenancy) upon request.

### Backup & Restore
-   **RPO (Recovery Point Objective)**: 1 hour.
-   **RTO (Recovery Time Objective)**: 4 hours.
-   **Process**: Automated daily snapshots of the database. Point-in-time recovery enabled. Tenants cannot trigger their own restores; this is a support-ticket action.
