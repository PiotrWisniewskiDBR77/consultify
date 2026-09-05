import i18next, { type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import enTranslation from '../../../../public/locales/en/translation.json';
import plTranslation from '../../../../public/locales/pl/translation.json';

vi.unmock('react-i18next');

const representativeKeys = [
  'myWork.ideas.sentToWorkspaceToast',
  'myWork.ideas.savedFromChatToast',
  'myWork.notebook.savedFromChatToast',
  'myWork.decisions.createdFromChatToast',
  'chat.suggestions.generateReport',
  'branch.loadFailed',
  'voice.bargeInToast',
  'aiChat.workPanel.resizeDivider',
  'aiChat.folderColor',
  'aiChat.deleteFolderFailed',
  'aiChat.actions.export',
  'aiChat.visibilityHistory',
  'system.demoDataTitle',
  'system.dataAccess',
] as const;

describe('day374 header, history and SystemHealth Polish translations', () => {
  let plI18n: i18n;
  let enI18n: i18n;

  beforeAll(async () => {
    plI18n = i18next.createInstance();
    enI18n = i18next.createInstance();
    await plI18n.use(initReactI18next).init({
      lng: 'pl',
      fallbackLng: false,
      resources: { pl: { translation: plTranslation } },
      interpolation: { escapeValue: false },
    });
    await enI18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: false,
      resources: { en: { translation: enTranslation } },
      interpolation: { escapeValue: false },
    });
  });

  it('resolves representative labels in Polish without their English value', () => {
    for (const key of representativeKeys) {
      expect(plI18n.t(key)).not.toBe(key);
      expect(plI18n.t(key)).not.toBe(enI18n.t(key));
    }
  });

  it('uses the supervisor-approved Ideas toast verbatim', () => {
    expect(plI18n.t('myWork.ideas.sentToWorkspaceToast')).toBe(
      'Pomysł zapisany, otwieram Moją Pracę'
    );
    expect(plI18n.t('myWork.ideas.sentToWorkspaceToast')).not.toBe('Opened in Ideas workspace');
  });
});
