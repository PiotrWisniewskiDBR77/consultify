import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const portalSource = fs.readFileSync(
  path.resolve(__dirname, '../../../src/views/partner/PartnerPortalView.tsx'),
  'utf8'
);
const en = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../public/locales/en/translation.json'), 'utf8')
);
const pl = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../public/locales/pl/translation.json'), 'utf8')
);

const breadcrumbLiterals = [
  "'My Links & Codes'",
  "'Click Analytics'",
  "'Referred Customers'",
  "'Commission Earnings'",
  "'Payout History'",
  "'Client Access Manager'",
  "'Learning Path'",
  "'Marketing Materials'",
  "'Company Info'",
  "'Public Listing'",
];

describe('day189 Partner i18n contract', () => {
  it('routes every breadcrumb label through partner i18n keys', () => {
    const breadcrumbBlock = portalSource.slice(
      portalSource.indexOf('const sectionLabels'),
      portalSource.indexOf('const crumbs: Breadcrumb[]')
    );

    for (const literal of breadcrumbLiterals) {
      expect(breadcrumbBlock).not.toContain(`: ${literal}`);
      expect(breadcrumbBlock).not.toContain(`label: ${literal}`);
    }
    expect(breadcrumbBlock.match(/t\('partner\.sidebar\./g)?.length).toBeGreaterThanOrEqual(40);
  });

  it('maps the complete observed certification status family without a raw enum fallback', () => {
    const statusBlock = portalSource.slice(
      portalSource.indexOf('const getDisplayStatus'),
      portalSource.indexOf('const normalizeStatus')
    );

    for (const status of [
      'completed',
      'in_progress',
      'in-progress',
      'not_started',
      'locked',
      'not_required',
      'prerequisite_incomplete',
      'academy_incomplete',
    ]) {
      expect(statusBlock).toContain(`'${status}'`);
    }
    expect(statusBlock).not.toContain('return status;');
  });

  it('ships matching English and Polish labels for certification API statuses', () => {
    const statuses = [
      'completed',
      'in_progress',
      'in-progress',
      'not_started',
      'locked',
      'not_required',
      'prerequisite_incomplete',
      'academy_incomplete',
    ];

    for (const status of statuses) {
      expect(en.partner.certification.apiStatus[status]).toBeTypeOf('string');
      expect(pl.partner.certification.apiStatus[status]).toBeTypeOf('string');
      expect(pl.partner.certification.apiStatus[status]).not.toMatch(/_/);
    }
  });
});
