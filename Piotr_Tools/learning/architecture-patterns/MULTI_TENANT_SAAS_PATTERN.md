# Multi-Tenant SaaS Architecture Pattern

**Based on**: Consultify's production multi-tenancy  
**Use Case**: Any B2B SaaS with organizations/teams

---

## 🎯 What is Multi-Tenancy?

**Single Application, Multiple Customers**

Each customer (tenant) has:

- Their own data (isolated)
- Their own users
- Their own settings
- Shared application code

**Like**: Slack, GitHub, Notion - one app, many workspaces

---

## 🏗️ Architecture Pattern

### Database Schema

**Core Concept**: Every data table has `organization_id`

```sql
-- Organizations (tenants)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,  -- mycompany.yourapp.com
  plan TEXT CHECK(plan IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMP DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb
);

-- Users belong to organizations
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT CHECK(role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ALL data tables have organization_id
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),

  -- Composite index for fast org queries
  INDEX idx_org_projects (organization_id, created_at DESC)
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_org_documents (organization_id, project_id)
);
```

**KEY RULE**: ⚠️ EVERY query MUST filter by `organization_id`

---

## 🔒 Data Isolation

### Row-Level Security (PostgreSQL)

```sql
-- Enable RLS on all tenant tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their organization's data
CREATE POLICY org_isolation ON projects
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY org_isolation ON documents
  FOR ALL
  USING (organization_id = current_setting('app.current_org_id')::uuid);

-- In your app, set org context per request:
-- SET LOCAL app.current_org_id = 'uuid-here';
```

### Application-Level Isolation (Middleware)

```typescript
// middleware/tenant.ts
export const setTenantContext = async (req, res, next) => {
  // User already authenticated, has user.organizationId
  const { organizationId } = req.user;

  // Set context for this request
  req.organizationId = organizationId;

  // For PostgreSQL RLS
  await db.query('SET LOCAL app.current_org_id = $1', [organizationId]);

  next();
};

// ALWAYS use this middleware after auth
app.use(requireAuth);
app.use(setTenantContext);
```

### Safe Query Pattern

```typescript
// BAD ❌ - No org filtering
const projects = await db.query('SELECT * FROM projects');

// GOOD ✅ - Always filter by org
const projects = await db.query('SELECT * FROM projects WHERE organization_id = $1', [
  req.organizationId,
]);

// BETTER ✅✅ - Helper function
class ProjectRepository {
  constructor(private organizationId: string) {}

  async findAll() {
    return db.query('SELECT * FROM projects WHERE organization_id = $1', [this.organizationId]);
  }

  async findById(id: string) {
    const [project] = await db.query(
      'SELECT * FROM projects WHERE id = $1 AND organization_id = $2',
      [id, this.organizationId]
    );

    if (!project) throw new Error('Project not found');
    return project;
  }
}

// Usage
const repo = new ProjectRepository(req.organizationId);
const projects = await repo.findAll();
```

---

## 👥 User Management

### Roles & Permissions

```typescript
enum Role {
  OWNER = 'owner', // Full access, billing
  ADMIN = 'admin', // Manage users & settings
  MEMBER = 'member', // Regular access
}

interface Permission {
  resource: string; // 'projects', 'users', 'settings'
  action: string; // 'read', 'write', 'delete'
}

// Permission matrix
const PERMISSIONS: Record<Role, Permission[]> = {
  [Role.OWNER]: [
    { resource: '*', action: '*' }, // All permissions
  ],
  [Role.ADMIN]: [
    { resource: 'projects', action: '*' },
    { resource: 'users', action: 'write' },
    { resource: 'settings', action: 'write' },
  ],
  [Role.MEMBER]: [
    { resource: 'projects', action: 'read' },
    { resource: 'projects', action: 'write' },
  ],
};

// Check permission
function hasPermission(user: User, resource: string, action: string): boolean {
  const permissions = PERMISSIONS[user.role];

  return permissions.some(
    (p) =>
      (p.resource === '*' || p.resource === resource) && (p.action === '*' || p.action === action)
  );
}

// Middleware
export const requirePermission = (resource: string, action: string) => {
  return (req, res, next) => {
    if (!hasPermission(req.user, resource, action)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};

// Usage
app.delete(
  '/api/projects/:id',
  requireAuth,
  setTenantContext,
  requirePermission('projects', 'delete'),
  deleteProject
);
```

---

## 🚀 Onboarding Flow

### 1. Organization Creation

```typescript
async function createOrganization(data: CreateOrgInput) {
  return db.transaction(async (tx) => {
    // 1. Create organization
    const org = await tx.insert('organizations', {
      name: data.companyName,
      slug: generateSlug(data.companyName),
      plan: 'free',
    });

    // 2. Create owner user
    const user = await tx.insert('users', {
      email: data.email,
      organization_id: org.id,
      role: 'owner',
      password_hash: await hashPassword(data.password),
    });

    // 3. Create default data (optional)
    await tx.insert('projects', {
      organization_id: org.id,
      name: 'Getting Started',
      created_by: user.id,
    });

    return { org, user };
  });
}
```

### 2. Invite Users

```typescript
async function inviteUser(email: string, role: Role, invitedBy: User) {
  // 1. Create invitation
  const invitation = await db.insert('invitations', {
    email,
    organization_id: invitedBy.organizationId,
    role,
    invited_by: invitedBy.id,
    token: generateToken(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  // 2. Send email
  await sendEmail({
    to: email,
    subject: `Join ${invitedBy.organization.name}`,
    template: 'invitation',
    data: {
      inviterName: invitedBy.name,
      organizationName: invitedBy.organization.name,
      acceptLink: `https://app.com/invite/${invitation.token}`,
    },
  });

  return invitation;
}

