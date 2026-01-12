# 5. Roles, Permissions & Organization Model

## 5.1. Types of Roles

The platform enforces Role-Based Access Control (RBAC) at the Organization level.

### 1. Super Admin (Platform Owner)
-   **Scope**: Platform-wide (Cross-tenant).
-   **Usage**: Internal Consultify staff only.
-   **Functions**: Managing tenants, global feature flags, viewing system health.

### 2. Organization Admin (Tenant Owner)
-   **Scope**: Single Tenant.
-   **Usage**: The stakeholder who purchased the tool (e.g., CDO, CIO).
-   **Functions**: Billing management, User invitation, Full visibility of all initiatives and assessments.

### 3. Manager (Transformation Lead)
-   **Scope**: Single Tenant.
-   **Usage**: Program Managers driving the transformation.
-   **Functions**: Full Read/Write on modules (Assessment, Initiatives), but cannot manage billing or delete the organization.

### 4. User (Contributor)
-   **Scope**: Single Tenant.
-   **Usage**: Team members assigned to specific tasks.
-   **Functions**: Can fill assessments and update assigned initiatives. Restricted visibility on financial dashboards.

### 5. Read-Only (Auditor/Board)
-   **Scope**: Single Tenant.
-   **Usage**: External auditors or Board members.
-   **Functions**: View dashboards and reports. No write capabilities.

## 5.2. Permissions Matrix

| Action | Super Admin | Org Admin | Manager | User | Read-Only |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Manage Billing** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Invite Users** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Configure Settings** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Delete Org** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View Dashboard** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Fill Assessment** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Create Initiatives** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Update Initiatives** | ✅ | ✅ | ✅ | Own Only | ❌ |
| **Generate AI Reports**| ✅ | ✅ | ✅ | ❌ | ❌ |
| **View Audit Logs** | ✅ | ✅ | ❌ | ❌ | ❌ |

## 5.3. Scope Definitions
-   **Global**: Actions affecting the entire SaaS instance (Super Admin only).
-   **Org**: Actions affecting the Tenant configuration.
-   **Object**: Actions restricted to specific records (e.g., "Own Only" for Initiatives).
