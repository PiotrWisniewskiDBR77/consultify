/**
 * @vitest-environment jsdom
 *
 * D-28 (DEC-596) — dowód WPIĘCIA na realnym komponencie produktu: `PreviewRelations`
 * składa tytuł chipa z generycznej etykiety relacji (`relationFallbackLabel(undefined)`)
 * i surowego identyfikatora (`PreviewRelations.tsx:74-79,112`), więc w EN UI chip
 * relacji bez własnego kindu czyta się „Linked record — <id>", NIE po polsku.
 *
 * To ten sam łańcuch, który e2e `aco-definition-browser.spec.ts:1320` asertuje pod
 * harness PL („Powiązany rekord — milestone:…"): tu zamrażamy wersję EN (nowa para
 * i18n) i PL (bez regresji). Asertujemy KOMPOZYCJĘ tytułu na realnym `PreviewRelations`,
 * nie na lustrze — mutacja `fallback: relationFallbackLabel(...)` → literał PL musi
 * zbić ten test na RED, podczas gdy test parzystości samej funkcji zostaje GREEN.
 */
import { render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: string | { defaultValue?: string }) =>
      (typeof opts === 'string' ? opts : opts?.defaultValue) ?? key,
    i18n: { language: 'en' },
  }),
}));

import { PreviewRelations } from '../PreviewRelations';

const KATALOG_TEGO_TESTU = dirname(fileURLToPath(import.meta.url));
const sciezkaLocale = (jezyk: 'en' | 'pl') =>
  resolve(KATALOG_TEGO_TESTU, `../../../../../public/locales/${jezyk}/translation.json`);
const enRecord = (JSON.parse(readFileSync(sciezkaLocale('en'), 'utf8')) as any).sharedComponents
  .relationKind.record as string;
const plRecord = (JSON.parse(readFileSync(sciezkaLocale('pl'), 'utf8')) as any).sharedComponents
  .relationKind.record as string;

const RELATION_UUID = 'd585884f-6cd0-4be2-ae04-abaf0c223659';

describe('PreviewRelations — generyczny fallback relacji jest i18n, nie literałem PL (D-28)', () => {
  beforeAll(async () => {
    await i18n.init({
      lng: 'en',
      fallbackLng: false,
      resources: {
        en: { translation: { sharedComponents: { relationKind: { record: enRecord } } } },
        pl: { translation: { sharedComponents: { relationKind: { record: plRecord } } } },
      },
    });
  });

  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('EN: chip relacji bez kindu czyta się „Linked record — <id>", nigdy po polsku', async () => {
    await i18n.changeLanguage('en');
    render(<PreviewRelations items={[{ id: RELATION_UUID, label: RELATION_UUID }]} />);

    const chip = await screen.findByTitle(`Linked record — ${RELATION_UUID}`);
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('Linked record');
    // Surowy identyfikator zostaje w tooltipie — chip nie zmyśla nazwy.
    expect(chip.getAttribute('title')).toContain(RELATION_UUID);
    expect(screen.queryByText('Powiązany rekord')).toBeNull();
  });

  it('PL: ten sam chip zachowuje polską etykietę (bez regresji, spójne z e2e harness PL)', async () => {
    await i18n.changeLanguage('pl');
    render(<PreviewRelations items={[{ id: RELATION_UUID, label: RELATION_UUID }]} />);

    const chip = await screen.findByTitle(`Powiązany rekord — ${RELATION_UUID}`);
    expect(chip).toBeTruthy();
    expect(chip.textContent).toContain('Powiązany rekord');
  });
});
