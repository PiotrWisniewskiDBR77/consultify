/**
 * Traceability types (V3-A01)
 * Every output (Initiative/Report/Deck) must have a canonical source (source_type + source_id).
 */

export type SourceType =
  | 'tool_session'
  | 'assessment'
  | 'financial_analysis'
  | 'mywork'
  | 'interview'
  | 'manual';

export interface TraceabilityMetadata {
  sourceType: SourceType;
  sourceId: string;
  sourceTitle?: string;
  sourceSnapshot?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

export interface MyWorkDerivedSource {
  type: 'idea' | 'notebook' | 'task' | 'decision';
  id: string;
  title: string;
}

export interface MyWorkSession {
  id: string;
  type: 'MYWORK';
  derivedFrom: MyWorkDerivedSource[];
  snapshotJson: Record<string, unknown>;
  createdAt: string;
  status: string;
}
