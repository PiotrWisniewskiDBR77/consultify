/**
 * Dev-render: tablica „Dodaj" Materiałów (CreateFormatModeLauncher) — 2026-07-24.
 *
 * Montuje REALNY komponent z DOKŁADNIE tą konfiguracją, którą przekazuje
 * ReportsAndPresentationsHub (format×tryb), żeby render-verify wizualny
 * odbył się PRZED Piotrem (reguła #7) — hub sam wymaga logowania, więc modal
 * weryfikujemy w izolacji. `onSelect` tylko loguje (bez nawigacji).
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

import { CreateFormatModeLauncher } from '@/components/shared/CreateFormatModeLauncher';

type F = 'document' | 'presentation' | 'spreadsheet';
type M = 'blank' | 'ai' | 'from_template';

const MATERIALS_FORMAT = [
  { id: 'document' as F, icon: FileText, title: 'Dokument' },
  { id: 'presentation' as F, icon: Presentation, title: 'Prezentacja' },
  { id: 'spreadsheet' as F, icon: FileSpreadsheet, title: 'Arkusz Excel' },
];
const MATERIALS_MODE = [
  {
    id: 'blank' as M,
    icon: PenLine,
    title: 'Czysto',
    desc: 'Ręczny start — pusty artefakt w edytorze, bez AI.',
  },
  {
    id: 'ai' as M,
    icon: Sparkles,
    title: 'Z AI',
    desc: 'Opisz brief — AI zbuduje pierwszą wersję.',
  },
  {
    id: 'from_template' as M,
    icon: LayoutTemplate,
    title: 'Z szablonu',
    desc: 'Wybierz istniejący szablon i dostosuj.',
  },
];

const TEMPLATES_FORMAT = [
  { id: 'document' as F, icon: FileText, title: 'Word' },
  { id: 'presentation' as F, icon: Presentation, title: 'Prezentacja' },
  { id: 'spreadsheet' as F, icon: FileSpreadsheet, title: 'Excel' },
];
const TEMPLATES_MODE = [
  {
    id: 'blank' as M,
    icon: PenLine,
    title: 'Od czystego',
    desc: 'Nowy szablon od zera w architekcie.',
  },
  {
    id: 'ai' as M,
    icon: Wand2,
    title: 'Z AI',
    desc: 'Opisz szablon — architekt zaplanuje strukturę.',
  },
  {
    id: 'from_template' as M,
    icon: LayoutTemplate,
    title: 'Na bazie istniejącego',
    desc: 'Sklonuj istniejący szablon i zmodyfikuj.',
  },
];

export default function MaterialyLauncherScreen(): React.ReactElement {
  const variant = new URLSearchParams(window.location.search).get('variant') || 'materials';
  const isTpl = variant === 'templates';
  return (
    <div className="min-h-screen w-full bg-c-bg">
      {/* tło listy, żeby modal był w realnym kontekście */}
      <div className="p-8 text-c-text-secondary text-sm">
        Materiały — tło (modal poniżej otwarty)
      </div>
      <CreateFormatModeLauncher<F, M>
        isOpen
        onClose={() => {}}
        title={isTpl ? 'Nowy szablon' : 'Nowy materiał'}
        stepOneHint={isTpl ? 'Jaki typ szablonu?' : 'Co chcesz utworzyć?'}
        stepTwoTitle={() => (isTpl ? 'Jak zacząć szablon?' : 'Jak chcesz zacząć?')}
        formatTiles={isTpl ? TEMPLATES_FORMAT : MATERIALS_FORMAT}
        modeTiles={isTpl ? TEMPLATES_MODE : MATERIALS_MODE}
        onSelect={(f, m) => console.log('[dev-render] wybór:', f, m)}
        testId="materials-create-launcher"
      />
    </div>
  );
}
