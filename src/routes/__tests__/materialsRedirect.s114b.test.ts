/**
 * S1.14b — /materials and /materials/documents answered "Page not found".
 *
 * Measured on staging 13.09: the sidebar entry and the in-app buttons say
 * "Materials" / "Back to Materials", but neither address was a route — the real
 * one is /presentations (ReportsAndPresentationsHub), with the Documents tab at
 * ?tab=documents (outputsLibraryTabQuery.ts).
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { describe, expect, it } from 'vitest';

import { parseRapTabFromQuery } from '../../components/ReportsAndPresentations/outputsLibraryTabQuery';

const source = readFileSync(resolve(process.cwd(), 'src/routes/AppRoutes.tsx'), 'utf8');

const routeFor = (path: string): string | null => {
  const re = new RegExp(
    `path="${path.replace(/[/*]/g, (c) => `\\${c}`)}"\\s*\\n\\s*element=\\{<Navigate to=\\{\`([^\`]+)\``,
    'm'
  );
  const match = source.match(re);
  return match ? match[1] : null;
};

describe('S1.14b — Materials addresses resolve instead of 404', () => {
  it('/materials redirects into the Materials hub', () => {
    expect(routeFor('/materials')).toContain('${ROUTES.PRESENTATIONS}?tab=all');
  });

  it('/materials/documents redirects to the Documents tab', () => {
    expect(routeFor('/materials/documents')).toContain('${ROUTES.PRESENTATIONS}?tab=documents');
  });

  it('any deeper /materials/* address lands in the hub rather than 404', () => {
    expect(routeFor('/materials/*')).toContain('${ROUTES.PRESENTATIONS}?tab=all');
  });

  it('the "documents" tab token is one the hub actually understands', () => {
    expect(parseRapTabFromQuery('documents')).toBe('outputs_documents');
    expect(parseRapTabFromQuery('all')).toBeTruthy();
  });
});
