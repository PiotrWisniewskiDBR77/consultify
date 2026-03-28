/**
 * Learning Store for the LLM Financial Pipeline.
 *
 * Persists lessons learned between pipeline iterations:
 * - Mapping corrections (label → canonicalId overrides)
 * - Document-specific notes (e.g. "sparse PDF", "split BS section")
 * - Value corrections (sign fixes, column selection fixes)
 * - Prompt improvements discovered during evaluation
 *
 * Storage: JSON file on disk (not DB — this is a development/tuning tool)
 */
import fs from 'fs';
import path from 'path';

const STORE_PATH = path.resolve(process.cwd(), 'server/scripts/pipeline-learnings.json');

export interface MappingLesson {
  originalLabel: string;
  correctCanonicalId: string;
  documentPattern?: string;
  statementType: string;
  confidence: number;
  learnedAt: string;
  iteration: number;
}

export interface DocumentLesson {
  documentName: string;
  statementType: string;
  lesson: string;
  severity: 'critical' | 'important' | 'minor';
  learnedAt: string;
  iteration: number;
}

export interface ValueCorrection {
  canonicalId: string;
  documentName: string;
  expectedValue: number;
  extractedValue: number;
  errorPct: number;
  possibleCause: string;
  learnedAt: string;
  iteration: number;
}

export interface PromptImprovement {
  phase: 'phase2' | 'phase3';
  statementType: string;
  improvement: string;
  learnedAt: string;
  iteration: number;
}

export interface LearningStoreData {
  version: number;
  lastIteration: number;
  mappingLessons: MappingLesson[];
  documentLessons: DocumentLesson[];
  valueCorrections: ValueCorrection[];
  promptImprovements: PromptImprovement[];
  iterationHistory: Array<{
    iteration: number;
    timestamp: string;
    accuracy: number;
    totalChecks: number;
    passed: number;
    failed: number;
    improvements: string[];
  }>;
}

function createEmpty(): LearningStoreData {
  return {
    version: 1,
    lastIteration: 0,
    mappingLessons: [],
    documentLessons: [],
    valueCorrections: [],
    promptImprovements: [],
    iterationHistory: [],
  };
}

export function loadLearningStore(): LearningStoreData {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      return JSON.parse(raw) as LearningStoreData;
    }
  } catch {
    // corrupted file — start fresh
  }
  return createEmpty();
}

export function saveLearningStore(data: LearningStoreData): void {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function buildLearningContext(
  store: LearningStoreData,
  documentName: string,
  statementType: string
): string {
  const parts: string[] = [];

  // Mapping lessons for this statement type
  const mappings = store.mappingLessons.filter((l) => l.statementType === statementType);
  if (mappings.length > 0) {
    parts.push('LEARNED MAPPING RULES (from previous iterations):');
    for (const m of mappings.slice(-30)) {
      parts.push(
        `  - "${m.originalLabel}" → ${m.correctCanonicalId} (conf=${m.confidence.toFixed(2)})`
      );
    }
  }

  // Document-specific lessons
  const docLessons = store.documentLessons.filter(
    (l) => l.documentName === documentName || l.documentName === '*'
  );
  if (docLessons.length > 0) {
    parts.push('\nDOCUMENT-SPECIFIC LESSONS:');
    for (const d of docLessons) {
      parts.push(`  - [${d.severity}] ${d.lesson}`);
    }
  }

  // Value corrections for this document
  const corrections = store.valueCorrections.filter((v) => v.documentName === documentName);
  if (corrections.length > 0) {
    parts.push('\nPREVIOUS VALUE ERRORS (avoid repeating):');
    for (const c of corrections) {
      parts.push(
        `  - ${c.canonicalId}: extracted=${c.extractedValue} but expected=${c.expectedValue} (${c.errorPct.toFixed(1)}% off). Cause: ${c.possibleCause}`
      );
    }
  }

  // Prompt improvements
  const improvements = store.promptImprovements.filter(
    (p) => p.statementType === statementType || p.statementType === '*'
  );
  if (improvements.length > 0) {
    parts.push('\nADDITIONAL INSTRUCTIONS (learned from errors):');
    for (const imp of improvements) {
      parts.push(`  - ${imp.improvement}`);
    }
  }

  return parts.join('\n');
}

export function addIterationResult(
  store: LearningStoreData,
  iteration: number,
  accuracy: number,
  totalChecks: number,
  passed: number,
  failed: number,
  improvements: string[]
): void {
  store.lastIteration = iteration;
  store.iterationHistory.push({
    iteration,
    timestamp: new Date().toISOString(),
    accuracy,
    totalChecks,
    passed,
    failed,
    improvements,
  });
}
