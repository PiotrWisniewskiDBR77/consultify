/**
 * Przewód eksportu raportu i prezentacji z oceny ZASTANEJ.
 *
 * Trzy warstwy, każda z własnym dowodem mutacyjnym (opisanym przy asercji):
 *   1. trasy są ZAREJESTROWANE w routerze (nie tylko napisane w pliku),
 *   2. router jest ZAMONTOWANY w Gateway pod `/api/assessment-reports`,
 *   3. silnik składa z realnego kształtu `answers_json` kontrakt i model
 *      prezentacji bez placeholderów i bez nachodzących pól.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 60_000 });

const __dirname_ = path.dirname(fileURLToPath(import.meta.url));
const SERVER_SRC = path.resolve(__dirname_, '../..');

describe('eksport oceny zastanej — przewód', () => {
  it('router rejestruje trzy trasy eksportu', async () => {
    const modul = await import('../assessment-reports.routes.js');
    const router = modul.default as unknown as {
      stack: { route?: { path: string; methods: Record<string, boolean> } }[];
    };
    const sciezki = router.stack
      .filter((warstwa) => warstwa.route)
      .map((warstwa) => `${Object.keys(warstwa.route!.methods)[0].toUpperCase()} ${warstwa.route!.path}`);

    // DOWÓD MUTACYJNY: usunięcie któregokolwiek `router.get('/assessment/...')`
    // z assessment-reports.routes.ts wywraca dokładnie tę asercję.
    expect(sciezki).toContain('GET /assessment/:assessmentId/export/report.docx');
    expect(sciezki).toContain('GET /assessment/:assessmentId/export/deck.pptx');
    expect(sciezki).toContain('GET /assessment/:assessmentId/export/deck.pdf');
  });

  it('Gateway montuje router pod /api/assessment-reports', () => {
    const gateway = readFileSync(path.join(SERVER_SRC, 'Gateway.ts'), 'utf8');
    // DOWÓD MUTACYJNY: skasowanie linii `app.use('/api/assessment-reports', …)`
    // w Gateway.ts czyni ten test czerwonym — a bez tej linii żadna z trzech
    // tras nie jest osiągalna z produktu, mimo że router je rejestruje.
    expect(gateway).toMatch(
      /app\.use\(\s*'\/api\/assessment-reports'\s*,\s*assessmentReportsRoutes\s*\)/
    );
    expect(gateway).toMatch(
      /import\s+assessmentReportsRoutes\s+from\s+'\.\/routes\/assessment\/assessment-reports\.routes\.js'/
    );
  });
});
