/**
 * dev-render host — Interview "Sesje" / "Inicjatywy" single-click PREVIEW
 * panes, rebuilt onto TABLE_AND_PREVIEW_CANON.md §7 (DEC-2026-08-25-53).
 *
 * Mounts the REAL production pieces — nothing here is re-implemented:
 *   - `TableWithPreviewLayout` (src/components/shared/TableWithPreviewLayout)
 *     for the shell/header (title · Pin · Otwórz · ×), exactly what
 *     InterviewHub.tsx uses for the Sesje/Inicjatywy tabs.
 *   - `InterviewSessionPreviewBody`/`Footer` and
 *     `InterviewInitiativePreviewBody`/`Footer`
 *     (src/components/Interview/Interview{Session,Initiative}Preview.tsx) —
 *     the same components InterviewHub.tsx wires into its
 *     renderPreview/renderPreviewFooter callbacks.
 *
 * Only the SURROUNDING glue (mock session/initiative objects, table/list
 * column filler) is harness-only — the preview pane itself is 100%
 * production code.
 *
 * URL: ?screen=interview-preview-canon
 *   &variant=session|initiative   (default: session)
 *   &kebab=1                      open the Details (⋮) kebab menu on load
 *   &lang=pl|en  &theme=light|dark
 */
import React, { useState } from 'react';

import {
  InterviewInitiativePreviewBody,
  InterviewInitiativePreviewFooter,
} from '../../src/components/Interview/InterviewInitiativePreview';
import {
  InterviewSessionPreviewBody,
  InterviewSessionPreviewFooter,
} from '../../src/components/Interview/InterviewSessionPreview';
import { TableWithPreviewLayout } from '../../src/components/shared/TableWithPreviewLayout';

const params = new URLSearchParams(window.location.search);
const variant = params.get('variant') === 'initiative' ? 'initiative' : 'session';
const openKebabOnLoad = params.get('kebab') === '1';

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* harness — clipboard permissions vary headless, non-fatal */
  }
}

// ── Mock: Sesje tab — "Odbiór właścicielski — retencja klienta" ─────────────

const mockSession = {
  id: 'w3-session-mock-1',
  name: 'Odbiór właścicielski — retencja klienta',
  status: 'completed',
  answeredQuestions: 6,
  totalQuestions: 6,
  startedAt: '2026-08-20T09:00:00.000Z',
  lastActivityAt: '2026-08-25T11:40:00.000Z',
  ownerId: 'owner-1',
  assigneeName: 'Ala Kowalska',
  respondentName: null,
  templateName: 'Diagnoza jakości przekazania klienta',
  templateCategory: null,
  organizationId: 'org-1',
};

