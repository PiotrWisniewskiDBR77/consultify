import type { ResultsKPI } from './kpiDomain';

export interface SignalSheetKpiItem {
  id: string;
  name: string;
  initiativeName?: string;
  ownerName?: string;
  unit?: string | null;
  latestValue?: number | null;
  targetValue?: number | null;
  latestMeasurementDate?: string | null;
  measurementFrequency?: ResultsKPI['measurementFrequency'];
  observationPhase?: ResultsKPI['observationPhase'];
  needsEntry: boolean;
}

export interface SignalSheetRecord {
  id: string;
  title: string;
  kind: 'generated' | 'manual-ai';
  ownerLabel: string;
  dueDate: string;
  dueLabel: string;
  statusLabel: string;
  statusTone: 'slate' | 'amber' | 'red' | 'emerald' | 'primary';
  frequencyLabel: string;
  phaseLabel: string;
  summary: string;
  instructions: string;
  requiredInputs: string[];
  updatedAt?: string | null;
  items: SignalSheetKpiItem[];
}
