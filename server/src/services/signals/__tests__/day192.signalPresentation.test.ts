import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import { signalBody } from '../../../../../src/components/AIChat/signalsFeed/signalPresentation.js';
import type { SignalDTO } from '../../../../../src/components/AIChat/signalsFeed/signalTypes.js';

const loadCatalog = (locale: 'pl' | 'en') =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), `../public/locales/${locale}/translation.json`), 'utf8')
  );

const dto = {
  body: 'server fallback must not be used',
  bodyKey: 'signals.exec.task.overdue.body',
  bodyParams: { value: 3 },
} as SignalDTO;

describe('day192 client interpolation', () => {
  it.each([
    ['pl', 'Zadanie jest po terminie o 3 dni.'],
    ['en', 'The task is 3 days overdue.'],
  ] as const)('renders value in %s without a raw placeholder', async (locale, expected) => {
    const i18n = createInstance();
    await i18n.init({
      lng: locale,
      fallbackLng: false,
      interpolation: { escapeValue: false },
      resources: { [locale]: { translation: loadCatalog(locale) } },
    });

    const rendered = signalBody(dto, i18n.t);
    expect(rendered).toBe(expected);
    expect(rendered).not.toContain('{{');
  });
});
