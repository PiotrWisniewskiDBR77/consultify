import re, sys, json, collections

# (plik, stary_fragment, nowy_fragment, potrzebny_hook)
ZMIANY = [
 ('src/components/Charts/ComparisonRadarChart.tsx',
  '<p className="text-slate-500 dark:text-slate-400">Wybierz analizy do porównania</p>',
  "<p className=\"text-slate-500 dark:text-slate-400\">\n          {t('charts.comparison.pickAnalyses', 'Choose analyses to compare')}\n        </p>"),
 ('src/components/Charts/RadarChart.tsx',
  '<span className="text-slate-600 dark:text-slate-500">Średnia:</span>',
  "<span className=\"text-slate-600 dark:text-slate-500\">{t('charts.radar.average', 'Average:')}</span>"),
 ('src/components/EmptyStates/AxisEmptyState.tsx',
  '      title="Brak osi decyzyjnych"\n      description="Oś decyzyjna to przestrzeń do ustrukturyzowania jednego tematu strategicznego. Zacznij od pustej osi lub wybierz gotowy szablon."',
  "      title={t('emptyStates.axis.title', 'No decision axes yet')}\n      description={t(\n        'emptyStates.axis.description',\n        'A decision axis is a space for structuring one strategic topic. Start from an empty axis or pick a ready-made template.'\n      )}"),
 ('src/components/EmptyStates/EmptyStateWithActions.tsx',
  '            Lub wybierz szablon\n',
  "            {t('emptyStates.orPickTemplate', 'Or pick a template')}\n"),
 ('src/components/ErrorBoundary.tsx',
  '                Zgłoś ten błąd z pełnym kontekstem\n',
  "                {i18n.t('errors.boundary.reportWithContext', 'Report this error with full context')}\n"),
 ('src/components/Import/UnifiedImportWizard.tsx',
  '<span className="text-blue-500 font-medium">kliknij aby wybrać</span>',
  "<span className=\"text-blue-500 font-medium\">{t('import.clickToChoose', 'click to choose')}</span>"),
 ('src/components/ModelSelector.tsx',
  'title="Sprawdzanie połączenia..."',
  "title={t('modelSelector.checkingConnection', 'Checking connection…')}"),
 ('src/components/access/ForbiddenAccessBanner.tsx',
  '            Brak uprawnien\n',
  "            {t('access.forbidden.title', 'No permission')}\n"),
 ('src/components/access/ForbiddenAccessBanner.tsx',
  'aria-label="Zamknij komunikat"',
  "aria-label={t('access.forbidden.dismiss', 'Dismiss this message')}"),
 ('src/components/ai/DiffView.tsx',
  '          Oryginał\n',
  "          {t('ai.diff.original', 'Original')}\n"),
 ('src/components/ai/MAXModeToggle.tsx',
  '              Zalecane dla: planowania strategicznego, złożonych analiz, decyzji krytycznych\n',
  "              {t(\n                'ai.maxMode.recommendedFor',\n                'Recommended for: strategic planning, complex analysis, critical decisions'\n              )}\n"),
 ('src/components/layout/SplitLayout.tsx',
  '<p className="text-[10px] text-slate-500">Twój asystent transformacji</p>',
  "<p className=\"text-[10px] text-slate-500\">\n                    {t('layout.split.assistantSubtitle', 'Your transformation assistant')}\n                  </p>"),
 ('src/components/shared/CanonicalWorkHardeningPanel.tsx',
  '          Brak przypisania roli użytkownika. Akcje zarządcze są zablokowane.\n',
  "          {t(\n            'canonicalWork.noRoleAssigned',\n            'No user role assigned. Governance actions are blocked.'\n          )}\n"),
 ('src/components/shared/TaskMilestoneBlastRadius.tsx',
  '<h4 className="text-sm font-semibold">Wpływ na kamienie milowe</h4>',
  "<h4 className=\"text-sm font-semibold\">\n        {t('tasks.milestoneImpact', 'Impact on milestones')}\n      </h4>"),
 ('src/views/V4ComingSoonView.tsx',
  '              Zgłoszenie wysłane\n',
  "              {t('v4ComingSoon.submitted', 'Request sent')}\n"),
]

zmienione = collections.Counter()
for plik, stare, nowe in ZMIANY:
    s = open(plik, encoding='utf-8').read()
    if stare not in s:
        print('NIE ZNALEZIONO w', plik, '::', stare[:60]); sys.exit(1)
    s = s.replace(stare, nowe, 1)
    open(plik, 'w', encoding='utf-8').write(s)
    zmienione[plik] += 1
print(json.dumps(zmienione, indent=1, ensure_ascii=False))
