import { v4 as uuidv4 } from 'uuid';
import { DbPromise } from '../../server/src/utils/DbPromise.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../server/src/config/Config.js';

/**
 * Standard Test Data Factory.
 * Encapsulates logic for creating Organizations, Users, and Auth tokens
 * to prevent flaky tests and raw SQL injection in test files.
 */
export class TestFactory {
  // Keep track of created IDs for cleanup (optional, depends on architecture)
  private createdOrgIds: string[] = [];
  private createdUserIds: string[] = [];

  /**
   * Creates a standard test organization.
   */
  async createOrganization(overrides: { id?: string; name?: string; plan?: string } = {}) {
    const id = overrides.id || uuidv4();
    const name = overrides.name || `Test Org ${id}`;
    const plan = overrides.plan || 'free';

    // Use the unified DB interface
    await DbPromise.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
      id,
      name,
      plan,
      'active',
    ]);

    this.createdOrgIds.push(id);
    return { id, name, plan };
  }

  /**
   * Creates a test user attached to an organization.
   */
  async createUser(overrides: {
    id?: string;
    organizationId: string;
    email?: string;
    role?: string;
    password?: string;
  }) {
    const id = overrides.id || uuidv4();
    const email = overrides.email || `test-${id}@example.com`;
    const role = overrides.role || 'ADMIN';
    const passwordPlain = overrides.password || 'password123';
    const hash = await bcrypt.hash(passwordPlain, 8);

    await DbPromise.run(
      'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
      [id, overrides.organizationId, email, hash, 'TestUser', role]
    );

    const count = await DbPromise.get<{ c: number }>('SELECT count(*) as c FROM users');
    console.log('[TestFactory] User created. Total users:', JSON.stringify(count));

    this.createdUserIds.push(id);
    return { id, email, role, password: passwordPlain };
  }

  /**
   * Generates a valid JWT token for a user.
   * Uses the same secret as the application.
   */
  generateToken(user: { id: string; email: string; role: string; organizationId: string }) {
    const secret = config.JWT_SECRET;
    return jwt.sign(
      {
        id: user.id,
        userId: user.id, // Legacy support
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
      secret,
      { expiresIn: '1h' }
    );
  }

  /**
   * Creates a test project.
   */
  async createProject(overrides: {
    id?: string;
    organizationId: string;
    name?: string;
    status?: string;
  }) {
    const id = overrides.id || uuidv4();
    const name = overrides.name || `Test Project ${id}`;
    const status = overrides.status || 'active';

    await DbPromise.run(
      'INSERT INTO projects (id, organization_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))',
      [id, overrides.organizationId, name, status]
    );

    return { id, organizationId: overrides.organizationId, name, status };
  }

  /**
   * Helper to setup a full context: Org + User + Token + Project
   */
  async createFullContext() {
    const org = await this.createOrganization();
    const user = await this.createUser({ organizationId: org.id });
    const token = this.generateToken({ ...user, organizationId: org.id });
    const project = await this.createProject({ organizationId: org.id });
    return { org, user, token, project };
  }
}

export const testFactory = new TestFactory();
