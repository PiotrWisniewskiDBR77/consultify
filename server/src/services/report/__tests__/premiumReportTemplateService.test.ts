/** @vitest-environment node */
import fs from 'fs';
import Handlebars from 'handlebars';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  renderPremiumReportHtml,
  sanitizePremiumReportContent,
} from '../premiumReportTemplateService.js';

const hostile =
  '<p><strong>Business insight</strong></p><img src="x" onerror="globalThis.__xss=1"><script>globalThis.__xss=2</script><a href="javascript:alert(1)">bad link</a>';

describe('premium report server-side final-context sanitizer', () => {
  it('preserves benign report markup and removes executable HTML', () => {
    const sanitized = sanitizePremiumReportContent(hostile);
    expect(sanitized).toContain('<strong>Business insight</strong>');
    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('onerror');
    expect(sanitized).not.toContain('javascript:');
  });

  it('injects only safeContent into the compiled premium report template', () => {
    const html = renderPremiumReportHtml({
      name: 'R&D report',
      metrics: {},
      axes: [],
      sections: [{ title: 'Finding', sectionType: 'finding', content: hostile }],
    });

    expect(html).toContain('<strong>Business insight</strong>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
  });

  it('fails closed without the canonical renderer instead of dropping or injecting raw content', () => {
    const templatePath = path.resolve(process.cwd(), 'server/src/templates/premium-report.hbs');
    const directTemplate = Handlebars.compile(fs.readFileSync(templatePath, 'utf8'));
    const html = directTemplate(
      { sections: [{ title: 'Finding', sectionType: 'finding', content: hostile }] },
      {
        helpers: {
          formatDate: (value: unknown) => String(value ?? ''),
          formatNumber: (value: unknown) => String(value ?? ''),
          gt: () => false,
          getGapColor: () => '#475569',
          multiply: () => 0,
        },
      }
    );

    expect(html).toContain('&lt;strong&gt;Business insight&lt;/strong&gt;');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<a href=');
  });
});
