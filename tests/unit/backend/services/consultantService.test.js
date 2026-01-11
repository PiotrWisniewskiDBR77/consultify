/**
 * Consultant Service Tests - Mock-Based Unit Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const createConsultantService = () => {
  const consultants = new Map();
  const engagements = [];

  return {
    // Register consultant
    register: async (data) => {
      if (!data.email) return { success: false, error: 'Email required', status: 400 };
      const id = `cons-${Date.now()}`;
      consultants.set(id, { id, ...data, status: 'active' });
      return { success: true, data: { id }, status: 201 };
    },

    // Get consultant profile
    getProfile: async (consultantId) => {
      const consultant = consultants.get(consultantId);
      if (!consultant) return { success: false, error: 'Not found', status: 404 };
      return { success: true, data: consultant, status: 200 };
    },

    // Create engagement
    createEngagement: async (consultantId, clientId, scope) => {
      if (!consultants.has(consultantId))
        return { success: false, error: 'Consultant not found', status: 404 };
      const engagement = {
        id: `eng-${Date.now()}`,
        consultantId,
        clientId,
        scope,
        status: 'active',
      };
      engagements.push(engagement);
      return { success: true, data: engagement, status: 201 };
    },

    // Get engagements
    getEngagements: async (consultantId) => {
      return {
        success: true,
        data: engagements.filter((e) => e.consultantId === consultantId),
        status: 200,
      };
    },
  };
};

describe('ConsultantService', () => {
  let consultantService;

  beforeEach(() => {
    vi.clearAllMocks();
    consultantService = createConsultantService();
  });

  it('should register consultant', async () => {
    const result = await consultantService.register({ email: 'cons@test.com', name: 'Test' });
    expect(result.success).toBe(true);
    expect(result.status).toBe(201);
  });

  it('should get consultant profile', async () => {
    const created = await consultantService.register({ email: 'cons@test.com' });
    const result = await consultantService.getProfile(created.data.id);
    expect(result.success).toBe(true);
  });

  it('should create engagement', async () => {
    const created = await consultantService.register({ email: 'cons@test.com' });
    const result = await consultantService.createEngagement(
      created.data.id,
      'client-1',
      'Strategy'
    );
    expect(result.success).toBe(true);
  });

  it('should get consultant engagements', async () => {
    const created = await consultantService.register({ email: 'cons@test.com' });
    await consultantService.createEngagement(created.data.id, 'client-1', 'Strategy');
    const result = await consultantService.getEngagements(created.data.id);
    expect(result.data).toHaveLength(1);
  });
});
