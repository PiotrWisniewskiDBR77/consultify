/**
 * Dev-render host dla JEDNEGO prawego panelu idei = DOK TERESY (D16/D17).
 *
 * Renderuje REALNY `<IdeaRightPanel>` (kanoniczny accordion `ArtifactRightPanel`)
 * z trzema sekcjami: Właściwości · Kontekst · Teresa — dokładnie ten sam
 * komponent, który wchodzi w `IdeaMapWorkspace` zamiast archaicznego
 * przełącznika 3 osobnych szuflad (#6q).
 *
 * Treść sekcji jest MOCKOWANA (statyczne węzły), bo realne panele idei
 * (IdeaWorkspaceTools/IdeaContextPanel/IdeaAISuggestionsPanel) ciągną store/API
 * i nie zmontują się bez logowania — celem story jest ODBIÓR WYGLĄDU powłoki:
 * jeden panel po prawej, 3 karty, trzecia karta = Teresa (komendy + strumień
 * sugestii jako proaktywne wiadomości Teresy). Tokeny c-* (light+dark), zero
 * crimson. Bez store/API/logowania. Motyw/lang z URL (?theme, ?lang).
 */
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Lightbulb,
  MessageSquarePlus,
  RefreshCw,
  Sparkles,
  Tag,
  Wand2,
} from 'lucide-react';
import React from 'react';

import { IdeaRightPanel } from '../../src/components/standard/IdeaRightPanel';

// ── Mock: karta „Właściwości" (tożsamość idei) ─────────────────────────────
function PropertiesMock({ isPl }: { isPl: boolean }): React.ReactElement {
  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[11px] uppercase tracking-wider text-c-text-muted shrink-0">
        {label}
      </span>
      <span className="text-xs text-c-text text-right">{value}</span>
    </div>
  );
  return (
    <div className="flex flex-col divide-y divide-c-border-subtle">
      <Row
        label={isPl ? 'Nazwa' : 'Name'}
        value={isPl ? 'Ekspansja DE — mapa hipotez' : 'DE expansion — hypothesis map'}
      />
      <Row
        label={isPl ? 'Tagi' : 'Tags'}
        value={
          <span className="inline-flex gap-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-c-surface-raised px-2 py-0.5 text-[10px] text-c-text-muted">
              <Tag size={9} />
              rynek
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-c-surface-raised px-2 py-0.5 text-[10px] text-c-text-muted">
              <Tag size={9} />
              DE
            </span>
          </span>
        }
      />
      <Row label={isPl ? 'Właściciel' : 'Owner'} value="Piotr W." />
      <Row
        label={isPl ? 'Dojrzałość' : 'Maturity'}
        value={<span className="text-c-text-muted">{isPl ? 'dojrzewa' : 'maturing'}</span>}
      />
      <div className="py-2">
        <p className="text-xs leading-relaxed text-c-text-secondary">
          {isPl
            ? 'Mapa hipotez wejścia na rynek DE — gałęzie: popyt, konkurencja, kanały, ryzyka.'
            : 'DE go-to-market hypothesis map — branches: demand, competition, channels, risks.'}
        </p>
      </div>
    </div>
  );
}

// ── Mock: karta „Kontekst" (powiązania: wejście/wyjście) ───────────────────
function ContextMock({ isPl }: { isPl: boolean }): React.ReactElement {
  const Link = ({ icon: Icon, label }: { icon: typeof FileText; label: string }) => (
    <li className="flex items-center gap-2 py-1 text-xs text-c-text">
      <Icon size={13} className="text-c-text-muted shrink-0" />
      <span className="truncate">{label}</span>
    </li>
  );
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
          {isPl ? 'Wejście' : 'Input'}
        </p>
        <ul className="divide-y divide-c-border-subtle">
          <Link
            icon={FileText}
            label={isPl ? 'Notatka: wywiady z partnerami DE' : 'Note: DE partner interviews'}
          />
          <Link
            icon={Lightbulb}
            label={isPl ? 'Insight: luka w kanałach B2B' : 'Insight: B2B channel gap'}
          />
        </ul>
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
          {isPl ? 'Wyjście' : 'Output'}
        </p>
        <ul className="divide-y divide-c-border-subtle">
          <Link
            icon={ArrowRight}
            label={isPl ? 'Inicjatywa: pilotaż DACH' : 'Initiative: DACH pilot'}
          />
        </ul>
      </div>
      <button
        type="button"
        className="self-start text-[11px] font-medium text-c-text-muted underline decoration-dotted underline-offset-2 hover:text-c-text"
      >
        {isPl ? 'Pokaż graf powiązań' : 'Show link graph'}
      </button>
    </div>
  );
}

