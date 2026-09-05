/**
 * Document Studio — WIDOK CZYTELNY RAPORTU (odbiór na żywo 05.09, różnica
 * `report-artifact`).
 *
 * PROBLEM: trasa `/document-studio/:artifactId` renderowała KAŻDY materiał —
 * także gotowy raport zarządczy otwarty z Materiałów — edytorem bloków
 * (`DocumentTipTapEditor`: pasek KONSPEKT + pasek bloków + kursor). Właściciel
 * zatwierdził dla raportu obraz CZYTELNEJ KARTY (nagłówek + sekcje
 * wersalikami + treść), ocena A, uzasadnienie: „gotowy do pokazania klientowi".
 *
 * CO TEN KOMPONENT ROBI: renderuje ten sam dokument w trybie do czytania.
 * Sekcje niosą chrom nagłówka 1:1 z `GeneratedReportView`
 * (`src/components/Reports/GeneratedReportView.tsx` — komponent, z którego
 * powstał zatwierdzony obraz), a TREŚĆ bloków rysuje istniejący, wyłącznie
 * odczytowy `ReaderBlockRenderer` (publicReader) — ten sam, który obsługuje
 * `paragraph`/`bullet_list`/`callout`/`table`/`risk_table`/`kpi_strip`/
 * `chart`/`image`. Dzięki temu ŻADEN typ bloku nie ginie po drodze (mapowanie
 * na uboższy model `ReportBlock` gubiłoby wykresy i obrazy) i NIE powstaje
 * własna tabela — `DocTableBlock` jest komponentem współdzielonym.
 *
 * ★ UCZCIWOŚĆ WOBEC OBRAZU. Zatwierdzony obraz pochodzi z harnessu
 * `dev-render/screens/report-artifact.tsx`, który karmi `GeneratedReportView`
 * MOCKIEM (`ReportDocument`) — ma pigułkę RAG „WYMAGA UWAGI", etykietę okresu,
 * kursywne streszczenie, kafle KPI i tabelę benchmarku. REALNY artefakt
 * (`GET /api/document-studio/:artifactId`) oddaje wyłącznie `DocumentSchema`:
 * tytuł, typ, język, odbiorców, `createdAt`, sekcje i bloki. Nie ma w nim
 * pola statusu RAG, okresu ani streszczenia — więc te elementy NIE są tu
 * rysowane. Zmyślenie ich („WYMAGA UWAGI" bez źródła) byłoby fałszywą treścią
 * na dokumencie pokazywanym klientowi. Kafle KPI i benchmark pojawią się same
 * w chwili, gdy dokument będzie miał bloki `kpi_strip`/`table` — renderer je
 * obsługuje.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { ReaderBlockRenderer } from './publicReader/ReaderBlockRenderer';
import type { DocumentSchema } from './types';

/**
 * Rodzina typów dokumentu, dla której „raport" jest naturalnym widokiem
 * otwarcia. Świadomie wąska: dokumenty robocze (memo, SOP, plan wdrożenia,
 * oferta) zostają przy edytorze, bo tam człowiek pisze, a nie czyta.
 * `board_report` = typ realnego artefaktu z odbioru
 * (`artifact-d693d17a-…`, zmierzone na stagingu 05.09).
 */
export const REPORT_DOCUMENT_TYPES: readonly string[] = [
  'board_report',
  'steering_committee_report',
  'project_status_report',
  'benefits_tracking_report',
  'portfolio_overview',
  'ai_audit_report',
  'risk_register_report',
  'client_final_report',
];

export function isReportDocumentType(documentType: string | undefined | null): boolean {
  return typeof documentType === 'string' && REPORT_DOCUMENT_TYPES.includes(documentType);
}

function formatCreatedAt(iso: string | undefined, language: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export interface DocumentStudioReportViewProps {
  schema: DocumentSchema;
  className?: string;
}

export const DocumentStudioReportView: React.FC<DocumentStudioReportViewProps> = ({
  schema,
  className,
}) => {
  const { t } = useTranslation();

  const audienceLine = (schema.audience || []).filter(Boolean).join(' · ');
  const dateLine = formatCreatedAt(schema.createdAt, schema.language);
  const metaLine = [audienceLine, dateLine].filter(Boolean).join(' · ');
  const sections = [...(schema.sections || [])].sort(
    (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
  );

  return (
    <article
      data-testid="document-studio-report-view"
      className={`mx-auto w-full max-w-3xl rounded-xl border border-c-border-subtle bg-c-surface p-6 shadow-sm ${
        className || ''
      }`}
    >
      <header className="mb-6">
        <h1 className="text-lg font-semibold leading-snug text-c-text">{schema.title}</h1>
        {metaLine ? <p className="mt-1 text-xs text-c-text-secondary">{metaLine}</p> : null}
      </header>

      {sections.length === 0 ? (
        <p className="text-sm italic text-c-text-muted">
          {t('documentStudio.report.empty', 'Ten raport nie ma jeszcze treści.')}
        </p>
      ) : (
        sections.map((section) => {
          // `purpose` bywa dosłowną kopią tytułu sekcji (zmierzone na realnym
          // artefakcie) — wtedy podtytuł tylko powtarza nagłówek, więc znika.
          const intro =
            section.purpose && section.purpose.trim() !== section.title.trim()
              ? section.purpose
              : null;
          return (
            <section key={section.sectionId} className="mb-6 last:mb-0">
              <div className="mb-2 border-b border-c-border-subtle pb-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-c-text-secondary">
                  {section.title}
                </h2>
              </div>
              {intro ? <p className="mb-2 text-[11px] text-c-text-muted">{intro}</p> : null}
              {(section.blocks || []).length === 0 ? (
                <p className="text-sm italic text-c-text-muted">
                  {t('documentStudio.report.sectionEmpty', 'Ta sekcja jest pusta.')}
                </p>
              ) : (
                section.blocks.map((block) => (
                  <ReaderBlockRenderer
                    key={block.blockId}
                    block={{
                      blockId: block.blockId,
                      type: block.type,
                      content: block.content,
                      isAssumption: block.isAssumption ?? false,
                    }}
                  />
                ))
              )}
            </section>
          );
        })
      )}
    </article>
  );
};

export default DocumentStudioReportView;
