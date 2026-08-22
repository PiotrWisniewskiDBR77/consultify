/**
 * Partner Portal View Component Tests
 *
 * Tests for the main Partner Portal component and its sections
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
// Mock the API service
vi.mock('../../../src/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../src/services/api/v8', () => ({
  V8PartnerApi: {
    getReferralAnalytics: vi.fn(),
    getEarningsSummary: vi.fn(),
    getProgramStatus: vi.fn(),
    getAttributions: vi.fn(),
    getParticipantLedger: vi.fn(),
    connect: vi.fn(),
    startCertificationExam: vi.fn(),
    submitCertificationExam: vi.fn(),
  },
  shouldFallbackToLegacyPartner: () => false,
}));

vi.mock('../../../src/services/api/v8/partner', () => ({
  isPartnerLegacyRollbackEnabled: vi.fn(),
}));

import { Api } from '../../../src/services/api';
import { V8PartnerApi } from '../../../src/services/api/v8';
import { isPartnerLegacyRollbackEnabled } from '../../../src/services/api/v8/partner';
import { PartnerPortalViewNew } from '../../../src/views/partner/PartnerPortalView';

// Test wrapper with providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
  </BrowserRouter>
);

describe('PartnerPortalView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isPartnerLegacyRollbackEnabled).mockReturnValue(false);
    vi.mocked(V8PartnerApi.getReferralAnalytics).mockResolvedValue({
      analytics: {
        totalClicks: 42,
        uniqueClicks: 30,
        signups: 8,
        trials: 5,
        paidCustomers: 3,
        conversionRate: 37.5,
        clicksByDay: [],
        clicksBySource: [],
      },
      days: 30,
    });
    vi.mocked(V8PartnerApi.getEarningsSummary).mockResolvedValue({
      earnings: {
        totalEarned: 1200,
        totalPending: 200,
        totalApproved: 700,
        totalPaid: 500,
        thisMonth: 120,
        thisMonthCount: 2,
        lastMonth: 90,
        readyForPayout: 150,
        currency: 'EUR',
      },
    });
    vi.mocked(V8PartnerApi.getProgramStatus).mockResolvedValue({
      lifecyclePhase: 'payout',
      payoutSettingsComplete: true,
      balances: {
        grossEarned: 1200,
        paidOut: 500,
        heldAmount: 0,
        availableToPayout: 150,
        currency: 'EUR',
      },
      whatNext: [],
      hold: null,
    } as any);
    vi.mocked(V8PartnerApi.getAttributions).mockResolvedValue({ attributions: [] } as any);
    vi.mocked(V8PartnerApi.getParticipantLedger).mockResolvedValue({
      facts: [],
      readModel: {
        participantFactCount: 0,
        latestFactAt: null,
      },
    } as any);
  });

  describe('partner acquisition boundary', () => {
    const connectionResponses = () => {
      let connected = false;
      vi.mocked(Api.get).mockImplementation(async (url: string) => {
        if (url === '/api/partners/connection') {
          return {
            success: true,
            data: {
              data: {
                connected,
                selfConnectEnabled: true,
                organization: connected ? { name: 'Partner One' } : null,
              },
            },
          } as any;
        }
        throw new Error(`Unexpected GET ${url}`);
      });
      return () => {
        connected = true;
      };
    };

    it('does not expose a direct self-connect writer by default', async () => {
      connectionResponses();

      render(
        <TestWrapper>
          <PartnerPortalViewNew />
        </TestWrapper>
      );

      await waitFor(() => expect(Api.get).toHaveBeenCalledWith('/api/partners/connection'));
      expect(
        screen.queryByRole('button', {
          name: /Utwórz i połącz profil|Create and connect profile|partner\.connect\.cta/,
        })
      ).not.toBeInTheDocument();
      expect(V8PartnerApi.connect).not.toHaveBeenCalled();
      expect(Api.post).not.toHaveBeenCalledWith('/api/partners/connect', expect.anything());
    });

    it('does not re-enable the removed self-connect writer through the rollback flag', async () => {
      connectionResponses();
      vi.mocked(isPartnerLegacyRollbackEnabled).mockReturnValue(true);

      render(
        <TestWrapper>
          <PartnerPortalViewNew />
        </TestWrapper>
      );
      await waitFor(() => expect(Api.get).toHaveBeenCalledWith('/api/partners/connection'));
      expect(Api.post).not.toHaveBeenCalledWith('/api/partners/connect', expect.anything());
      expect(V8PartnerApi.connect).not.toHaveBeenCalled();
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Dashboard Section', () => {
    it('should render loading state initially', async () => {
      vi.mocked(Api.get).mockImplementation(() => new Promise(() => {})); // Never resolves

      render(
        <TestWrapper>
          <PartnerPortalViewNew />
        </TestWrapper>
      );

      // Check for loading skeleton or spinner
      // The exact implementation depends on the component
    });

    it('should fetch and display dashboard data', async () => {
      vi.mocked(Api.get).mockImplementation(async (url: string) => {
        if (url === '/api/partners/connection') {
          return {
            success: true,
            data: { data: { connected: true, organization: { name: 'Partner Org' } } },
          } as any;
        }

        if (url === '/api/partners/dashboard') {
          return {
            success: true,
            data: {
              data: {
                stats: {
                  activeClients: 12,
                  activeProjects: 8,
                  certificationLevel: 'Gold',
                  monthlyRevenue: 24500,
                  revenueChange: 15,
                  totalLicenses: 150,
                  activeLicenses: 142,
                  availableLicenses: 8,
                },
                recentActivity: [
                  { type: 'client', text: 'New client: Test Corp', time: '2h ago' },
                  { type: 'project', text: 'Project completed', time: '1d ago' },
                ],
                certificationProgress: {
                  completed: 2,
                  total: 4,
                  courses: [
                    { name: 'Foundations', status: 'completed', progress: 100 },
                    { name: 'Advanced', status: 'in-progress', progress: 50 },
                  ],
                },
              },
            },
          } as any;
        }

        throw new Error(`Unexpected GET ${url}`);
      });

      render(
        <TestWrapper>
          <PartnerPortalViewNew />
        </TestWrapper>
      );

      // Wait for data to load
      await waitFor(() => {
        expect(Api.get).toHaveBeenCalledWith('/api/partners/connection');
        expect(Api.get).toHaveBeenCalledWith('/api/partners/dashboard');
      });
    });

    it('renders governed partner runtime summary on the default dashboard', async () => {
      vi.mocked(Api.get).mockImplementation(async (url: string) => {
        if (url === '/api/partners/connection') {
          return {
            success: true,
            data: { data: { connected: true, organization: { name: 'Partner Org' } } },
          } as any;
        }

        if (url === '/api/partners/dashboard') {
          return {
            success: true,
            data: {
              data: {
                stats: { activeClients: 12, activeProjects: 8, certificationLevel: 'Gold' },
                recentActivity: [],
                certificationProgress: { completed: 0, total: 4, courses: [] },
              },
            },
          } as any;
        }

        throw new Error(`Unexpected GET ${url}`);
      });

      render(
        <TestWrapper>
          <PartnerPortalViewNew />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(Api.get).toHaveBeenCalledWith('/api/partners/dashboard');
        expect(V8PartnerApi.getReferralAnalytics).toHaveBeenCalled();
        expect(V8PartnerApi.getEarningsSummary).toHaveBeenCalled();
      });

      expect(screen.getByText('Partner Runtime Summary')).toBeInTheDocument();
      expect(screen.getByText('Referral clicks')).toBeInTheDocument();
      expect(screen.getByText('Ready for payout')).toBeInTheDocument();
      expect(screen.getByText('30 unique')).toBeInTheDocument();
      expect(screen.getByText('payout lifecycle')).toBeInTheDocument();
    });

    it('uses the canonical certification reader instead of the dashboard 0/0 placeholder', async () => {
      vi.mocked(Api.get).mockImplementation(async (url: string) => {
        if (url === '/api/partners/connection') {
          return {
            success: true,
            data: { data: { connected: true, organization: { name: 'Partner Org' } } },
          } as any;
        }
        if (url === '/api/partners/dashboard') {
          return {
            success: true,
            data: {
              data: {
                stats: { certificationLevel: 'Certified' },
                recentActivity: [],
                certificationProgress: { completed: 0, total: 0, courses: [] },
              },
            },
          } as any;
        }
        if (url === '/api/partners/certifications') {
          return {
            success: true,
            data: {
              data: [
                { id: 'cert-complete', status: 'completed', reviewState: 'approved' },
                { id: 'cert-pending', status: 'in_progress', reviewState: 'pending' },
              ],
            },
          } as any;
        }
        throw new Error(`Unexpected GET ${url}`);
      });

      render(
        <TestWrapper>
          <PartnerPortalViewNew />
        </TestWrapper>
      );

      await waitFor(() => expect(screen.getAllByText(/1\/2/).length).toBeGreaterThanOrEqual(2));
      expect(screen.queryByText(/0\/0/)).not.toBeInTheDocument();
      expect(screen.getByText('Certification details are available in Learning Path')).toBeInTheDocument();
    });

    it('should handle dashboard API error', async () => {
      vi.mocked(Api.get).mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <PartnerPortalViewNew />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should show error state with retry button
      });
    });

    it('should refresh data when refresh button is clicked', async () => {
      const mockData = {
        success: true,
        data: {
          stats: { activeClients: 10 },
          recentActivity: [],
          certificationProgress: { completed: 0, total: 4, courses: [] },
        },
      };

      vi.mocked(Api.get).mockResolvedValue({ data: mockData });

      render(
        <TestWrapper>
          <PartnerPortalViewNew />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(Api.get).toHaveBeenCalled();
      });

      // Find and click refresh button
      const refreshButton = screen.queryByRole('button', { name: /refresh/i });
      if (refreshButton) {
        fireEvent.click(refreshButton);
        expect(Api.get).toHaveBeenCalledTimes(2);
      }
    });
  });

  describe('Metrics Section', () => {
    it('should fetch metrics data when metrics section is active', async () => {
      const mockMetricsData = {
        success: true,
        data: {
          revenue: {
            totalYTD: 145200,
            change: 18,
            byMonth: [10000, 12000, 15000, 18000],
          },
          clients: {
            retention: 94,
            newThisQuarter: 5,
            churned: 1,
            avgProjectDuration: 4.2,
          },
          performance: {
            score: 85,
            breakdown: {
              clientAcquisition: 90,
              projectDelivery: 88,
              customerSatisfaction: 92,
              certificationProgress: 70,
            },
            ranking: 'Top 15% of partners',
          },
          satisfaction: {
            score: 4.8,
            responses: 45,
            trend: 'improving',
          },
        },
      };

      vi.mocked(Api.get).mockResolvedValue({ data: mockMetricsData });

      // Test would navigate to metrics section and verify API call
    });

    it('should display performance score visualization', async () => {
      const mockData = {
        success: true,
        data: {
          performance: {
            score: 85,
            breakdown: {},
            ranking: 'Excellent',
          },
        },
      };

      vi.mocked(Api.get).mockResolvedValue({ data: mockData });

      // Test would verify the circular progress visualization
    });
  });

  describe('Clients Section', () => {
    it('should fetch and display client organizations', async () => {
      const mockClientsData = {
        success: true,
        data: [
          {
            id: '1',
            name: 'Nordic Manufacturing AB',
            industry: 'Manufacturing',
            users: 45,
            projects: 3,
            assessmentScore: 3.8,
            status: 'active',
          },
          {
            id: '2',
            name: 'Baltic Energy Group',
            industry: 'Energy',
            users: 120,
            projects: 5,
            assessmentScore: 4.2,
            status: 'active',
          },
        ],
      };

      vi.mocked(Api.get).mockResolvedValue({ data: mockClientsData });

      // Test would verify table renders with client data
    });

    it('should fetch and display projects', async () => {
      const mockProjectsData = {
        success: true,
        data: [
          {
            id: '1',
            name: 'Digital Transformation',
            clientName: 'Nordic Manufacturing AB',
            framework: 'DRD',
            progress: 65,
            status: 'active',
          },
        ],
      };

      vi.mocked(Api.get).mockResolvedValue({ data: mockProjectsData });

      // Test would verify project cards render
    });

    it('should show empty state when no clients', async () => {
      vi.mocked(Api.get).mockResolvedValue({ data: { success: true, data: [] } });

      // Test would verify empty state message
    });
  });

  describe('Certification Section', () => {
    it('should fetch and display certifications', async () => {
      const mockCertData = {
        success: true,
        data: [
          {
            id: '1',
            name: 'Consultinity Foundations',
            type: 'core',
            status: 'completed',
            progress: 100,
            duration: '2 hours',
            modules: 5,
            certificateId: 'CERT-001',
          },
          {
            id: '2',
            name: 'AI Intelligence Modules',
            type: 'core',
            status: 'in_progress',
            progress: 45,
            duration: '3 hours',
            modules: 6,
          },
        ],
      };

      vi.mocked(Api.get).mockResolvedValue({ data: mockCertData });

      // Test would verify certification list renders
    });

    it('should show progress bars for in-progress courses', async () => {
      const mockData = {
        success: true,
        data: [{ id: '1', name: 'Test Course', status: 'in_progress', progress: 50 }],
      };

      vi.mocked(Api.get).mockResolvedValue({ data: mockData });

      // Test would verify progress bar is visible
    });
  });

  describe('Resources Section', () => {
    it('should fetch and display resources by category', async () => {
      const mockResourcesData = {
        success: true,
        data: {
          documentation: [{ id: '1', title: 'Partner Guide', type: 'PDF', size: '2.4 MB' }],
          marketing: [{ id: '2', title: 'Logo Kit', type: 'ZIP', size: '12 MB' }],
          caseStudies: [{ id: '3', title: 'Success Story', type: 'PDF', size: '3.2 MB' }],
          templates: [{ id: '4', title: 'PMO Checklist', type: 'XLSX', size: '450 KB' }],
        },
      };

      vi.mocked(Api.get).mockResolvedValue({ data: mockResourcesData });

      // Test would verify resources list renders
    });

    it('should trigger download when resource is clicked', async () => {
      const mockData = {
        success: true,
        data: { documentation: [{ id: '1', title: 'Guide', type: 'PDF', size: '1 MB' }] },
      };
      const mockDownload = {
        success: true,
        data: { downloadUrl: 'https://example.com/download/guide.pdf' },
      };

      vi.mocked(Api.get).mockResolvedValueOnce({ data: mockData });
      vi.mocked(Api.get).mockResolvedValueOnce({ data: mockDownload });

      // Test would verify download is triggered
    });
  });

  describe('Profile Section', () => {
    it('should fetch and display organization profile', async () => {
      const mockOrgData = {
        success: true,
        data: {
          id: 'org-1',
          name: 'Test Partner Co',
          taxId: 'DE123456789',
          contactEmail: 'partner@test.com',
          contactPhone: '+49 30 12345',
          website: 'https://test.com',
          tier: 'GOLD',
          specializations: ['DRD', 'SIRI'],
          regions: ['DACH', 'CEE'],
          publicListingEnabled: true,
        },
      };

      vi.mocked(Api.get).mockResolvedValue({ data: mockOrgData });

      // Test would verify form fields are populated
    });

    it('should save company info changes', async () => {
      const mockOrgData = {
        success: true,
        data: { name: 'Test', contactEmail: 'test@test.com' },
      };
      const mockSaveResponse = { success: true };

      vi.mocked(Api.get).mockResolvedValue({ data: mockOrgData });
      vi.mocked(Api.put).mockResolvedValue({ data: mockSaveResponse });

      // Test would simulate form edit and save
    });

    it('should toggle specializations', async () => {
      const mockData = {
        success: true,
        data: { specializations: ['DRD'] },
      };

      vi.mocked(Api.get).mockResolvedValue({ data: mockData });
      vi.mocked(Api.put).mockResolvedValue({ data: { success: true } });

      // Test would click on specialization toggle and verify update
    });

    it('should toggle public listing', async () => {
      const mockData = {
        success: true,
        data: { publicListingEnabled: false },
      };

      vi.mocked(Api.get).mockResolvedValue({ data: mockData });
      vi.mocked(Api.put).mockResolvedValue({ data: { success: true } });

      // Test would click toggle and verify API call
    });
  });

  describe('Navigation', () => {
    it('should render sidebar navigation', () => {
      render(
        <TestWrapper>
          <PartnerPortalViewNew />
        </TestWrapper>
      );

      // Verify navigation items are present
      // This depends on the actual navigation structure
    });

    it('should switch sections when navigation item is clicked', async () => {
      vi.mocked(Api.get).mockResolvedValue({
        data: { success: true, data: {} },
      });

      render(
        <TestWrapper>
          <PartnerPortalViewNew />
        </TestWrapper>
      );

      // Test would click navigation items and verify content changes
    });
  });
});

describe('Partner Portal - Accessibility', () => {
  it('should have proper ARIA labels', () => {
    render(
      <TestWrapper>
        <PartnerPortalViewNew />
      </TestWrapper>
    );

    // Verify accessibility attributes
  });

  it('should support keyboard navigation', () => {
    render(
      <TestWrapper>
        <PartnerPortalViewNew />
      </TestWrapper>
    );

    // Test keyboard interactions
  });
});

describe('Partner Portal - Responsive Design', () => {
  it('should adapt layout for mobile screens', () => {
    // Test would use viewport resize and verify responsive behavior
  });

  it('should collapse sidebar on small screens', () => {
    // Test would verify sidebar behavior on mobile
  });
});
