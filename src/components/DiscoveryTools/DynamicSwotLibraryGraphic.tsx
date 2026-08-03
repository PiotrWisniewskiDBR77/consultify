import React from 'react';
import { useTranslation } from 'react-i18next';

export function DynamicSwotLibraryGraphic({
  isPolish: isPolishProp,
  variant = 'process',
}: {
  isPolish?: boolean;
  variant?: 'process' | 'example';
}) {
  const { t, i18n } = useTranslation();
  const isExample = variant === 'example';
  const ns = 'discoveryToolsMain.dynamicSwotLibraryGraphic';

  // ── MIESZANKA JĘZYKOWA — NAPRAWA 2026-07-24 (fala 2) ───────────────────────
  // Prop `isPolish` był DEKLAROWANY, ale nigdy nie czytany, więc pigułki grafiki
  // („Tool", „Process", „Matrix", „Output") i kafle rezultatów („Initiative",
  // „Report", „Presentation", „Idea") renderowały się PO ANGIELSKU także w
  // polskiej karcie. Wzorzec naprawy 1:1 z `NModeMenu2.tsx` (tabela par + `pick`)
  // — bez nowych kluczy w translation.json, bez wyścigu „angielski default
  // do czasu doładowania bundla".
  const isPolish = isPolishProp ?? i18n.language === 'pl';
  const pick = (pair: { en: string; pl: string }) => (isPolish ? pair.pl : pair.en);
  const CHIP = {
    tool: { en: 'Tool', pl: 'Narzędzie' },
    process: { en: 'Process', pl: 'Proces' },
    matrix: { en: 'Matrix', pl: 'Macierz' },
    output: { en: 'Output', pl: 'Rezultat' },
  } as const;

  const outputs = [
    pick({ en: 'Initiative', pl: 'Inicjatywa' }),
    pick({ en: 'Report', pl: 'Raport' }),
    pick({ en: 'Presentation', pl: 'Prezentacja' }),
    pick({ en: 'Idea', pl: 'Pomysł' }),
  ];
  const strengthItems = isExample
    ? (t(`${ns}.strengthItemsExample`, { returnObjects: true }) as string[])
    : (t(`${ns}.strengthItemsProcess`, { returnObjects: true }) as string[]);
  const weaknessItems = isExample
    ? (t(`${ns}.weaknessItemsExample`, { returnObjects: true }) as string[])
    : (t(`${ns}.weaknessItemsProcess`, { returnObjects: true }) as string[]);
  const opportunityItems = isExample
    ? (t(`${ns}.opportunityItemsExample`, { returnObjects: true }) as string[])
    : (t(`${ns}.opportunityItemsProcess`, { returnObjects: true }) as string[]);
  const threatItems = isExample
    ? (t(`${ns}.threatItemsExample`, { returnObjects: true }) as string[])
    : (t(`${ns}.threatItemsProcess`, { returnObjects: true }) as string[]);
  const labels = {
    // Nazwa metody — po polsku tak samo jak tytuł karty w Menu 1 („Dynamiczny SWOT"),
    // żeby ta sama rzecz nie nazywała się na jednym ekranie dwoma nazwami.
    eyebrow: pick({ en: 'Dynamic SWOT', pl: 'Dynamiczny SWOT' }),
    title: isExample ? t(`${ns}.titleExample`) : t(`${ns}.titleProcess`),
    subtitle: isExample ? t(`${ns}.subtitleExample`) : t(`${ns}.subtitleProcess`),
    scenario: isExample ? t(`${ns}.scenarioLabelExample`) : t(`${ns}.scenarioLabelProcess`),
    scenarioValue: isExample ? t(`${ns}.scenarioValueExample`) : t(`${ns}.scenarioValueProcess`),
    flow: t(`${ns}.flow`),
    decision: isExample ? t(`${ns}.decisionLabelExample`) : t(`${ns}.decisionLabelProcess`),
    decisionValue: isExample ? t(`${ns}.decisionValueExample`) : t(`${ns}.decisionValueProcess`),
    stagesTitle: isExample ? t(`${ns}.stagesTitleExample`) : t(`${ns}.stagesTitleProcess`),
    stagesSubtitle: t(`${ns}.stagesSubtitle`),
    signals: t(`${ns}.signals`),
    matrixLead: t(`${ns}.matrixLead`),
    matrixNote: t(`${ns}.matrixNote`),
    tensionPanel: t(`${ns}.tensionPanel`),
    tensionLead: t(`${ns}.tensionLead`),
    moves: t(`${ns}.moves`),
    movesLead: t(`${ns}.movesLead`),
    outputs: t(`${ns}.outputsPanelTitle`),
    outputsLead: t(`${ns}.outputsLead`),
    stage1: t(`${ns}.stage1`),
    stage1Value: t(`${ns}.stage1Value`),
    stage2: t(`${ns}.stage2`),
    stage2Value: t(`${ns}.stage2Value`),
    stage3: t(`${ns}.stage3`),
    stage3Value: t(`${ns}.stage3Value`),
    stage4: t(`${ns}.stage4`),
    stage4Value: t(`${ns}.stage4Value`),
    stage5: t(`${ns}.stage5`),
    stage5Value: t(`${ns}.stage5Value`),
    stage4Badge: t(`${ns}.stage4Badge`),
    stage5Badge: t(`${ns}.stage5Badge`),
    strengths: t(`${ns}.strengths`),
    weaknesses: t(`${ns}.weaknesses`),
    opportunities: t(`${ns}.opportunities`),
    threats: t(`${ns}.threats`),
    strengthsHint: t(`${ns}.strengthsHint`),
    weaknessesHint: t(`${ns}.weaknessesHint`),
    opportunitiesHint: t(`${ns}.opportunitiesHint`),
    threatsHint: t(`${ns}.threatsHint`),
    strengthItems,
    weaknessItems,
    opportunityItems,
    threatItems,
    tensionItems: t(`${ns}.tensionItems`, { returnObjects: true }) as string[],
    moveItems: t(`${ns}.moveItems`, { returnObjects: true }) as string[],
    outputItems: t(`${ns}.outputItems`, { returnObjects: true }) as string[],
    legend: t(`${ns}.legend`),
  };

  const stages = [
    {
      id: 1,
      title: labels.stage1,
      value: labels.stage1Value,
      tone: 'from-c-info/[0.18] to-c-info/[0.08]',
      accent: 'bg-c-info',
      badge: null,
    },
    {
      id: 2,
      title: labels.stage2,
      value: labels.stage2Value,
      tone: 'from-sky-500/[0.18] to-blue-500/[0.08]',
      accent: 'bg-sky-500',
      badge: null,
    },
    {
      id: 3,
      title: labels.stage3,
      value: labels.stage3Value,
      tone: 'from-emerald-500/[0.18] to-blue-500/[0.08]',
      accent: 'bg-emerald-500',
      badge: null,
    },
    {
      id: 4,
      title: labels.stage4,
      value: labels.stage4Value,
      tone: 'from-amber-500/[0.22] to-amber-500/10',
      accent: 'bg-amber-500',
      badge: labels.stage4Badge,
    },
    {
      id: 5,
      title: labels.stage5,
      value: labels.stage5Value,
      tone: 'from-c-info/[0.22] to-c-info/10',
      accent: 'bg-c-info',
      badge: labels.stage5Badge,
    },
  ];

  const signalCards = [
    {
      title: labels.strengths,
      hint: labels.strengthsHint,
      items: labels.strengthItems,
      className:
        'border-emerald-200/70 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100',
      titleClassName: 'text-emerald-800 dark:text-emerald-300',
    },
    {
      title: labels.weaknesses,
      hint: labels.weaknessesHint,
      items: labels.weaknessItems,
      className:
        'border-amber-200/70 bg-amber-50/80 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100',
      titleClassName: 'text-amber-800 dark:text-amber-300',
    },
    {
      title: labels.opportunities,
      hint: labels.opportunitiesHint,
      items: labels.opportunityItems,
      className:
        'border-sky-200/70 bg-sky-50/80 text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100',
      titleClassName: 'text-sky-800 dark:text-sky-300',
    },
    {
      title: labels.threats,
      hint: labels.threatsHint,
      items: labels.threatItems,
      className:
        'border-danger-200/70 bg-danger-50/80 text-danger-900 dark:border-danger-900/40 dark:bg-danger-900/30 dark:text-danger-100',
      titleClassName: 'text-danger-800 dark:text-danger-300',
    },
  ];

  return (
    <div className="overflow-hidden rounded-[30px] border border-c-border-subtle bg-[radial-gradient(circle_at_top_left,rgb(var(--c-info-rgb)/0.1),transparent_24%),radial-gradient(circle_at_88%_12%,rgba(34,197,94,0.08),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_20px_70px_-35px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgb(var(--c-info-rgb)/0.18),transparent_24%),radial-gradient(circle_at_88%_12%,rgba(16,185,129,0.12),transparent_20%),linear-gradient(180deg,var(--c-bg),var(--c-surface))]">
      <div className="border-b border-c-border-subtle px-5 py-5 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-c-info/30 bg-c-info/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-c-info">
              {labels.eyebrow}
            </span>
            <span className="inline-flex items-center rounded-full border border-c-border-subtle bg-white/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-secondary dark:bg-white/[0.04]">
              {labels.flow}
            </span>
          </div>
          <span className="inline-flex rounded-full border border-c-border-strong bg-white/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-secondary dark:bg-white/[0.05]">
            {pick(CHIP.tool)}
          </span>
        </div>
        <div className="mt-3 max-w-4xl text-lg font-semibold leading-tight text-c-text">
          {labels.title}
        </div>
        <div className="mt-2 max-w-4xl text-sm leading-relaxed text-c-text-muted">
          {labels.subtitle}
        </div>
      </div>

      <div className="grid gap-4 border-b border-c-border-subtle px-5 py-4 dark:border-white/10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[22px] border border-c-border-subtle bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-secondary">
            {labels.scenario}
          </div>
          <div className="mt-2 text-sm leading-relaxed text-c-text-secondary">
            {labels.scenarioValue}
          </div>
        </div>

        <div className="rounded-[22px] border border-c-info/40 bg-c-info/5 p-4 shadow-sm dark:border-c-info/40">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-c-info">
            {labels.decision}
          </div>
          <div className="mt-2 text-sm font-medium leading-relaxed text-c-text">
            {labels.decisionValue}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {/* Process spine — compact horizontal flow */}
        <div className="rounded-[26px] border border-c-border-subtle bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-secondary">
                {labels.stagesTitle}
              </div>
              <div className="mt-1 text-sm text-c-text-secondary">{labels.stagesSubtitle}</div>
            </div>
            <span className="inline-flex shrink-0 rounded-full border border-c-border-strong bg-white/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-secondary dark:bg-white/[0.05]">
              {pick(CHIP.process)}
            </span>
          </div>

          <div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-c-text-secondary">
            {labels.legend}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {stages.slice(0, 3).map((stage) => (
              <div
                key={stage.id}
                className={`rounded-2xl border border-c-border-subtle bg-gradient-to-br ${stage.tone} p-3 shadow-sm dark:border-white/10`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-c-text text-[11px] font-bold text-c-bg">
                    {stage.id}
                  </div>
                  <div className="text-xs font-semibold leading-tight text-c-text">
                    {stage.title}
                  </div>
                </div>
                <div className="mt-2 flex items-start gap-1.5">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${stage.accent}`} />
                  <div className="text-[11px] leading-relaxed text-c-text-secondary">
                    {stage.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {stages.slice(3).map((stage) => (
              <div
                key={stage.id}
                className={`rounded-2xl border border-c-border-subtle bg-gradient-to-br ${stage.tone} p-3 shadow-sm ring-1 ring-white/30 dark:border-white/10 dark:ring-c-info/20`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-c-text text-[11px] font-bold text-c-bg">
                    {stage.id}
                  </div>
                  <div className="text-xs font-semibold leading-tight text-c-text">
                    {stage.title}
                  </div>
                  {/* NAPRAWA 2026-07-23 (kontrast): było 8 px `text-c-text-muted`
                      na `bg-white/60` NAD GRADIENTEM kafla — zmierzone 2,94:1
                      („Decision") i 3,58:1 („Insight") przy progu AA 4,5:1.
                      Półprzezroczyste tło nad gradientem sprawiało, że realny
                      kontrast zależał od miejsca w gradiencie. Teraz tło jest
                      NIEPRZEZROCZYSTYM tokenem, tekst `c-text-secondary`,
                      a rozmiar 11 px (8 px było poniżej progu czytelności
                      niezależnie od kontrastu). */}
                  {stage.badge ? (
                    <span className="ml-auto inline-flex shrink-0 rounded-full border border-c-border-subtle bg-c-surface px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-c-text-secondary">
                      {stage.badge}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-start gap-1.5">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${stage.accent}`} />
                  <div className="text-[11px] leading-relaxed text-c-text-secondary">
                    {stage.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SWOT Matrix — classic 2x2 grid, full width */}
        <div className="rounded-[26px] border border-c-border-subtle bg-c-surface-raised p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-secondary">
                {labels.signals}
              </div>
              <span className="inline-flex shrink-0 rounded-full border border-c-border-strong bg-white/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-secondary dark:bg-white/[0.05]">
                {pick(CHIP.matrix)}
              </span>
            </div>
            <div className="mt-1 text-sm text-c-text-secondary">{labels.matrixLead}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {signalCards.map((card) => (
              <div
                key={card.title}
                className={`rounded-[22px] border p-4 shadow-sm ${card.className}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div
                    className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${card.titleClassName}`}
                  >
                    {card.title}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-current">
                    {card.hint}
                  </div>
                </div>
                <ul className="mt-3 space-y-2 text-sm leading-relaxed">
                  {card.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current/60" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[22px] border border-c-border-subtle bg-white/85 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="text-xs leading-relaxed text-c-text-secondary">{labels.matrixNote}</div>
          </div>
        </div>

        {/* Tensions, Moves, Outputs — stacked full width below the matrix */}
        <div className="rounded-[26px] border border-amber-200/70 bg-amber-500/5 p-4 shadow-sm dark:border-amber-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800 dark:text-amber-200">
              {labels.tensionPanel}
            </div>
            <span className="inline-flex rounded-full border border-amber-300/50 bg-white/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800 dark:border-amber-800/50 dark:bg-white/[0.05] dark:text-amber-200">
              {labels.stage4Badge}
            </span>
          </div>
          <div className="mt-2 text-sm leading-relaxed text-c-text-secondary">
            {labels.tensionLead}
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-c-text-secondary">
            {labels.tensionItems.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[26px] border border-c-info/30 bg-c-info/5 p-4 shadow-sm dark:border-c-info/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-c-info">
              {labels.moves}
            </div>
            <span className="inline-flex rounded-full border border-c-info/40 bg-white/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-c-info dark:bg-white/[0.05]">
              {labels.stage5Badge}
            </span>
          </div>
          <div className="mt-2 text-sm leading-relaxed text-c-text-secondary">
            {labels.movesLead}
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-c-text-secondary">
            {labels.moveItems.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-c-text" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[26px] border border-emerald-200/70 bg-emerald-500/5 p-4 shadow-sm dark:border-emerald-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-200">
              {labels.outputs}
            </div>
            <span className="inline-flex rounded-full border border-emerald-300/50 bg-white/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-800/50 dark:bg-white/[0.05] dark:text-emerald-200">
              {pick(CHIP.output)}
            </span>
          </div>
          <div className="mt-2 text-sm leading-relaxed text-c-text-secondary">
            {labels.outputsLead}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {outputs.map((item) => (
              <span
                key={item}
                className="inline-flex rounded-full border border-emerald-200/70 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-secondary shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
              >
                {item}
              </span>
            ))}
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-c-text-secondary">
            {labels.outputItems.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-c-border-subtle bg-white/80 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-c-text-secondary dark:border-white/10 dark:bg-white/[0.04]">
          {labels.legend}
        </div>
      </div>
    </div>
  );
}

export default DynamicSwotLibraryGraphic;
