/**
 * Dev-render: IDEE na wspólnym prawym pasie (`ArtifactRightRail`).
 *
 * Po co: CLAUDE.md #7 — właściciel nigdy nie jest pierwszym testerem
 * wizualnym. Ten harness renderuje REALNY `IdeaRightPanel` (nie kopię, nie
 * prototyp) za flagą `?ff_artifact_right_rail=1`, żeby dało się zrobić zrzut
 * każdego trybu pasa PRZED tym, jak właściciel go zobaczy — drugi krok
 * rozwożenia formuły z Notatnika (`prawy-pas-notatnik-system.tsx`, wzór 1:1).
 *
 * Idee montują `IdeaRightPanel` z GŁĘBI `IdeaMapWorkspace` (store/API/routing
 * realne, nie da się zmontować bez logowania) — więc jak w
 * `ideas-teresa-panel.tsx` (poprzedni, dziś nieaktualny harness tego samego
 * panelu — stare nazwy propsów sprzed Z8), treść trzech pierwszych sekcji
 * jest MOCKOWANA statycznymi węzłami. Nowość wobec tamtego pliku: prawdziwe
 * propsy trybu Teresa/typu (`teresaCommands`/`onDiscussWithTeresa`/
 * `aiSuggestionsContent`), zbudowane DOKŁADNIE tak, jak buduje je
 * `IdeaMapWorkspace.tsx` (ten sam import `IDEA_TERESA_COMMANDS` +
 * `seedIdeaTeresaPrompt`), żeby ten harness dowodził realnego kontraktu, nie
 * uproszczonej atrapy.
 *
 * `IdeaAISuggestionsPanel` (treść trybu „Sugestie") woła `Api.getIdeaAISuggestions`
 * na mount — mockujemy jak w `mywork-notebook-rail-speca` (podmiana metody
 * `Api.*`, nie reimplementacja komponentu).
 *
 * Zarejestrowany 3× ze stałym trybem startowym (`-artefakt`, `-teresa`,
 * `-sugestie`) — ten sam wzorzec co przy Notatniku, bo
 * `scripts/dev/grafika-zrzuty.mjs` nie klika UI.
 */
import { ArrowRight, FileText, Lightbulb, Tag } from 'lucide-react';
import React from 'react';

import { IdeaAISuggestionsPanel } from '@/components/MyWork/IdeaAISuggestionsPanel';
import {
  IDEA_TERESA_COMMANDS,
  IdeaTeresaSection,
  seedIdeaTeresaPrompt,
} from '@/components/MyWork/IdeaTeresaSection';
import type { ArtifactRailTeresaCommand } from '@/components/standard/ArtifactRightRail';
import { IdeaRightPanel } from '@/components/standard/IdeaRightPanel';
import { Api } from '@/services/api';

type ApiShape = Record<string, unknown>;

const installMocks = () => {
  const api = Api as unknown as ApiShape;
  api.getIdeaAISuggestions = async () => ({ suggestions: [], companyContextUsed: false });
};
installMocks();

const IDEA_TITLE = 'Ekspansja DE — mapa hipotez';

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
      <Row label={isPl ? 'Nazwa' : 'Name'} value={IDEA_TITLE} />
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
    </div>
  );
}

// ── Mock: karta „Powiązania" ────────────────────────────────────────────────
function RelationsMock({ isPl }: { isPl: boolean }): React.ReactElement {
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

export interface PrawyPasIdeaSystemScreenProps {
  /** Tryb pasa otwarty na starcie. Odpowiada ikonom szyny w tej kolejności. */
  tryb?: 'artefakt' | 'teresa' | 'sugestie';
}

export default function PrawyPasIdeaSystemScreen({
  tryb = 'artefakt',
}: PrawyPasIdeaSystemScreenProps): React.ReactElement {
  const isPl =
    (document.documentElement.lang || 'pl').startsWith('pl') ||
    new URLSearchParams(window.location.search).get('lang') !== 'en';

  // Ten sam wzorzec budowy, co realny `IdeaMapWorkspace.tsx` (renderWorkspaceSiblings):
  // JEDNO źródło treści komend (`IDEA_TERESA_COMMANDS`), zero drugiej kopii.
  const handleTeresaDiscuss = () => undefined;
  const teresaCommands: ArtifactRailTeresaCommand[] = IDEA_TERESA_COMMANDS.map((cmd) => ({
    id: cmd.id,
    label: isPl ? cmd.label : cmd.labelEn,
    icon: cmd.icon,
    onClick: () => {
      handleTeresaDiscuss();
      seedIdeaTeresaPrompt(isPl ? cmd.promptPl : cmd.promptEn);
    },
  }));

  return (
    <div className="flex h-screen w-screen items-stretch bg-c-bg">
      <CanvasMock isPl={isPl} />
      <IdeaRightPanel
        isPolish={isPl}
        title={IDEA_TITLE}
        activeSection="properties"
        onExport={() => undefined}
        onConvert={() => undefined}
        propertiesContent={<PropertiesMock isPl={isPl} />}
        relationsContent={<RelationsMock isPl={isPl} />}
        teresaContent={
          <IdeaTeresaSection
            isPolish={isPl}
            aiSuggestionsProps={{
              ideaId: 'idea-1',
              title: IDEA_TITLE,
              open: true,
              embedded: true,
              onClose: () => undefined,
            }}
            onDiscuss={handleTeresaDiscuss}
          />
        }
        onDiscussWithTeresa={handleTeresaDiscuss}
        teresaCommands={teresaCommands}
        aiSuggestionsContent={
          <IdeaAISuggestionsPanel
            ideaId="idea-1"
            title={IDEA_TITLE}
            open
            embedded
            onClose={() => undefined}
          />
        }
        defaultRailModeId={tryb}
      />
    </div>
  );
}