async function acceptInvitation(token: string, password: string) {
  const invitation = await db.query(
    'SELECT * FROM invitations WHERE token = $1 AND expires_at > NOW()',
    [token]
  );

  if (!invitation) throw new Error('Invalid or expired invitation');

  // Create user
  const user = await db.insert('users', {
    email: invitation.email,
    organization_id: invitation.organization_id,
    role: invitation.role,
    password_hash: await hashPassword(password),
  });

  // Delete invitation
  await db.delete('invitations', { id: invitation.id });

  return user;
}
```

---

## 💰 Subscription & Billing

### Schema

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) UNIQUE,
  plan TEXT CHECK(plan IN ('free', 'pro', 'enterprise')),
  status TEXT CHECK(status IN ('active', 'canceled', 'past_due')),

  -- Stripe integration
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,

  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Usage limits
CREATE TABLE usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  metric TEXT,  -- 'projects', 'storage_mb', 'api_calls'
  value INTEGER,
  period_start TIMESTAMP,
  period_end TIMESTAMP,

  INDEX idx_org_usage (organization_id, metric, period_start)
);
```

### Enforce Limits

```typescript
const PLAN_LIMITS = {
  free: {
    projects: 3,
    storage_mb: 100,
    users: 5,
  },
  pro: {
    projects: 50,
    storage_mb: 10000,
    users: 50,
  },
  enterprise: {
    projects: Infinity,
    storage_mb: Infinity,
    users: Infinity,
  },
};

async function checkLimit(org: Organization, metric: string, increment = 1) {
  const limits = PLAN_LIMITS[org.plan];
  const current = await getCurrentUsage(org.id, metric);

  if (current + increment > limits[metric]) {
    throw new Error(`Plan limit reached for ${metric}. Upgrade to continue.`);
  }
}

// Before creating resource
app.post('/api/projects', async (req, res) => {
  const org = await getOrganization(req.organizationId);

  // Check limit
  await checkLimit(org, 'projects');

  // Create project...
});
```

---

## 🔧 Useful Patterns

### Subdomain Routing

```typescript
// middleware/subdomain.ts
export const parseSubdomain = (req, res, next) => {
  const host = req.headers.host; // e.g., "acme.yourapp.com"
  const subdomain = host.split('.')[0];

  if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
    req.subdomain = subdomain;

    // Look up organization by slug
    const org = await db.query('SELECT * FROM organizations WHERE slug = $1', [subdomain]);

    if (org) {
      req.organizationId = org.id;
    }
  }

  next();
};

// Usage
app.use(parseSubdomain);
```

### Organization Switching

```typescript
// For users in multiple orgs (optional)
async function switchOrganization(userId: string, targetOrgId: string) {
  // Check user has access
  const membership = await db.query('SELECT * FROM users WHERE id = $1 AND organization_id = $2', [
    userId,
    targetOrgId,
  ]);

  if (!membership) {
    throw new Error('You do not have access to this organization');
  }

  // Update session
  req.session.organizationId = targetOrgId;

  return membership;
}
```

### Activity Logging (Per Org)

```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  action TEXT,  -- 'project.created', 'user.invited'
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_org_activity (organization_id, created_at DESC)
);
```

---

## ⚠️ Common Pitfalls

### 1. Forgetting organization_id

```typescript
// DANGER ❌
const project = await db.query('SELECT * FROM projects WHERE id = $1', [id]);

// If project belongs to another org, data leak!
```

**Solution**: ALWAYS include org filter

```typescript
const project = await db.query('SELECT * FROM projects WHERE id = $1 AND organization_id = $2', [
  id,
  req.organizationId,
]);
```

### 2. N+1 Query Problem

```typescript
// BAD ❌
const projects = await getProjects(orgId);
for (const project of projects) {
  project.owner = await getUser(project.created_by); // N queries!
}

// GOOD ✅
const projects = await db.query(
  `
  SELECT p.*, u.name as owner_name
  FROM projects p
  JOIN users u ON p.created_by = u.id
  WHERE p.organization_id = $1
`,
  [orgId]
);
```

### 3. Cascading Deletes

**Be careful!** Deleting org deletes ALL data:

```sql
-- This will delete EVERYTHING for the org
DELETE FROM organizations WHERE id = '...';

-- Due to ON DELETE CASCADE on all tables
```

**Solution**: Soft deletes for organizations

```sql
ALTER TABLE organizations ADD COLUMN deleted_at TIMESTAMP;

-- "Delete" organization
UPDATE organizations SET deleted_at = NOW() WHERE id = '...';

-- Filter out deleted orgs
SELECT * FROM organizations WHERE deleted_at IS NULL;
```

---

## ✅ Checklist for Multi-Tenant App

- [ ] All data tables have `organization_id`
- [ ] Every query filters by `organization_id`
- [ ] Row-Level Security enabled (PostgreSQL)
- [ ] Tenant context set in middleware
- [ ] Repository pattern enforces org scoping
- [ ] Role-based access control (RBAC)
- [ ] Invitation flow implemented
- [ ] Subscription limits enforced
- [ ] Activity logging per org
- [ ] Tests verify data isolation
- [ ] Cascade deletes configured
- [ ] Soft delete for organizations

---

## �� Reference

This pattern is used by:

- **Consultify** (this project)
- Slack
- GitHub
- Notion
- Linear
- Most B2B SaaS

**Start simple, add complexity as needed!**

---

**Use this pattern**: Every time you build a B2B SaaS with teams/workspaces.
