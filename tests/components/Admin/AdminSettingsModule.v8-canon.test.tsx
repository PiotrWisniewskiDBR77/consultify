/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminSettingsModule from '../../../src/views/admin/AdminSettingsModule';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  setCurrentView: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/admin', search: '' }),
  useNavigate: () => h.navigate,
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({ setCurrentView: h.setCurrentView }),
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    getFeedback: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../src/components/Admin/AdminInitiativeSectionTypesPanel', () => ({
  AdminInitiativeSectionTypesPanel: () => <div>AdminInitiativeSectionTypesPanel</div>,
}));
vi.mock('../../../src/components/Admin/AdminInitiativeTemplatesPanel', () => ({
  AdminInitiativeTemplatesPanel: () => <div>AdminInitiativeTemplatesPanel</div>,
}));
vi.mock('../../../src/components/Admin/AdminSettingsSidebar', () => ({
  AdminSettingsSidebar: () => <div>AdminSettingsSidebar</div>,
}));
vi.mock('../../../src/components/Admin/AuditExportPanel', () => ({
  AuditExportPanel: () => <div>AuditExportPanel</div>,
}));
vi.mock('../../../src/components/Admin/BrandingSettingsPanel', () => ({
  BrandingSettingsPanel: () => <div>BrandingSettingsPanel</div>,
}));
vi.mock('../../../src/components/Admin/DataGovernancePanel', () => ({
  DataGovernancePanel: () => <div>DataGovernancePanel</div>,
}));
vi.mock('../../../src/components/Admin/IntegrationsManagementPanel', () => ({
  IntegrationsManagementPanel: () => <div>IntegrationsManagementPanel</div>,
}));
vi.mock('../../../src/components/Admin/UnifiedSyncHub', () => ({
  UnifiedSyncHub: () => <div>UnifiedSyncHub</div>,
}));
vi.mock('../../../src/components/billing/PaymentMethodsPanel', () => ({
  PaymentMethodsPanel: () => <div>PaymentMethodsPanel</div>,
}));
vi.mock('../../../src/components/billing/SubscriptionManager', () => ({
  SubscriptionManager: () => <div>SubscriptionManager</div>,
}));
vi.mock('../../../src/components/billing/TaxSettingsForm', () => ({
  TaxSettingsForm: () => <div>TaxSettingsForm</div>,
}));
vi.mock('../../../src/components/billing/UsageAlertsConfig', () => ({
  UsageAlertsConfig: () => <div>UsageAlertsConfig</div>,
}));
vi.mock('../../../src/components/ReportBuilder/BlockTypesManager', () => ({
  BlockTypesManager: () => <div>BlockTypesManager</div>,
}));
vi.mock('../../../src/components/ReportBuilder/TemplatesManager', () => ({
  TemplatesManager: () => <div>TemplatesManager</div>,
}));
vi.mock('../../../src/components/settings/OrganizationProfileForm', () => ({
  OrganizationProfileForm: () => <div>OrganizationProfileForm</div>,
}));
vi.mock('../../../src/components/settings/SecuritySettings', () => ({
  SecuritySettings: () => <div>SecuritySettings</div>,
}));
vi.mock('../../../src/components/ui/primitives/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock('../../../src/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../../src/views/admin/ApiKeysManagementView', () => ({
  ApiKeysManagementView: () => <div>ApiKeysManagementView</div>,
}));

describe('AdminSettingsModule v8 canon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the canonical tenant operator cockpit above admin content', async () => {
    render(
      <AdminSettingsModule currentUser={{ id: 'user-1', email: 'user@example.com' } as any} />
    );

    expect(await screen.findByText('Team & Access')).toBeInTheDocument();
    expect(screen.getByText(/Membership operations/)).toBeInTheDocument();
    expect(screen.getByText('AdminSettingsSidebar')).toBeInTheDocument();
  });
});
