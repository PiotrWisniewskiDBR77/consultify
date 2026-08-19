import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { v8Post } from '@/services/api/v8/client';
import PartnerProgramConfig from '@/views/superadmin/partners/PartnerProgramConfig';

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));
vi.mock('@/services/api/v8/client', () => ({ v8Post: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : fallback?.defaultValue || key,
  }),
}));

const application = {
  id: 'application-1',
  full_name: 'Applicant One',
  email: 'applicant@example.test',
  company: 'Applicant Company',
  status: 'pending',
};
const certification = {
  id: 'certification-1',
  partner_name: 'Partner One',
  certification_name: 'Advanced Delivery',
  certification_track: 'delivery',
  certification_level: 'advanced',
  review_state: 'pending',
  progress_percent: 100,
};

function configureReads() {
  vi.mocked(Api.get).mockImplementation(async (url: string) => {
    if (url.endsWith('/commission-rates')) return { success: true, data: [] } as any;
    if (url.endsWith('/discount'))
      return {
        success: true,
        data: { discountType: 'PERCENTAGE', discountValue: 0, durationMonths: 12, isActive: false },
      } as any;
    if (url.endsWith('/payout-settings'))
      return {
        success: true,
        data: {
          minimumThreshold: 100,
          payoutSchedule: 'MONTHLY',
          processingFeePercent: 0,
          autoPayoutEnabled: false,
          paymentMethods: ['BANK_TRANSFER'],
        },
      } as any;
    if (url.endsWith('/review-queue')) return { success: true, data: [certification] } as any;
    if (url.endsWith('/applications')) return { success: true, data: [application] } as any;
    if (url.endsWith('/reporting')) return { success: true, data: {} } as any;
    throw new Error(`Unexpected GET ${url}`);
  });
}

describe('PartnerProgramConfig operator review cutover', () => {
  beforeEach(() => {
    configureReads();
    vi.mocked(v8Post).mockResolvedValue({} as any);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it('uses exact V8 application and certification commands with Idempotency-Key by default', async () => {
    render(<PartnerProgramConfig />);
    const approve = await screen.findAllByRole('button', { name: 'Approve' });
    fireEvent.click(approve[0]);
    await waitFor(() =>
      expect(v8Post).toHaveBeenCalledWith(
        '/admin/partners/applications/application-1/review',
        { status: 'approved' },
        { extraHeaders: { 'Idempotency-Key': expect.stringContaining('application-1') } }
      )
    );

    fireEvent.click((await screen.findAllByRole('button', { name: 'Approve' }))[1]);
    await waitFor(() =>
      expect(v8Post).toHaveBeenCalledWith(
        '/admin/partners/certifications/certification-1/review',
        { reviewState: 'approved' },
        { extraHeaders: { 'Idempotency-Key': expect.stringContaining('certification-1') } }
      )
    );
    expect(Api.post).not.toHaveBeenCalled();
  });

  it('preselects legacy only when rollback is enabled before the request', async () => {
    vi.stubEnv('VITE_PARTNER_LEGACY_ROLLBACK_ENABLED', 'true');
    vi.mocked(Api.post).mockResolvedValue({ success: true } as any);
    render(<PartnerProgramConfig />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Approve' }))[0]);
    await waitFor(() =>
      expect(Api.post).toHaveBeenCalledWith(
        '/api/superadmin/partner-config/applications/application-1/review',
        { status: 'approved' }
      )
    );
    expect(v8Post).not.toHaveBeenCalled();
  });

  it('keeps a V8 failure visible and never falls back to legacy', async () => {
    vi.mocked(v8Post).mockRejectedValue(new Error('v8 unavailable'));
    render(<PartnerProgramConfig />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Approve' }))[0]);
    await waitFor(() => expect(v8Post).toHaveBeenCalledOnce());
    expect(Api.post).not.toHaveBeenCalled();
  });
});
