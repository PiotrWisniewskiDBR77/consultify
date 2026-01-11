/**
 * Backend API Tests - Resource Management
 * Test subscription plans CRUD, organization resources, and budget endpoints
 */

import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3001';
let superAdminToken: string;
let testOrgId: string;
let testPlanId: string;

describe('Resource Management API Tests', () => {
  beforeAll(async () => {
    // Get SuperAdmin token (assumes test auth setup)
    const authResponse = await request(API_URL)
      .post('/api/auth/login')
      .send({ email: 'superadmin@test.com', password: 'test123' });

    superAdminToken = authResponse.body.token;

    // Create test organization
    const orgResponse = await request(API_URL)
      .post('/api/superadmin/organizations')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: 'Test Org for Resource Tests' });

    testOrgId = orgResponse.body.organization.id;
  });

  describe('Subscription Plans CRUD', () => {
    it('should create a new subscription plan', async () => {
      const response = await request(API_URL)
        .post('/api/superadmin/subscription-plans')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Test Plan',
          priceMonthly: 29.99,
          tokenLimit: 100000,
          storageLimitGb: 10,
          memoryLimitMb: 1024,
          cpuQuotaPercent: 30,
          maxConcurrentAiJobs: 5,
          tokenOverageRate: 0.01,
          storageOverageRate: 0.1,
          stripePriceId: 'price_test_123',
        });

      expect(response.status).toBe(201);
      expect(response.body.plan).toBeDefined();
      expect(response.body.plan.name).toBe('Test Plan');
      expect(response.body.plan.memory_limit_mb).toBe(1024);

      testPlanId = response.body.plan.id;
    });

    it('should get all subscription plans', async () => {
      const response = await request(API_URL)
        .get('/api/superadmin/subscription-plans')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.plans).toBeInstanceOf(Array);
      expect(response.body.plans.length).toBeGreaterThan(0);
    });

    it('should update a subscription plan', async () => {
      const response = await request(API_URL)
        .put(`/api/superadmin/subscription-plans/${testPlanId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ priceMonthly: 39.99, cpuQuotaPercent: 50 });

      expect(response.status).toBe(200);
      expect(response.body.plan.price_monthly).toBe(39.99);
      expect(response.body.plan.cpu_quota_percent).toBe(50);
    });

    it('should delete a subscription plan', async () => {
      const response = await request(API_URL)
        .delete(`/api/superadmin/subscription-plans/${testPlanId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');
    });

    it('should reject plan creation without auth', async () => {
      const response = await request(API_URL)
        .post('/api/superadmin/subscription-plans')
        .send({ name: 'Unauthorized Plan', priceMonthly: 10 });

      expect(response.status).toBe(401);
    });
  });

  describe('Organization Resource Management', () => {
    it('should get organization resources', async () => {
      const response = await request(API_URL)
        .get(`/api/superadmin/organizations/${testOrgId}/resources`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.organization).toBeDefined();
      expect(response.body.budget).toBeDefined();
    });

    it('should update organization budget', async () => {
      const response = await request(API_URL)
        .put(`/api/superadmin/organizations/${testOrgId}/budget`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ monthlyBudgetUsd: 1000, alertThreshold: 0.8 });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('updated');
    });

    it('should update organization quotas', async () => {
      const response = await request(API_URL)
        .put(`/api/superadmin/organizations/${testOrgId}/quotas`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ memoryLimitMb: 2048, cpuQuotaPercent: 60, tokenBalance: 50000 });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('updated');
    });

    it('should charge for resource change', async () => {
      const response = await request(API_URL)
        .post(`/api/superadmin/organizations/${testOrgId}/charge-resource-change`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          changeType: 'memory_increase',
          oldValue: 1024,
          newValue: 2048,
          chargeAmount: 50,
          description: 'Memory upgrade',
        });

      expect(response.status).toBe(201);
      expect(response.body.expense).toBeDefined();
      expect(response.body.expense.amount).toBe(50);
    });
  });

  describe('Budget Management (Admin)', () => {
    let adminToken: string;

    beforeAll(async () => {
      // Get admin token
      const authResponse = await request(API_URL)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'test123' });

      adminToken = authResponse.body.token;
    });

    it('should get budget status', async () => {
      const response = await request(API_URL)
        .get('/api/admin/budget')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.budget).toBeDefined();
      expect(response.body.budget.monthlyBudget).toBeDefined();
    });

    it('should get expense history', async () => {
      const response = await request(API_URL)
        .get('/api/admin/budget/expenses')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.expenses).toBeInstanceOf(Array);
    });

    it('should filter expenses by category', async () => {
      const response = await request(API_URL)
        .get('/api/admin/budget/expenses?category=TOKENS')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.expenses).toBeInstanceOf(Array);
    });
  });

  describe('Authorization Tests', () => {
    let regularUserToken: string;

    beforeAll(async () => {
      const authResponse = await request(API_URL)
        .post('/api/auth/login')
        .send({ email: 'user@test.com', password: 'test123' });

      regularUserToken = authResponse.body.token;
    });

    it('should reject regular user accessing SuperAdmin endpoints', async () => {
      const response = await request(API_URL)
        .get('/api/superadmin/subscription-plans')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response.status).toBe(403);
    });

    it('should reject admin accessing other org resources', async () => {
      const response = await request(API_URL)
        .get(`/api/superadmin/organizations/${testOrgId}/resources`)
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response.status).toBe(403);
    });
  });

  afterAll(async () => {
    // Cleanup: delete test organization
    await request(API_URL)
      .delete(`/api/superadmin/organizations/${testOrgId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);
  });
});