// ── Mock: karta „Teresa" (parytet z IdeaTeresaSection) ─────────────────────
function TeresaMock({ isPl }: { isPl: boolean }): React.ReactElement {
  const cmds: Array<{ icon: React.ReactNode; pl: string; en: string }> = [
    { icon: <Wand2 size={13} />, pl: 'Uzupełnij puste', en: 'Fill empty' },
    { icon: <Sparkles size={13} />, pl: 'Synteza', en: 'Synthesize' },
    { icon: <CheckCircle2 size={13} />, pl: 'Kontrola jakości', en: 'Quality check' },
    { icon: <RefreshCw size={13} />, pl: 'Kontynuuj', en: 'Continue' },
  ];
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-c-border bg-c-surface px-3 py-2 text-xs font-medium text-c-text transition-colors hover:bg-c-surface-raised"
      >
        <MessageSquarePlus size={14} className="text-c-text-muted" />
        {isPl ? 'Rozmawiaj z Teresą' : 'Discuss with Teresa'}
      </button>
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
          {isPl ? 'Komendy' : 'Commands'}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {cmds.map((c) => (
            <span
              key={c.en}
              className="inline-flex items-center gap-1.5 rounded-full border border-c-border bg-c-surface px-2.5 py-1 text-[11px] font-medium text-c-text-muted"
            >
              <span className="text-c-text-muted">{c.icon}</span>
              {isPl ? c.pl : c.en}
            </span>
          ))}
        </div>
      </div>
      <div className="-mx-4 border-t border-c-border-subtle px-4 pt-3">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
          {isPl ? 'Sugestie Teresy' : 'Teresa suggestions'}
        </p>
        <div className="flex flex-col gap-2">
          {[
            isPl
              ? 'Rozważ gałąź „bariery regulacyjne DE" — brakuje jej na mapie.'
              : 'Consider a "DE regulatory barriers" branch — it is missing.',
            isPl
              ? 'Węzły „kanały" i „popyt" wyglądają na powiązane — połączyć?'
              : 'The "channels" and "demand" nodes look related — link them?',
          ].map((t, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border border-c-border-subtle bg-c-surface-raised px-2.5 py-2"
            >
              <Sparkles size={13} className="mt-0.5 shrink-0 text-c-text-muted" />
              <p className="text-xs leading-snug text-c-text-secondary">{t}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Mock canvas (tło idei — żeby panel miał kontekst szerokości) ───────────
function CanvasMock({ isPl }: { isPl: boolean }): React.ReactElement {
  return (
    <div className="relative flex-1 overflow-hidden bg-c-surface-raised">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle, color-mix(in srgb, var(--c-border) 60%, transparent) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      <div className="relative flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl border border-c-border bg-c-surface px-5 py-3 text-sm font-medium text-c-text shadow-sm">
            {isPl ? 'Ekspansja DE' : 'DE expansion'}
          </div>
          <div className="flex gap-3">
            {['popyt', 'kanały', 'ryzyka'].map((n) => (
              <div
                key={n}
                className="rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-xs text-c-text-secondary"
              >
                {n}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IdeasTeresaPanelScreen(): React.ReactElement {
  const isPl =
    (document.documentElement.lang || 'pl').startsWith('pl') ||
    new URLSearchParams(window.location.search).get('lang') !== 'en';

  return (
    <div className="flex h-screen w-full flex-col bg-c-surface">
      {/* Mock topbar narzędzia idei */}
      <div className="flex h-12 items-center gap-3 border-b border-c-border-subtle px-4">
        <span className="text-sm font-semibold text-c-text">
          {isPl ? 'Mapa myśli' : 'Mind map'}
        </span>
        <span className="text-c-text-muted">·</span>
        <span className="text-xs text-c-text-muted">
          {isPl ? 'Ekspansja DE — mapa hipotez' : 'DE expansion — hypothesis map'}
        </span>
      </div>
      {/* Wiersz: canvas + JEDEN prawy panel (dok Teresy) */}
      <div className="flex min-h-0 flex-1">
        <CanvasMock isPl={isPl} />
        <IdeaRightPanel
          isPolish={isPl}
          activeSection="teresa"
          propertiesContent={<PropertiesMock isPl={isPl} />}
          contextContent={<ContextMock isPl={isPl} />}
          teresaContent={<TeresaMock isPl={isPl} />}
        />
      </div>
    </div>
  );
}
