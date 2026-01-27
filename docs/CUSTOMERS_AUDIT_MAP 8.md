# Customers Module - UI/Data Mapping (Audit)

| Tab | Frontend View | Key Backend Routes | Core Tables |
| --- | --- | --- | --- |
| Organizations | `src/views/superadmin/OrganizationsView.tsx` | `/api/superadmin/organizations` (list, update, delete), `/api/superadmin/access-requests`, `/api/superadmin/access-codes` | `organizations`, `users`, `access_requests`, `access_codes` |
| Users | `src/views/superadmin/SuperAdminUserManagement.tsx` + `components/shared/UserManagementCore.tsx` | `/api/superadmin/users`, `/api/superadmin/users/:id` (update), `/api/superadmin/users/invite`, impersonation | `users`, `organizations` |
| Lifecycle | `customers/CustomerLifecycleView.tsx` | `/api/superadmin/lifecycle/stages`, `/transitions`, `/stats` | `customer_lifecycle_stages`, `customer_lifecycle_transitions` |
| Playbooks | `customers/CustomerSuccessPlaybooksView.tsx` | `/api/superadmin/playbooks` CRUD | `customer_success_playbooks`, `customer_playbook_actions` |
| Contracts | `customers/ContractManagementView.tsx` | `/api/superadmin/contracts`, `/contracts/stats`, `/contracts/renewals` | `customer_contracts` |
| Security | `customers/security/*` (SecurityModuleView) | `/api/superadmin/security/events`, `/security/events/:id/resolve`, `/ip-whitelist`, `/devices`, `/mfa`, `/password-policy` | `security_events` (fallback `login_history`), `ip_access_rules`, `user_devices`, `user_mfa_methods`, `password_policies` |
| Support & CS | `customers/support/SupportModuleView.tsx` | `/api/superadmin/support-tickets`, `/support-tickets/:id`, `/cs-notes`, `/customer-health` | `support_tickets`, `cs_notes`, `customer_health_scores` |
| Feedback | `customers/SuperAdminFeedbackView.tsx` | `/api/superadmin/feedback` | `feedback` |
| Analytics | `customers/CustomerAnalyticsView.tsx` | `/api/superadmin/usage/by-organization` (primary), fallback `/superadmin/organizations` | `ai_logs`, `users`, `organizations` |
| Compliance | `customers/CustomerComplianceView.tsx` | `/api/superadmin/compliance/summary` (primary), `/compliance/frameworks` | `compliance_status`, `compliance_frameworks`, `organizations` |
| Automation | `customers/CustomerAutomationView.tsx` | `/api/superadmin/automation/rules` | `automation_rules` |
| Communication | `customers/CustomerCommunicationView.tsx` | `/api/superadmin/communications`, templates | `communications`, `email_templates` |
| Bulk Ops | `views/admin/BulkOperationsView.tsx` | `/api/superadmin/users/export`, `/import`, roles, mass email | `users`, `organizations` |
| Compliance/Analytics (header cards) | `CustomersModule` badges | `/superadmin/feedback`, `/superadmin/access-requests` | `feedback`, `access_requests` |
