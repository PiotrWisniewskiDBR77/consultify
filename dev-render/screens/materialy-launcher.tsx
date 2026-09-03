/**
 * Dev-render: tablica „Dodaj" Materiałów (CreateFormatModeLauncher) — 2026-07-24.
 *
 * Montuje REALNY komponent z DOKŁADNIE tą konfiguracją, którą przekazuje
 * ReportsAndPresentationsHub (format×tryb), żeby render-verify wizualny
 * odbył się PRZED Piotrem (reguła #7) — hub sam wymaga logowania, więc modal
 * weryfikujemy w izolacji. `onSelect` tylko loguje (bez nawigacji).
 *
 * G06 i18n (dyżur 2026-09-03, agent/i18n-pl-en): ten mock miał WŁASNE,
 * hardkodowane polskie stringi zamiast wołać `t()` jak realny
 * `ReportsAndPresentationsHub.tsx` — ekran renderował identyczny tekst na
 * `?lang=pl` i `?lang=en` (pomiar PL=EN), mimo że produkcyjny kod od dawna
 * ma wołania `t('rap.materialsLauncher.*', ...)`/`t('rap.templatesLauncher.*', ...)`.
 * Klucze WCALE nie miały wpisów w plikach public/locales/{pl,en}/translation.json —
 * to był realny defekt produktu (fallback = polski tekst dla KAŻDEGO
 * języka), nie tylko usterka mocka. Naprawa: dopisane klucze w obu plikach
 * locale + ten plik teraz woła `t()` z DOKŁADNIE tymi samymi kluczami co
 * `ReportsAndPresentationsHub.tsx:437-559,1568-1593`.
 *
 * URL: ?screen=materialy-launcher[&theme=light|dark][&variant=materials|templates]
 */
import {
  FileSpreadsheet,
  FileText,
  LayoutTemplate,
  PenLine,
  Presentation,
  Sparkles,
  Wand2,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CreateFormatModeLauncher } from '@/components/shared/CreateFormatModeLauncher';

type F = 'document' | 'presentation' | 'spreadsheet';
type M = 'blank' | 'ai' | 'from_template';

export default function MaterialyLauncherScreen(): React.ReactElement {
  const { t } = useTranslation();
  const variant = new URLSearchParams(window.location.search).get('variant') || 'materials';
  const isTpl = variant === 'templates';

  const MATERIALS_FORMAT = [
    { id: 'document' as F, icon: FileText, title: t('rap.materialsLauncher.document', 'Dokument') },
    {
      id: 'presentation' as F,
      icon: Presentation,
      title: t('rap.materialsLauncher.presentation', 'Prezentacja'),
    },
    {
      id: 'spreadsheet' as F,
      icon: FileSpreadsheet,
      title: t('rap.materialsLauncher.spreadsheet', 'Arkusz Excel'),
    },
  ];
  const MATERIALS_MODE = [
    {
      id: 'blank' as M,
      icon: PenLine,
      title: t('rap.materialsLauncher.blankTitle', 'Czysto'),
      desc: t('rap.materialsLauncher.blankDesc', 'Ręczny start — pusty artefakt w edytorze, bez AI.'),
    },
    {
      id: 'ai' as M,
      icon: Sparkles,
      title: t('rap.materialsLauncher.aiTitle', 'Z AI'),
      desc: t('rap.materialsLauncher.aiDesc', 'Opisz brief — AI zbuduje pierwszą wersję.'),
    },
    {
      id: 'from_template' as M,
      icon: LayoutTemplate,
      title: t('rap.materialsLauncher.templateTitle', 'Z szablonu'),
      desc: t('rap.materialsLauncher.templateDesc', 'Wybierz istniejący szablon i dostosuj.'),
    },
  ];

  const TEMPLATES_FORMAT = [
    { id: 'document' as F, icon: FileText, title: t('rap.templatesLauncher.document', 'Word') },
    {
      id: 'presentation' as F,
      icon: Presentation,
      title: t('rap.templatesLauncher.presentation', 'Prezentacja'),
    },
    { id: 'spreadsheet' as F, icon: FileSpreadsheet, title: t('rap.templatesLauncher.spreadsheet', 'Excel') },
  ];
  const TEMPLATES_MODE = [
    {
      id: 'blank' as M,
      icon: PenLine,
      title: t('rap.templatesLauncher.blankTitle', 'Od czystego'),
      desc: t('rap.templatesLauncher.blankDesc', 'Nowy szablon od zera w architekcie.'),
    },
    {
      id: 'ai' as M,
      icon: Wand2,
      title: t('rap.templatesLauncher.aiTitle', 'Z AI'),
      desc: t('rap.templatesLauncher.aiDesc', 'Opisz szablon — architekt zaplanuje strukturę.'),
    },
    {
      id: 'from_template' as M,
      icon: LayoutTemplate,
      title: t('rap.templatesLauncher.existingTitle', 'Na bazie istniejącego'),
      desc: t('rap.templatesLauncher.existingDesc', 'Sklonuj zatwierdzony szablon i dostosuj.'),
    },
  ];

  return (
    <div className="min-h-screen w-full bg-c-bg">
      {/* tło listy, żeby modal był w realnym kontekście */}
      <div className="p-8 text-c-text-secondary text-sm">
        {t('rap.materialsLauncher.backgroundHint', 'Materiały — tło (modal poniżej otwarty)')}
      </div>
      <CreateFormatModeLauncher<F, M>
        isOpen
        onClose={() => {}}
        title={
          isTpl
            ? t('rap.templatesLauncher.title', 'Nowy szablon')
            : t('rap.materialsLauncher.title', 'Nowy materiał')
        }
        stepOneHint={
          isTpl
            ? t('rap.templatesLauncher.subtitle', 'Wybierz typ szablonu')
            : t('rap.materialsLauncher.subtitle', 'Wybierz format')
        }
        stepTwoTitle={() => t('rap.materialsLauncher.chooseMode', 'Jak chcesz zacząć?')}
        stepTwoHint={() =>
          t('rap.materialsLauncher.modeHint', 'Wybierz tryb — wszystkie trzy są równorzędne.')
        }
        formatTiles={isTpl ? TEMPLATES_FORMAT : MATERIALS_FORMAT}
        modeTiles={isTpl ? TEMPLATES_MODE : MATERIALS_MODE}
        onSelect={(f, m) => console.log('[dev-render] wybór:', f, m)}
        testId="materials-create-launcher"
      />
    </div>
  );
}
