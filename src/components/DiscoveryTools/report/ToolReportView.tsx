/**
 * Deterministyczny widok Report / Presentation dla Tool Outputu.
 *
 * ZASADY (decyzja koordynatora 2026-08-13):
 *  - renderuje ZATWIERDZONY Artifact, nigdy zrzut ekranu;
 *  - ten sam dokument + ta sama wersja renderera = ten sam wynik;
 *  - Presentation usuwa kontrolki i skraca treść, ale NIE zmienia znaczenia;
 *  - Light = Executive Paper, Dark = Executive Night; oba przechodzą MPQ osobno.
 *
 * KANON UI:
 *  - wyłącznie tokeny `c-*`; crimson NIGDY nie służy jako kolor danych —
 *    serie i kategorie biorą paletę `c-tag-*`, sygnały `c-success/warning/info`;
 *  - action title jest WNIOSKIEM, nie etykietą sekcji;
 *  - argument → dowód → implikacja;
 *  - kontrolowana przestrzeń, minimalne granice, brak cieni „SaaS dashboard".
 */

import React from 'react';

import type {
  EvidenceKind,
  ReportBlock,
  ToolReportDocument,
} from '@/toolOutputs/types';

/** Etykiety typu dowodu — hipoteza NIGDY nie udaje faktu. */
const EVIDENCE_LABEL: Record<EvidenceKind, { pl: string; tone: string }> = {
  fact: { pl: 'fakt', tone: 'text-c-success' },
  observation: { pl: 'obserwacja', tone: 'text-c-info' },
  hypothesis: { pl: 'hipoteza', tone: 'text-c-warning' },
};

/** Postawa napięcia — kolory z palety danych `c-tag-*`. */
const POSTURE_LABEL: Record<string, { pl: string; dot: string }> = {
  attack: { pl: 'Atakuj szansę', dot: 'bg-c-tag-3' },
  repair: { pl: 'Napraw, by sięgnąć', dot: 'bg-c-tag-5' },
  defend: { pl: 'Broń się siłą', dot: 'bg-c-tag-7' },
  protect: { pl: 'Chroń ekspozycję', dot: 'bg-c-tag-9' },
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-c-text-muted">
      {children}
    </div>
  );
}

/**
 * Wyeksportowany dla `SlideDeckView` (Slide Mode) — jedno źródło rendera
 * bloku, żeby slajdy i przewijany dokument NIGDY nie rozjechały się w
 * interpretacji tej samej treści (zero zduplikowanej logiki renderowania).
 */
