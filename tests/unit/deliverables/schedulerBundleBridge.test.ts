// @vitest-environment node
/**
 * Unit test — W6.1: scheduledReportService.executeSchedule bridges to M17 generator
 * when deliverableType === 'bundle'.
 *
 * Proves: brief is taken from schedule.description, generateBundle is called,
 * the ZIP is attached to the email, and execution.status = 'success'.
 *
 * Strategy: inject mocked generateBundle + exportBundleFiles + deliverViaEmail
 * via vi.mock, then inspect side effects.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockGenerateBundle = vi.fn();
const mockExportBundleFiles = vi.fn();
const mockBundleFilesToZip = vi.fn();
const mockSafeBundleBaseName = vi.fn();

vi.mock('../../../server/src/services/deliverables/bundleGenerationRuntime.js', () => ({
  generateBundle: (...a: any[]) => mockGenerateBundle(...a),
}));
vi.mock('../../../server/src/services/deliverables/bundleExportRuntime.js', () => ({
  exportBundleFiles: (...a: any[]) => mockExportBundleFiles(...a),
  bundleFilesToZip: (...a: any[]) => mockBundleFilesToZip(...a),
  safeBundleBaseName: (...a: any[]) => mockSafeBundleBaseName(...a),
}));

// Make DB stub async (used internally by executeSchedule)
const mockDb = {
  get: vi.fn(),
  run: vi.fn().mockResolvedValue(undefined),
  all: vi.fn().mockResolvedValue([]),
};

const SCHEDULE_ROW = {
  id: 'sched-1',
  organization_id: 'org-1',
  schedule_name: 'Materiał tygodniowy',
  description: 'Analiza gotowości na AI dla firmy Acme. Produkt SaaS B2B, rynek 5 mld EUR.',
  cron_expression: '0 8 * * 1',
  timezone: 'Europe/Warsaw',
  schedule_type: 'recurring',
  deliverable_type: 'bundle',
  scope_type: 'organization',
  scope_id: 'org-1',
  frequency: 'weekly',
  next_run_at: null,
  last_run_at: null,
  last_run_status: null,
  last_run_report_id: null,
  run_count: 0,
  // mapRowToSchedule reads deliveryMethods/deliveryConfig from config_json
  config_json: JSON.stringify({
    deliveryMethods: ['email'],
    deliveryConfig: { email: { recipients: ['test@example.com'], subject: 'Weekly bundle' } },
    frequency: 'weekly',
  }),
  is_active: 1,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  template_id: null,
  report_type: 'full',
  source_assessment_id: null,
  source_project_id: null,
};

const BUNDLE_STUB = {
  spine: { meta: { company: 'Acme', language: 'PL' } },
  table: {}, doc: {}, deck: {}, produced: { table: true, doc: true, deck: true },
};
const FILES_STUB = { docx: Buffer.from('d'), xlsx: Buffer.from('x'), pptx: Buffer.from('p'), pptxBoard: null };
const ZIP_STUB = Buffer.from('PK\x03\x04 zip');

import { scheduledReportService } from '../../../server/src/services/scheduledReportService.js';

describe('W6.1 — executeSchedule bridges to M17 bundle generator', () => {
  beforeEach(() => {
    mockGenerateBundle.mockReset().mockResolvedValue(BUNDLE_STUB);
    mockExportBundleFiles.mockReset().mockResolvedValue(FILES_STUB);
    mockBundleFilesToZip.mockReset().mockResolvedValue(ZIP_STUB);
    mockSafeBundleBaseName.mockReset().mockReturnValue('Acme');
    mockDb.get.mockReset().mockResolvedValue(SCHEDULE_ROW);
    mockDb.run.mockReset().mockResolvedValue(undefined);
    // Inject test dependencies
    (scheduledReportService as any).setDependencies({ db: mockDb });
    (scheduledReportService as any).initialized = true;
  });

  it('wywołuje generateBundle z briefem z description', async () => {
    const send = vi.fn().mockResolvedValue(true);
    (scheduledReportService as any).setDependencies({ db: mockDb, emailService: { send } });

    await (scheduledReportService as any).executeSchedule('sched-1');

    expect(mockGenerateBundle).toHaveBeenCalledWith(
      SCHEDULE_ROW.description,
      expect.objectContaining({ orgId: 'org-1', preferPremium: true }),
    );
  });

  it('exportuje bundle i generuje ZIP', async () => {
    const send = vi.fn().mockResolvedValue(true);
    (scheduledReportService as any).setDependencies({ db: mockDb, emailService: { send } });

    await (scheduledReportService as any).executeSchedule('sched-1');

    expect(mockExportBundleFiles).toHaveBeenCalledWith(BUNDLE_STUB);
    expect(mockBundleFilesToZip).toHaveBeenCalled();
  });

  it('wysyła email z załącznikiem ZIP (base64)', async () => {
    const send = vi.fn().mockResolvedValue(true);
    (scheduledReportService as any).setDependencies({ db: mockDb, emailService: { send } });

    await (scheduledReportService as any).executeSchedule('sched-1');

    expect(send).toHaveBeenCalledTimes(1);
    const emailOpts = send.mock.calls[0][0];
    expect(emailOpts.to).toBe('test@example.com');
    expect(emailOpts.subject).toBe('Weekly bundle');
    expect(emailOpts.attachments).toBeDefined();
    expect(emailOpts.attachments[0].contentType).toBe('application/zip');
    expect(emailOpts.attachments[0].content).toBe(ZIP_STUB.toString('base64'));
  });

  it('brief za krótki → brak generateBundle (skip silently)', async () => {
    mockDb.get.mockResolvedValue({
      ...SCHEDULE_ROW,
      description: 'krótki',
    });
    const send = vi.fn().mockResolvedValue(true);
    (scheduledReportService as any).setDependencies({ db: mockDb, emailService: { send } });

    await (scheduledReportService as any).executeSchedule('sched-1');

    expect(mockGenerateBundle).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
