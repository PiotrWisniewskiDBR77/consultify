import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const readLocale = (locale: 'en' | 'pl') =>
  JSON.parse(
    readFileSync(path.join(process.cwd(), 'public', 'locales', locale, 'translation.json'), 'utf8')
  );

const getPath = (obj: unknown, dottedPath: string): unknown =>
  dottedPath.split('.').reduce((current: any, key) => current?.[key], obj);

const REQUIRED_KEYS = [
  'settings.sections.ai-prompt-library.title',
  'settings.sections.ai-model-params.title',
  'settings.sections.notifications-email-digest.title',
  'settings.sections.notifications-desktop-sounds.title',
  'settings.sidebar.aiPromptLibrary',
  'settings.ai.promptLibraryTitle',
  'settings.ai.builtins.professional.prompt',
  'settings.ai.builtins.interviewPrep.prompt',
  'settings.integrations.calendarTitle',
  'settings.importExport.title',
  'settings.importExport.exportSuccess',
  'settings.importExport.importSuccessWithCount',
  'settings.importExport.categories.profile',
  'settings.emailDigest.title',
  'settings.emailDigest.cat_taskUpdates_desc',
  'settings.emailDigest.freq_daily_desc',
  'settings.templates.title',
  'settings.templates.applyError',
  'settings.templates.deleteConfirm',
  'settings.shortcuts.actions.go_settings.name',
  'settings.shortcuts.presets.default.description',
  'settings.desktopSounds.sound_default',
  'settings.desktopSounds.type_task_assigned',
  'settings.notifications.label',
  'settings.notifications.provider.slack',
  'settings.notifications.channels.authStarted',
  'settings.notifications.channels.showUnreadBadgeDesc',
  'settings.notifications.digest.freq_daily_desc',
  'settings.notifications.sounds.sound_default',
  'settings.availability.days.mon.full',
  'settings.availability.preset_afterWork',
  'settings.data.deleteConfirmPhrase',
  'settings.data.privacyPolicyDesc',
  'settings.appearance.label',
  'settings.appearance.accent.violet',
  'settings.appearance.uiDensityOptions.compactDesc',
  'settings.appearance.startPageOptions.lastVisitedDesc',
  'settings.appearance.visual.resetToast',
  'settings.appearance.visual.accent.purple',
  'settings.appearance.visual.radius.medium',
  'settings.taxonomy.scopes.tenant.description',
  'settings.taxonomy.impacts.tenantOwned',
  'settings.ownership.tenantDefaults.subtitle',
  'settings.ownership.loadError',
  'settings.ownership.value.notConfigured',
  'settings.ownership.defaultToolVisibility',
  'settings.work.views.kanbanDesc',
  'settings.work.reminder.1day',
  'settings.work.focus.25min',
  'settings.regional.tenantTimezone',
  'settings.regional.currencies.PLN',
  'settings.regional.dateFormats.YYYY-MM-DD',
  'settings.workingHours.sameEveryDayDescription',
  'settings.workingHours.days.monday.full',
  'settings.sections.security-overview.title',
  'settings.sections.sessions-activity.subtitle',
  'settings.ai.configurationSaved',
  'settings.ai.configurationSaveError',
  'settings.privacy.visibility.teamDesc',
  'settings.privacy.profile.organizationDesc',
  'settings.accessibility.fontFamily.system',
  'settings.accessibility.colorVision.protanopiaDesc',
  'settings.accessibility.lineHeightTitle',
  'settings.accessibility.lineHeight.default',
  'settings.accessibility.navigationTitle',
  'help.feedback.title',
  'help.feedback.commentPlaceholder',
];

describe('required settings i18n keys', () => {
  it.each(['en', 'pl'] as const)('%s locale includes settings/help feedback keys', (locale) => {
    const translation = readLocale(locale);

    for (const key of REQUIRED_KEYS) {
      expect(getPath(translation, key), key).toEqual(expect.any(String));
      expect(String(getPath(translation, key)).trim(), key).not.toBe('');
    }
  });
});
