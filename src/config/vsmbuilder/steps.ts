/**
 * VSM Builder — step definitions (UI flow contract).
 *
 * Six steps: `context` and `summary` are consumed by the generic operational-tool
 * shell (they map to `OperationalToolData.context` / `.summary`, NOT to
 * `sections` — see `createInitialOperationalData` in useToolStore.ts, which
 * filters both ids out of the sections map). The remaining four ids become
 * `sections` keys read by the `toVsmSession` adapter (index.ts):
 *   - `steps` : process step map (process box + data box per doctrine §3.1-3.2)
 *   - `demand`: customer-demand framing (doctrine §3.3) — read as a raw number
 *               at `sections['demand'][0]`, not wrapped in an item
 *   - `volume`: monthly unit volume — read the same way at
 *               `sections['volume'][0]`, or from the first step's
 *               `monthlyVolume` field when present (adapter tries that first)
 *   - `moves` : candidate kaizen moves (lever/impact/effort/evidence), scored
 *               by `rankLevers`/`buildW2MoveSequence` in vsmEngine.ts
 */

import type { StepDefinition } from '@/store/useToolStore';

export const VSM_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'VSM Context',
    namePl: 'Kontekst VSM',
    description: 'Define the value stream boundary, trigger, and delivery point',
    descriptionPl: 'Zdefiniuj granicę strumienia wartości, trigger i punkt dostarczenia wartości',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'steps',
    name: 'Process steps (current-state)',
    namePl: 'Kroki procesu (stan obecny)',
    description:
      'Map the process steps end-to-end with C/T, L/T, uptime, %C&A and WIP-before, measured on gemba',
    descriptionPl:
      'Zmapuj kroki procesu end-to-end z C/T, L/T, uptime, %C&A i WIP-przed, zmierzonymi na gemba',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'demand',
    name: 'Customer demand',
    namePl: 'Popyt klienta',
    description: 'Capture customer demand in the period, for takt-time framing',
    descriptionPl: 'Zbierz popyt klienta w okresie, do ramowania takt time',
    required: false,
    aiAssisted: false,
  },
  {
    id: 'volume',
    name: 'Monthly volume',
    namePl: 'Wolumen miesięczny',
    description: 'Capture the monthly unit volume flowing through the stream',
    descriptionPl: 'Zbierz miesięczny wolumen jednostek przepływających przez strumień',
    required: false,
    aiAssisted: false,
  },
  {
    id: 'moves',
    name: 'Kaizen moves',
    namePl: 'Ruchy kaizen',
    description:
      'Capture candidate kaizen moves per lever (flow / bottleneck / waste / rework) with evidence',
    descriptionPl:
      'Zbierz kandydujące ruchy kaizen per dźwignia (przepływ / ograniczenie / marnotrawstwo / przeróbki) z evidence',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Summarize the value-stream baseline and generate initiatives',
    descriptionPl: 'Podsumuj bazę strumienia wartości i wygeneruj inicjatywy',
    required: true,
    aiAssisted: true,
  },
];