export function BlockView({ block }: { block: ReportBlock }) {
  switch (block.kind) {
    case 'action-title':
      return <h3 className="text-lg font-semibold text-c-text">{block.text}</h3>;

    case 'paragraph':
      return <p className="text-sm leading-relaxed text-c-text-secondary">{block.text}</p>;

    case 'evidence-list':
      return (
        <section className="space-y-2.5">
          <Eyebrow>Dowody</Eyebrow>
          <ul className="space-y-2">
            {block.items.map((it, i) => (
              <li key={i} className="flex items-baseline gap-2.5 text-sm text-c-text-secondary">
                <span className="mt-[2px] h-1.5 w-1.5 shrink-0 rounded-full bg-c-border-strong" />
                <span className="flex-1 leading-relaxed">{it.label}</span>
                <span
                  className={`shrink-0 text-[10px] uppercase tracking-[0.14em] ${
                    EVIDENCE_LABEL[it.evidenceKind].tone
                  }`}
                >
                  {EVIDENCE_LABEL[it.evidenceKind].pl}
                </span>
              </li>
            ))}
          </ul>
        </section>
      );

    case 'tension-list':
      return (
        <section className="space-y-2.5">
          <Eyebrow>Napięcia strategiczne</Eyebrow>
          <ul className="divide-y divide-c-border-subtle">
            {block.items.map((t, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    POSTURE_LABEL[t.posture]?.dot ?? 'bg-c-border-strong'
                  }`}
                />
                <span className="flex-1 text-sm text-c-text">{t.title}</span>
                <span className="text-[11px] text-c-text-muted">
                  {POSTURE_LABEL[t.posture]?.pl ?? t.posture}
                </span>
                {/* Waga pochodzi z silnika — to jest K1, nie ocena redakcyjna. */}
                <span className="w-8 text-right text-xs tabular-nums text-c-text-secondary">
                  {t.priority}
                </span>
              </li>
            ))}
          </ul>
        </section>
      );

    case 'conclusion':
      return (
        <section className="rounded-2xl border border-c-border-subtle bg-c-surface-raised p-5">
          <div className="space-y-4">
            <div>
              <Eyebrow>Co jest</Eyebrow>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-c-text">
                {block.k1Fact}
              </p>
            </div>
            <div>
              <Eyebrow>Co to znaczy</Eyebrow>
              <p className="mt-1.5 text-sm leading-relaxed text-c-text-secondary">
                {block.k2Meaning}
              </p>
            </div>
            <div>
              <Eyebrow>Co robić najpierw</Eyebrow>
              <ol className="mt-1.5 space-y-1.5">
                {block.k3Actions.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-c-text">
                    <span className="tabular-nums text-c-text-muted">{i + 1}.</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <Eyebrow>Jaki efekt</Eyebrow>
              <p className="mt-1.5 text-sm leading-relaxed text-c-text-secondary">
                {block.k4Effect}
              </p>
            </div>

            {/* Trade-off jest OBOWIĄZKOWY w W2 — bez niego nie było decyzji. */}
            <div className="rounded-xl border border-c-border-subtle bg-c-surface p-4">
              <Eyebrow>Trade-off</Eyebrow>
              <dl className="mt-2 space-y-1.5 text-[13px]">
                <div className="flex gap-2.5">
                  <dt className="w-20 shrink-0 text-c-text-muted">Wybrane</dt>
                  <dd className="text-c-text">{block.tradeoff.chosen}</dd>
                </div>
                <div className="flex gap-2.5">
                  <dt className="w-20 shrink-0 text-c-text-muted">Odrzucone</dt>
                  <dd className="text-c-text">{block.tradeoff.rejected || '—'}</dd>
                </div>
                <div className="flex gap-2.5">
                  <dt className="w-20 shrink-0 text-c-text-muted">Dlaczego</dt>
                  <dd className="text-c-text-secondary">{block.tradeoff.why || '—'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      );

    case 'signature-visual':
      return <SignatureVisual archetype={block.archetype} payload={block.payload} />;

    default:
      return null;
  }
}

/** Geometria sygnaturowa — pole 2×2 z napięciami dla Dynamic SWOT. */
function SignatureVisual({ archetype, payload }: { archetype: string; payload: unknown }) {
  const data = payload as {
    items?: Array<{ id: string; label: string; bucket: string }>;
    tensions?: Array<{ posture: string; sourceItemIds: [string, string] }>;
  };
  if (archetype !== 'dynamic-swot') return null;

  const QUADRANTS: Array<{ key: string; pl: string }> = [
    { key: 'strengths', pl: 'Siły' },
    { key: 'weaknesses', pl: 'Słabości' },
    { key: 'opportunities', pl: 'Szanse' },
    { key: 'threats', pl: 'Zagrożenia' },
  ];

  return (
    <section className="space-y-2">
      <Eyebrow>Pole strategiczne</Eyebrow>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-c-border-subtle bg-c-border-subtle">
        {QUADRANTS.map((q) => {
          const inQ = (data.items ?? []).filter((i) => i.bucket === q.key);
          return (
            <div key={q.key} className="min-h-[92px] bg-c-surface p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
                {q.pl}
              </div>
              <ul className="mt-1.5 space-y-1">
                {inQ.map((i) => (
                  <li key={i.id} className="text-[13px] leading-snug text-c-text">
                    {i.label}
                  </li>
                ))}
                {inQ.length === 0 && <li className="text-[13px] text-c-text-muted">—</li>}
              </ul>
            </div>
          );
        })}
      </div>
      {/* Napięcia łączą ćwiartki — bez nich to tylko cztery listy. */}
      <div className="text-[11px] text-c-text-muted">
        {(data.tensions ?? []).length} napięć łączy ćwiartki
      </div>
    </section>
  );
}

export interface ToolReportViewProps {
  doc: ToolReportDocument;
  /** Presentation View usuwa kontrolki — tryb prezentacyjny. */
  presentationMode?: boolean;
}

export function ToolReportView({ doc, presentationMode = false }: ToolReportViewProps) {
  const isDeck = doc.kind === 'presentation';

  return (
    <article
      data-testid="tool-report-view"
      data-renderer-version={doc.rendererVersion}
      data-content-hash={doc.contentHash}
      // Rytm typograficzny (H1, 2026-08-13): szerszy margines dokumentu +
      // większy odstęp nagłówek→treść niż w gęstym UI — to jest dokument
      // do czytania, nie panel aplikacji. TREŚĆ bez zmian.
      className="mx-auto w-full max-w-3xl bg-c-bg px-8 py-10 text-c-text sm:px-10"
    >
      <header className="mb-10 border-b border-c-border-subtle pb-5">
        <Eyebrow>{isDeck ? 'Prezentacja wykonawcza' : 'Raport'}</Eyebrow>
        <h1 className="mt-2 text-[26px] font-semibold leading-[1.2] tracking-tight text-c-text">
          {doc.title}
        </h1>
        {!presentationMode && (
          <p className="mt-2.5 text-xs tabular-nums text-c-text-muted">
            Renderer {doc.rendererVersion} · źródła: {doc.sourceOutputIds.length}
          </p>
        )}
      </header>

      <div>
        {doc.sections.map((section, index) => (
          <section
            key={section.id}
            className={`space-y-4 ${
              index === 0 ? '' : 'mt-10 border-t border-c-border-subtle pt-10'
            }`}
          >
            {/* Action title = wniosek. Jeden dominujący komunikat na sekcję. */}
            <h2 className="text-[17px] font-semibold leading-snug tracking-tight text-c-text">
              {section.actionTitle}
            </h2>
            <div className="space-y-5">
              {section.blocks.map((block, i) => (
                <BlockView key={i} block={block} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

export default ToolReportView;
