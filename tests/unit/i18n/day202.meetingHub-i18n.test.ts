import fs from 'node:fs';
import path from 'node:path';

import i18next from 'i18next';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = fs.readFileSync(
  path.join(root, 'src/components/Meeting/MeetingHub.tsx'),
  'utf8'
);
const pl = JSON.parse(
  fs.readFileSync(path.join(root, 'public/locales/pl/translation.json'), 'utf8')
);
const en = JSON.parse(
  fs.readFileSync(path.join(root, 'public/locales/en/translation.json'), 'utf8')
);

const criticalMeetingKeys = [
  'meeting.empty',
  'meeting.sync.workspace',
  'meeting.operatorBriefError',
  'meeting.previousMonth',
  'meeting.today',
  'meeting.nextMonth',
  'meeting.more',
  'meeting.preview.propertyLabel',
  'meeting.preview.valueLabel',
];

describe('day202 MeetingHub i18n', () => {
  it('uses translation keys for preview property headers instead of language branches', () => {
    expect(source).toContain("propertyLabel: t('meeting.preview.propertyLabel', 'Property')");
    expect(source).toContain("valueLabel: t('meeting.preview.valueLabel', 'Value')");
    expect(source).not.toContain("propertyLabel: isPolish ? 'Właściwość' : 'Property'");
    expect(source).not.toContain("valueLabel: isPolish ? 'Wartość' : 'Value'");
  });

  it('keeps every critical MeetingHub key non-empty and in PL/EN parity', () => {
    const read = (locale: Record<string, unknown>, key: string) =>
      key.split('.').reduce<unknown>(
        (value, segment) =>
          value && typeof value === 'object'
            ? (value as Record<string, unknown>)[segment]
            : undefined,
        locale
      );

    for (const key of criticalMeetingKeys) {
      expect(read(pl, key), `${key} in pl`).toEqual(expect.any(String));
      expect(read(en, key), `${key} in en`).toEqual(expect.any(String));
      expect(String(read(pl, key)).trim(), `${key} in pl`).not.toBe('');
      expect(String(read(en, key)).trim(), `${key} in en`).not.toBe('');
    }
  });

  it('resolves the cited runtime strings in Polish after an explicit language change', async () => {
    const instance = i18next.createInstance();
    await instance.init({
      fallbackLng: 'en',
      lng: 'en',
      resources: { en: { translation: en }, pl: { translation: pl } },
    });

    await instance.changeLanguage('pl');

    expect(instance.language).toBe('pl');
    expect(instance.t('meeting.empty')).toBe('Brak spotkań');
    expect(instance.t('meeting.sync.workspace')).toBe('Wspólna przestrzeń');
    expect(instance.t('meeting.operatorBriefError')).toBe(
      'Nie udało się załadować briefu operatora.'
    );
    expect(instance.t('meeting.preview.propertyLabel')).toBe('Właściwość');
    expect(instance.t('meeting.preview.valueLabel')).toBe('Wartość');
  });
});
