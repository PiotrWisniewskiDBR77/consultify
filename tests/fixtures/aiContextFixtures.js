/**
 * AI Context Fixtures for Backend Testing
 * Standardized mock data for AI-related tests
 */

export const mockOrganizationContext = {
  id: 'test-org-123',
  name: 'Test Enterprise Corp',
  industry: 'Manufacturing',
  size: '1000-5000',
  description: 'A leading manufacturer of automotive parts looking to digitize their value stream.',
  maturity_level: 3,
  digital_strategy: 'Full cloud migration by 2026',
  preferences: {
    ai_tone: 'executive',
    report_detail_level: 'high',
  },
};

export const mockProjectContext = {
  id: 'test-project-456',
  name: 'Digital Twin Initiative',
  description: 'Implementation of a digital twin for the main assembly line in Poznan.',
  goals: ['Reduce downtime by 15%', 'Improve OEE from 65% to 75%', 'Standardize data collection'],
  targetLevels: {
    processes: 5,
    culture: 4,
    infrastructure: 5,
  },
  workstreams: [
    { name: 'Data Engineering', status: 'active' },
    { name: 'Change Management', status: 'pending' },
  ],
};

export const mockUserInteraction = {
  userId: 'user-789',
  role: 'MANAGER',
  lastAction: 'generate_report',
  conversationHistory: [
    { role: 'user', content: 'What are the main gaps in our lean process?' },
    {
      role: 'assistant',
      content:
        'Based on your recent assessment, your Value Stream Mapping shows 20% high-waste steps.',
    },
  ],
};

export const mockAIResponse = {
  analysis: 'The organization shows high technical readiness but low cultural adaptability.',
  recommendations: [
    {
      dimension: 'Waste Elimination',
      priority: 'HIGH',
      recommendation: 'Implement automated 5S monitoring using vision AI.',
      impact: 'Significant reduction in search time for tools.',
    },
  ],
  riskLevel: 'LOW',
  confidenceScore: 0.92,
};
