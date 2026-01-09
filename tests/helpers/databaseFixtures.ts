/**
 * Database Fixtures Manager
 * Manages test database fixtures and test data
 */

import { initTestDb, cleanTables, createTestOrg, createTestUser } from './dbHelper.cjs';
import { UserFactory, OrganizationFactory, ProjectFactory } from '../fixtures/factories';

export class DatabaseFixtures {
  private static initialized = false;

  /**
   * Initialize test database
   */
  static async init(): Promise<void> {
    if (!this.initialized) {
      await initTestDb();
      this.initialized = true;
    }
  }

  /**
   * Clean all test tables
   */
  static async clean(): Promise<void> {
    await cleanTables([
      'users',
      'organizations',
      'projects',
      'tasks',
      'notifications',
      'activity_logs',
    ]);
  }

  /**
   * Create test organization with users
   */
  static async createOrganizationWithUsers(
    orgData?: Partial<OrganizationData>,
    userCount: number = 3
  ): Promise<{ org: OrganizationData; users: UserData[] }> {
    await this.init();

    const org = OrganizationFactory.create(orgData);
    await createTestOrg(org.id, org.name);

    const users = UserFactory.createMany(userCount, { organizationId: org.id });
    for (const user of users) {
      await createTestUser(user);
    }

    return { org, users };
  }

  /**
   * Create test project with organization
   */
  static async createProjectWithOrg(
    projectData?: Partial<ProjectData>
  ): Promise<{ project: ProjectData; org: OrganizationData }> {
    await this.init();

    const org = OrganizationFactory.create();
    await createTestOrg(org.id, org.name);

    const project = ProjectFactory.create({
      ...projectData,
      organizationId: org.id,
    });

    // Insert project into database
    const { dbRun } = await import('./dbHelper.cjs');
    await dbRun(
      'INSERT INTO projects (id, name, description, organization_id, status) VALUES (?, ?, ?, ?, ?)',
      [project.id, project.name, project.description, project.organizationId, project.status]
    );

    return { project, org };
  }

  /**
   * Reset database to clean state
   */
  static async reset(): Promise<void> {
    await this.clean();
    this.initialized = false;
  }
}

// Re-export types for convenience
export type { UserData } from '../fixtures/factories/userFactory';
export type { OrganizationData } from '../fixtures/factories/organizationFactory';
export type { ProjectData } from '../fixtures/factories/projectFactory';










