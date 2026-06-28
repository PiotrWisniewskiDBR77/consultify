import React from 'react';

export function NarrativeEngineLibraryGraphic({
  isPolish,
  variant = 'process',
}: {
  isPolish: boolean;
  variant?: 'process' | 'example';
}) {
  const isExample = variant === 'example';
  const labels = isPolish
    ? {
        eyebrow: 'Narrative Engine',
        title: isExample
          ? 'Przykład: od jednej myśli przewodniej do domu komunikatu z filarami'
          : 'Jak Narrative Engine układa dom komunikatu wokół jednej myśli',
        subtitle: isExample
          ? 'Ten case pokazuje, że narracja to nie zbiór slajdów. Najpierw ustala jedną myśl przewodnią (dach), potem filary (kolumny), które ją utrzymują, i dowody, które każdy filar dźwigają.'
          : 'To nie luźny zestaw wiadomości. Najpierw ustawiamy odbiorcę i myśl przewodnią (dach), potem 3-4 filary (kolumny), każdy z własnym twierdzeniem i dowodami, a kolor pokazuje rezonans u odbiorcy.',
        scenario: isExample ? 'Sytuacja' : 'Punkt wyjścia',
        scenarioValue: isExample
          ? 'Zarząd słyszy dziesięć argumentów naraz i żaden nie zostaje w głowie. Pytanie brzmi: jaka jest jedna myśl, którą mają zapamiętać, i które trzy filary realnie ją utrzymują.'
          : 'Sesja startuje od odbiorcy, celu i myśli przewodniej. Bez dachu filary nie mają czego trzymać, a dowody są oderwane od decyzji.',
        decision: isExample ? 'Pytanie decyzyjne' : 'Efekt sesji',
        decisionValue: isExample
          ? 'Która jedna myśl ma zostać w głowie i które filary z dowodami ją utrzymają?'
          : 'Jedna myśl przewodnia jako dach, 3-4 filary z twierdzeniem i dowodami, oznaczone rezonansem u odbiorcy, gotowe do narracji, raportu i decka.',
        stagesTitle: '5 kroków pracy',
        stages: [
          ['Brief', 'Odbiorca, cel, sygnał sukcesu', 'bg-sky-500'],
          ['Myśl przewodnia', 'Jedno zdanie, które ma zostać', 'bg-sky-500'],
          ['Filary', 'Kolumny, które utrzymują dach', 'bg-blue-500'],
          ['Dowody', 'Czym każdy filar jest poparty', 'bg-amber-500'],
          ['Narracja & outputy', 'Wątki, ruchy, raport, deck', 'bg-emerald-500'],
        ] as Array<[string, string, string]>,
        houseTitle: 'Dom komunikatu',
        houseHint: 'Dach + filary',
        coreLabel: 'Myśl przewodnia',
        coreValue: 'Bez AI tracimy rynek w 18 miesięcy',
        proofWord: 'dowody',
        legendTitle: 'Rezonans u odbiorcy',
        legend: [
          ['high', 'Wysoki rezonans'],
          ['medium', 'Średni rezonans'],
          ['low', 'Niski rezonans'],
        ] as Array<[string, string]>,
        footer:
          'Narrative Engine = brief -> myśl przewodnia -> filary -> dowody -> narracja -> outputy',
        pillars: [
          { title: 'Tempo rynku', message: 'Konkurenci już wdrażają', proofs: 3, resonance: 'high' as const },
          { title: 'Marża', message: 'Automatyzacja podnosi marżę', proofs: 2, resonance: 'high' as const },
          { title: 'Talent', message: 'Zespół jest gotowy', proofs: 2, resonance: 'medium' as const },
          { title: 'Ryzyko', message: 'Pilot ogranicza ryzyko', proofs: 1, resonance: 'low' as const },
        ],
      }
    : {
        eyebrow: 'Narrative Engine',
        title: isExample
          ? 'Example: from one core message to a message house with pillars'
          : 'How Narrative Engine builds a message house around one idea',
        subtitle: isExample
          ? 'This case shows that a narrative is not a pile of slides. It sets one core message first (the roof), then the pillars (columns) that hold it up, and the proof points each pillar carries.'
          : 'This is not a loose set of messages. First we frame the audience and core message (the roof), then 3-4 pillars (columns), each with its own claim and proof, with color showing audience resonance.',
        scenario: isExample ? 'Situation' : 'Starting point',
        scenarioValue: isExample
          ? 'The board hears ten arguments at once and none of them sticks. The real question is which single idea they should remember and which three pillars actually hold it up.'
          : 'The session starts with the audience, goal, and core message. Without a roof the pillars have nothing to hold, and proof points are detached from the decision.',
        decision: isExample ? 'Decision question' : 'Session outcome',
        decisionValue: isExample
          ? 'Which single idea should stick, and which pillars with proof points hold it up?'
          : 'One core message as the roof, 3-4 pillars with a claim and proof points, tagged by audience resonance, ready for narrative, report, and deck.',
        stagesTitle: '5 working steps',
        stages: [
          ['Brief', 'Audience, goal, success signal', 'bg-sky-500'],
          ['Core message', 'One sentence that should stick', 'bg-sky-500'],
          ['Pillars', 'Columns that hold the roof', 'bg-blue-500'],
          ['Proof', 'What backs each pillar', 'bg-amber-500'],
          ['Narrative & outputs', 'Threads, moves, report, deck', 'bg-emerald-500'],
        ] as Array<[string, string, string]>,
        houseTitle: 'Message house',
        houseHint: 'Roof + pillars',
        coreLabel: 'Core message',
        coreValue: 'Without AI we lose the market in 18 months',
        proofWord: 'proof',
        legendTitle: 'Audience resonance',
        legend: [
          ['high', 'High resonance'],
          ['medium', 'Medium resonance'],
          ['low', 'Low resonance'],
        ] as Array<[string, string]>,
        footer:
          'Narrative Engine = brief -> core message -> pillars -> proof -> narrative -> outputs',
        pillars: [
          { title: 'Market pace', message: 'Competitors already shipping', proofs: 3, resonance: 'high' as const },
          { title: 'Margin', message: 'Automation lifts margin', proofs: 2, resonance: 'high' as const },
          { title: 'Talent', message: 'The team is ready', proofs: 2, resonance: 'medium' as const },
          { title: 'Risk', message: 'A pilot caps the risk', proofs: 1, resonance: 'low' as const },
        ],
      };

  // Resonance drives the column accent: high = emerald, medium = slate, low = muted.
  const resonanceColumn: Record<'high' | 'medium' | 'low', string> = {
    high: 'border-emerald-300/70 bg-emerald-500/10 dark:border-emerald-900/40',
    medium: 'border-slate-300/70 bg-slate-500/10 dark:border-navy-700',
    low: 'border-slate-200/70 bg-slate-300/10 dark:border-navy-800',
  };
  const resonanceDot: Record<'high' | 'medium' | 'low', string> = {
    high: 'bg-emerald-500',
    medium: 'bg-slate-400',
    low: 'bg-slate-300',
  };

  return (
    <div className="overflow-hidden rounded-[30px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.13),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(245,158,11,0.1),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_20px_70px_-35px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_26%),radial-gradient(circle_at_90%_10%,rgba(245,158,11,0.12),transparent_22%),linear-gradient(180deg,#0b1020,#0a0f1b)]">
      <div className="border-b border-slate-200/70 px-5 py-5 dark:border-white/10">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          {labels.eyebrow}
        </div>
        <h3 className="mt-2 text-xl font-bold leading-tight text-slate-950 dark:text-white">
          {labels.title}
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {labels.subtitle}
        </p>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              {labels.scenario}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {labels.scenarioValue}
            </p>
            <div className="mt-4 rounded-xl border border-emerald-200/70 bg-emerald-500/5 p-3 dark:border-emerald-900/40">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                {labels.decision}
              </div>
              <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                {labels.decisionValue}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              {labels.stagesTitle}
            </div>
            <div className="space-y-2">
              {labels.stages.map(([title, value, accent], index) => (
                <div
                  key={title}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-navy-900/60"
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent} text-xs font-bold text-white`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40">
            <div className="mb-1 flex items-baseline justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                {labels.houseTitle}
              </div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                {labels.houseHint}
              </div>
            </div>

            {/* Message house: the core message is the roof/apex, the pillars are the columns
                beneath it. Column color = audience resonance. */}
            <div className="mt-3">
              {/* Roof / apex: the single core message everything holds up. */}
              <div className="rounded-t-2xl border border-emerald-300/70 bg-emerald-500/15 px-3 py-2.5 text-center dark:border-emerald-900/50 dark:bg-emerald-900/25">
                <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                  {labels.coreLabel}
                </div>
                <div className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                  {labels.coreValue}
                </div>
              </div>

              {/* Lintel under the roof, spanning the pillars. */}
              <div className="mx-auto h-1.5 w-[92%] bg-emerald-300/60 dark:bg-emerald-900/50" />

              {/* Pillar columns standing under the roof. */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {labels.pillars.map((pillar) => (
                  <div
                    key={pillar.title}
                    className={`flex min-h-[112px] flex-col rounded-b-xl border border-t-0 p-2.5 ${resonanceColumn[pillar.resonance]}`}
                  >
                    <div className="flex items-start gap-1.5">
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${resonanceDot[pillar.resonance]}`}
                      />
                      <div
                        className="text-[12px] font-semibold leading-tight text-slate-900 dark:text-white"
                        title={pillar.title}
                      >
                        {pillar.title}
                      </div>
                    </div>
                    <div className="mt-1 flex-1 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                      {pillar.message}
                    </div>
                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                      {pillar.proofs} {labels.proofWord}
                    </div>
                  </div>
                ))}
              </div>

              {/* Foundation slab the pillars rest on. */}
              <div className="mx-auto h-1.5 w-[96%] rounded-b-md bg-slate-300/70 dark:bg-navy-700" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              {labels.legendTitle}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {labels.legend.map(([resonance, text]) => (
                <div key={resonance} className="flex items-center gap-1.5">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${resonanceDot[resonance as 'high' | 'medium' | 'low']}`}
                  />
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-900/40 dark:text-emerald-200">
            {labels.footer}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NarrativeEngineLibraryGraphic;
