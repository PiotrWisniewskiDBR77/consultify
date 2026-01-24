import { v4 as uuidv4 } from 'uuid';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { TestDatabaseFactory } from '../../../../../tests/utils/TestDatabaseFactory.js';
import InitiativeServiceFacade from '../../../../src/services/initiativeService.js'; // The singleton export

describe('InitiativeService Facade Smoke Test', () => {
  let db: any;

  beforeAll(async () => {
    db = await TestDatabaseFactory.create();

    // Organizations & Users needed for constraints
    await db.runAsync(`CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT)`);
    await db.runAsync(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT)`);

    await db.runAsync(`INSERT INTO organizations (id, name) VALUES ('org1', 'Test Org')`);
    await db.runAsync(`INSERT INTO users (id, email) VALUES ('user1', 'test@example.com')`);

    // Initiatives schema (simplified for test)
    await db.runAsync(`DROP TABLE IF EXISTS initiatives`);
    await db.runAsync(`CREATE TABLE IF NOT EXISTS initiatives (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            org_id TEXT,
            project_id TEXT,
            title TEXT NOT NULL,
            axis TEXT,
            area TEXT,
            summary TEXT,
            hypothesis TEXT,
            status TEXT DEFAULT 'step3',
            current_stage TEXT,
            business_value TEXT,
            competencies_required TEXT,
            cost_capex REAL,
            cost_opex REAL,
            expected_roi REAL,
            social_impact TEXT,
            start_date DATETIME,
            end_date DATETIME,
            pilot_end_date DATETIME,
            due_date DATETIME,
            owner_business_id TEXT,
            owner_id TEXT,
            owner_execution_id TEXT,
            sponsor_id TEXT,
            market_context TEXT,
            progress REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

    // Tasks table for progress
    await db.runAsync(`DROP TABLE IF EXISTS tasks`);
    await db.runAsync(`CREATE TABLE IF NOT EXISTS tasks (
             id TEXT PRIMARY KEY,
             initiative_id TEXT,
             organization_id TEXT,
             title TEXT,
             progress REAL,
             priority TEXT
        )`);
  });

  beforeEach(() => {
    // Wrap db for Promise support if needed / or use TestDatabaseFactory enhanced db
    // Since TestDatabaseFactory returns an object with runAsync etc, but we might want standard run/get/all
    const dbWrapper = {
      ...db,
      run: db.runAsync.bind(db),
      get: db.getAsync.bind(db),
      all: db.allAsync.bind(db),
    };

    InitiativeServiceFacade.setDependencies({
      db: dbWrapper,
      uuidv4,
    });
  });

  it('should create an initiative', async () => {
    const data = {
      organization_id: 'org1',
      title: 'New Initiative',
      status: 'step3',
      cost_capex: 1000,
    };

    const result = await InitiativeServiceFacade.createInitiative(data);
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.title).toBe('New Initiative');
    expect(result.cost_capex).toBe(1000);
  });

  it('should get initiatives by org', async () => {
    const results = await InitiativeServiceFacade.getInitiatives('org1');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].organization_id).toBe('org1');
  });

  it('should recalculate progress based on tasks', async () => {
    const initData = {
      organization_id: 'org1',
      title: 'Progress Check',
      status: 'step3',
    };
    const initiative = await InitiativeServiceFacade.createInitiative(initData);
    const initId = initiative.id;

    // Add tasks
    // High priority (weight 1.5) with 100% progress = 150 points
    // Low priority (weight 0.5) with 0% progress = 0 points
    // Total weight = 2.0. Total points = 150. Result = 75%

    await db.runAsync(
      `INSERT INTO tasks (id, initiative_id, organization_id, title, progress, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      ['t1', initId, 'org1', 'Task 1', 100, 'high']
    );
    await db.runAsync(
      `INSERT INTO tasks (id, initiative_id, organization_id, title, progress, priority) VALUES (?, ?, ?, ?, ?, ?)`,
      ['t2', initId, 'org1', 'Task 2', 0, 'low']
    );

    const progress = await InitiativeServiceFacade.recalculateProgress({
      organizationId: 'org1',
      initiativeId: initId,
    });

    expect(progress).toBe(75);
  });
});
