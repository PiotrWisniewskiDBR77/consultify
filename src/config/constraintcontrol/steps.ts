/**
 * Constraint Control — wizard step definitions.
 *
 * SSOT for the 5-step operational flow that feeds `toConstraintSession`
 * (src/config/constraintcontrol/index.ts): the adapter reads sections keyed
 * `steps`/`process` (process steps + capacity/demand/queue), `throughput`/
 * `finance` (T/I/OE inputs) and `moves`/`focus` (Five-Focusing-Steps move
 * candidates). Step ids below are the canonical section keys the store
 * persists `OperationalItem[]` under for this tool.
 */

import type { StepDefinition } from '@/store/useToolStore';

export const CONSTRAINT_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Constraint Context',
    namePl: 'Kontekst Ograniczenia',
    description: 'Define the system, goal and symptom that triggered the constraint hunt',
    descriptionPl: 'Zdefiniuj system, cel i objaw, który uruchomił poszukiwanie ograniczenia',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'steps',
    name: 'Process Steps & Queues',
    namePl: 'Kroki Procesu i Kolejki',
    description: 'Map process steps with capacity, demand and queue evidence to locate the constraint',
    descriptionPl: 'Zmapuj kroki procesu z capacity, demand i dowodem z kolejki, by zlokalizować ograniczenie',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'throughput',
    name: 'Throughput Accounting',
    namePl: 'Rachunek Przerobu (T/I/OE)',
    description: 'Capture Sales, Totally Variable Cost, Operating Expense and Investment for the system',
    descriptionPl: 'Wprowadź Sprzedaż, Całkowicie Zmienny Koszt, Koszty Operacyjne i Inwestycję dla systemu',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'moves',
    name: 'Five Focusing Steps Moves',
    namePl: 'Ruchy Pięciu Kroków Fokusujących',
    description: 'Draft Identify/Exploit/Subordinate/Elevate (and Policy) moves in TOC discipline order',
    descriptionPl: 'Zaprojektuj ruchy Identify/Exploit/Subordinate/Elevate (i Policy) w dyscyplinie kolejności TOC',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Summarize the constraint diagnosis and generate initiatives',
    descriptionPl: 'Podsumuj diagnozę ograniczenia i wygeneruj inicjatywy',
    required: true,
    aiAssisted: true,
  },
];