function SessionScreen() {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const item = { ...mockSession, title: mockSession.name };

  /*
   * ★ 2026-09-02 — zdjęty `p-4` z korzenia ekranu. Produkt
   * (`InterviewHub.tsx:6992`) montuje `TableWithPreviewLayout` w
   * `<div className="h-full overflow-hidden">`, BEZ marginesu bocznego.
   * Harness dokładał 2×16 px, więc `28%` liczyło się od 1568 px i panel
   * wychodził 439 px zamiast produkcyjnych 448 px. Właściciel oceniał
   * szerokość dokładnie na tym kadrze („Nie umiem ocenić, czy szerokość
   * tego jest wystarczająca") — mierzył przyrząd, nie produkt.
   */
  return (
    <div className="h-screen w-screen bg-slate-50 dark:bg-navy-950">
      {/* Bez `max-w` — szerokość podglądu to `clamp(340px, 28%, 480px)` liczone
          od obszaru roboczego. Harness zaciskał go wcześniej do `max-w-[1100px]`,
          więc 28% wypadało poniżej dolnej granicy i panel renderował się na
          sztywnych 340 px — czyli WĘŻSZY niż w produkcie (403 px przy 1440 px).
          Właściciel oceniał szerokość na tym zrzucie i słusznie nie potrafił jej
          ocenić: mierzył ograniczenie harnessu, nie komponent. */}
      <div className="mx-auto h-full w-full">
        <TableWithPreviewLayout
          selectedId={item.id}
          selectedItem={previewOpen ? item : null}
          onSelect={() => setPreviewOpen(true)}
          onOpenFull={() => {}}
          itemIds={[item.id]}
          getItemById={() => item}
          renderPreview={() => (
            <InterviewSessionPreviewBody
              session={mockSession}
              ownerName="Piotr Wiśniewski"
              isPolish
              statusConfig={{ label: { pl: 'Zatwierdzony', en: 'Approved' } }}
              progress={100}
              detailsExpanded={detailsExpanded}
              onToggleDetailsExpanded={() => setDetailsExpanded((v) => !v)}
              onCopyStats={() =>
                copyToClipboard(`id: ${mockSession.id}\nstatus: completed\nanswered: 6/6`)
              }
              onCopyId={() => copyToClipboard(mockSession.id)}
            />
          )}
          renderPreviewFooter={() => (
            <InterviewSessionPreviewFooter
              session={mockSession}
              isPolish
              canRunAi
              aiHints={['Podsumuj', 'Ryzyka', 'Następne kroki']}
              onRunAiHint={() => {}}
              relations={[
                // Etykiety 1:1 z produkcją (InterviewHub.tsx ~L7092: `t('interview.hub.assignee3')`
                // = "Przypisany", nie "Assignee") — harness miał literalny angielski napis w
                // polskich mock-danych, co wyglądało jak defekt produktu, a było artefaktem
                // przyrządu pomiarowego (mock nie zgodny z i18n, który realnie renderuje ekran).
                { label: 'Przypisany: Ala Kowalska', tone: 'text-slate-600 dark:text-slate-300' },
                {
                  label: 'Szablon: Diagnoza jakości przekazania klienta',
                  tone: 'text-slate-600 dark:text-slate-300',
                },
                {
                  // Poprzednia wartość "W3 Interview Owner Review" była nazwą wewnętrznego
                  // zadania roboczego (fala 3, przegląd modułu Wywiad), nie nazwą organizacji
                  // klienta — myliła zrzut z realną treścią produktu.
                  label: 'Organizacja: Grupa Norden',
                  tone: 'text-slate-600 dark:text-slate-300',
                },
              ]}
              onOpenFull={() => {}}
              onGenerateInsight={() => {}}
              onCopyId={() => copyToClipboard(mockSession.id)}
            />
          )}
        >
          <div className="p-4 text-xs text-slate-600 dark:text-slate-400">
            (Tabela Sesje — poza zakresem tego zrzutu; patrz preview po prawej.)
          </div>
        </TableWithPreviewLayout>
      </div>
    </div>
  );
}

// ── Mock: Inicjatywy tab — draft sourced from an Insight ────────────────────

const mockInitiative = {
  id: 'w3-initiative-mock-1',
  title: 'Wprowadzić bramkę gotowości przekazania klienta',
  name: 'Wprowadzić bramkę gotowości przekazania klienta',
  status: 'DRAFT',
  priority: 'medium',
  description:
    'Klient nie otrzymuje ustandaryzowanego pakietu powitalnego w ciągu pierwszych 48h od podpisania umowy, co powoduje opóźnienia w starcie wdrożenia i powielane pytania między zespołem sprzedaży a wdrożenia. Bramka gotowości wymusi checklistę przekazania przed otwarciem projektu.',
  sourceId: 'insight-1',
  updatedAt: '2026-08-25T09:00:00.000Z',
  createdAt: '2026-08-25T09:00:00.000Z',
};

