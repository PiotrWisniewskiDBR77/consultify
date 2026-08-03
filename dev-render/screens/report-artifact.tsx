/**
 * Dev-render host — Artefakt Report (archetyp B·Dokument, wariant "raport
 * doradczy"). Montuje REALNY `GeneratedReportView` (rendering-only, ten sam
 * komponent co ExecutionHub → Reporting → podgląd wygenerowanego raportu) z
 * mock `ReportDocument` obejmującym: streszczenie, ocenę obszarów (RAG),
 * benchmark branżowy (tabela) i kluczowe wnioski (lista + callout).
 *
 * UWAGA (pułapka odnotowana w raporcie): `GeneratedReportView` to renderer
 * TREŚCI raportu bez własnego Menu1/prawego panelu — w realnej apce jest
 * osadzany wewnątrz istniejącego panelu podglądu ExecutionHub, które to
 * dostarcza powłokę. Ten screen odtwarza dokładnie ten układ (karta w
 * neutralnym kontenerze c-*), żeby nie zmyślać powłoki, której ten komponent
 * naprawdę nie ma — pełne SPEC-A Menu1/ArtifactRightPanel dla "Report" żyje
 * na poziomie hosta (ReportsHub/ExecutionHub), nie tego widoku.
 *
 * URL params: ?screen=report-artifact&theme=light|dark&lang=pl|en
 */
import React from 'react';

import { GeneratedReportView } from '@/components/Reports/GeneratedReportView';
import type { ReportDocument } from '@/components/Reports/reportContentGenerator';

const doc: ReportDocument = {
  typeId: 'steering_committee_report',
  title: 'Raport dla Komitetu Sterującego — Ekspansja DE',
  audience: 'Komitet Sterujący',
  periodLabel: '1 cze – 30 cze 2026',
  generatedAtLabel: '1 lipca 2026, 09:12',
  rag: 'amber',
  ragLabel: 'Wymaga uwagi',
  summary:
    'Projekt na trajektorii budżetowej i harmonogramowej zgodnej z planem; jeden strumień prac (integracje systemowe) zagrożony, wymaga decyzji komitetu do 25 lipca.',
  sections: [
    {
      id: 'sec-overview',
      heading: 'Przegląd inicjatywy',
      intro: 'Status ogólny i kluczowe metryki okresu',
      blocks: [
        {
          kind: 'metrics',
          items: [
            { label: 'Budżet wykorzystany', value: '62%', hint: 'z 430k EUR', tone: 'default' },
            { label: 'Kamienie milowe', value: '5/6', hint: 'on-time', tone: 'good' },
            { label: 'Ryzyka wysokie', value: '1', hint: 'systemy/integracje', tone: 'warn' },
            { label: 'Confidence', value: '78%', tone: 'good' },
          ],
        },
        {
          kind: 'paragraph',
          text: 'Rekrutacja zespołu sprzedaży w Berlinie opóźniona o 3 tygodnie — bez wpływu na datę startu pilota 15 sierpnia. Koszt pozyskania klienta (CAC) o 12% niższy niż zakładano w biznes-planie.',
        },
      ],
    },
    {
      id: 'sec-areas',
      heading: 'Ocena obszarów',
      intro: 'RAG per strumień prac',
      blocks: [
        {
          kind: 'table',
          columns: ['Strumień prac', 'Budżet', 'Wykorzystano', 'Status'],
          rows: [
            { cells: ['Rekrutacja', '180k EUR', '96k EUR', 'W toku'], tone: 'default' },
            { cells: ['Marketing lokalny', '120k EUR', '88k EUR', 'W toku'], tone: 'default' },
            {
              cells: ['Systemy i integracje', '90k EUR', '81k EUR', 'Zagrożone'],
              tone: 'critical',
            },
            { cells: ['Compliance / prawo', '40k EUR', '12k EUR', 'Na czas'], tone: 'good' },
          ],
        },
      ],
    },
    {
      id: 'sec-benchmark',
      heading: 'Benchmark branżowy',
      intro: 'Porównanie z podobnymi ekspansjami na rynkach DACH (baza 12 projektów)',
      blocks: [
        {
          kind: 'table',
          columns: ['Metryka', 'Ten projekt', 'Mediana benchmarku', 'Percentyl'],
          rows: [
            { cells: ['Czas do pierwszego klienta', '4.5 mies.', '6 mies.', 'P75'], tone: 'good' },
            { cells: ['CAC (EUR)', '1 240', '1 410', 'P65'], tone: 'good' },
            { cells: ['Czas rekrutacji zespołu', '11 tyg.', '8 tyg.', 'P30'], tone: 'warn' },
            { cells: ['Budżet vs plan (odchylenie)', '+8%', '+15%', 'P70'], tone: 'good' },
          ],
        },
        {
          kind: 'callout',
          tone: 'good',
          text: 'Projekt plasuje się powyżej mediany benchmarku na 3 z 4 kluczowych metryk — jedynym obszarem poniżej mediany jest tempo rekrutacji lokalnego zespołu.',
        },
      ],
    },
    {
      id: 'sec-conclusions',
      heading: 'Kluczowe wnioski i rekomendacja',
      blocks: [
        {
          kind: 'list',
          ordered: true,
          items: [
            'Utrzymać budżet i harmonogram pilota — brak przesłanek do korekty.',
            'Przyspieszyć renegocjację SLA z partnerem logistycznym przed startem pilota.',
            'Rozważyć dodatkowego rekrutera dla zespołu sprzedaży DE, by domknąć lukę tempa rekrutacji.',
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          text: 'Decyzja komitetu wymagana do 25 lipca w sprawie renegocjacji SLA — inaczej start pilota przesuwa się o kolejny miesiąc.',
        },
      ],
    },
  ],
};

export default function ReportArtifactScreen(): React.ReactElement {
  return (
    <div className="flex h-screen w-full flex-col bg-c-bg">
      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto p-6">
        <div className="rounded-xl border border-c-border-subtle bg-c-surface shadow-sm">
          <GeneratedReportView doc={doc} />
        </div>
      </div>
    </div>
  );
}
