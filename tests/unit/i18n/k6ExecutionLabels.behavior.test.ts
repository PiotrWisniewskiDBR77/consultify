import i18next from 'i18next';
import { describe, expect, it } from 'vitest';

import en from '../../../public/locales/en/translation.json';
import pl from '../../../public/locales/pl/translation.json';

async function translator(language: 'en' | 'pl') {
  const instance = i18next.createInstance();
  await instance.init({
    lng: language,
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
      pl: { translation: pl },
    },
    interpolation: { escapeValue: false },
  });
  return instance.t.bind(instance);
}

describe('K6 bilingual object labels', () => {
  it('renders the explicit My Approvals and onboarding defects in English and Polish', async () => {
    const enT = await translator('en');
    const plT = await translator('pl');

    expect(enT('myWork.approvals.overdue')).toBe('Overdue');
    expect(plT('myWork.approvals.overdue')).toBe('Po terminie');
    expect(enT('myWork.approvals.emptyTitle')).toBe('No approvals found');
    expect(plT('myWork.approvals.emptyTitle')).toBe('Brak zatwierdzeń');
    expect(enT('onboarding.enterpriseWizard.progress', { current: 3, total: 4 })).toBe(
      'Step 3 of 4'
    );
    expect(plT('onboarding.enterpriseWizard.progress', { current: 3, total: 4 })).toBe(
      'Krok 3 z 4'
    );
  });

  it('interpolates real execution object labels without exposing placeholders', async () => {
    const enT = await translator('en');
    const plT = await translator('pl');

    expect(enT('execution.managementTable.criticalCount', { count: 2 })).toBe('2 critical');
    expect(plT('execution.managementTable.criticalCount', { count: 2 })).toBe('Krytyczne: 2');
    expect(enT('execution.rollout.closure.derived.handover', { name: 'ERP' })).toBe(
      'Handover: transfer ERP deliverables to operations'
    );
    expect(plT('execution.rollout.closure.derived.handover', { name: 'ERP' })).toBe(
      'Przekazanie: przekaż rezultaty inicjatywy ERP do operacji'
    );
  });
});