function InitiativeScreen() {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const item = { ...mockInitiative, title: mockInitiative.title };

  /*
   * ★ 2026-09-02 — zdjęty `p-4` z korzenia ekranu. Produkt
   * (`InterviewHub.tsx:6992`) montuje `TableWithPreviewLayout` w
   * `<div className="h-full overflow-hidden">`, BEZ marginesu bocznego.
   * Harness dokładał 2×16 px, więc `28%` liczyło się od 1568 px i panel
   * wychodził 439 px zamiast produkcyjnych 448 px. Właściciel oceniał
   * szerokość dokładnie na tym kadrze („Nie umiem ocenić, czy szerokość
   * tego jest wystarczająca") — mierzył przyrząd, nie produkt.
   */
  return (
    <div className="h-screen w-screen bg-slate-50 dark:bg-navy-950">
      {/* Bez `max-w` — szerokość podglądu to `clamp(340px, 28%, 480px)` liczone
          od obszaru roboczego. Harness zaciskał go wcześniej do `max-w-[1100px]`,
          więc 28% wypadało poniżej dolnej granicy i panel renderował się na
          sztywnych 340 px — czyli WĘŻSZY niż w produkcie (403 px przy 1440 px).
          Właściciel oceniał szerokość na tym zrzucie i słusznie nie potrafił jej
          ocenić: mierzył ograniczenie harnessu, nie komponent. */}
      <div className="mx-auto h-full w-full">
        <TableWithPreviewLayout
          selectedId={item.id}
          selectedItem={item}
          onSelect={() => {}}
          onOpenFull={() => {}}
          itemIds={[item.id]}
          getItemById={() => item}
          renderPreview={() => (
            <InterviewInitiativePreviewBody
              initiative={{
                id: mockInitiative.id,
                status: mockInitiative.status,
                priority: mockInitiative.priority,
                description: mockInitiative.description,
              }}
              statusLabel="Szkic"
              priorityLevel="medium"
              hasSourceInsight
              dateStr="25.08.2026"
              promoted={false}
              isPolish
              detailsExpanded={detailsExpanded}
              onToggleDetailsExpanded={() => setDetailsExpanded((v) => !v)}
              onCopyDetails={() => copyToClipboard(mockInitiative.description)}
              onCopyId={() => copyToClipboard(mockInitiative.id)}
            />
          )}
          renderPreviewFooter={() => (
            <InterviewInitiativePreviewFooter
              isPolish
              status={mockInitiative.status}
              canReview
              relations={[
                {
                  label: 'Wniosek: Przekazanie klienta ze sprzedaży do wdrożenia',
                  tone: 'text-amber-600 dark:text-amber-300',
                },
                {
                  // Był surowy enum "medium" zamiast etykiety — ta sama pułapka co w
                  // InterviewHub.tsx (naprawione tam osobno, ZGŁASZAM: literówka
                  // "Sredni" bez ogonka w public/locales/pl/translation.json:7024).
                  label: 'Priorytet: Średni',
                  tone: 'text-slate-600 dark:text-slate-300',
                },
                { label: 'Aktualizacja: 25.08.2026', tone: 'text-slate-600 dark:text-slate-300' },
              ]}
              onSendToReview={() => {}}
              onOpenInModule={() => {}}
              onCopyId={() => copyToClipboard(mockInitiative.id)}
            />
          )}
        >
          <div className="p-4 text-xs text-slate-600 dark:text-slate-400">
            (Tabela Inicjatywy — poza zakresem tego zrzutu; patrz preview po prawej.)
          </div>
        </TableWithPreviewLayout>
      </div>
    </div>
  );
}

export default function InterviewPreviewCanonScreen() {
  React.useEffect(() => {
    if (!openKebabOnLoad) return;
    const id = window.setTimeout(() => {
      const kebab = document.querySelector<HTMLButtonElement>(
        '[aria-label="sharedComponents.previewDetailsSection.detailsOptions"], [title="Opcje"], [title="Options"]'
      );
      kebab?.click();
    }, 400);
    return () => window.clearTimeout(id);
  }, []);

  return variant === 'initiative' ? <InitiativeScreen /> : <SessionScreen />;
}
