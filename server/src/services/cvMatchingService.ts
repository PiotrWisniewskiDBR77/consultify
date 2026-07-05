/**
 * CV Matching Service (T067)
 * CV ingestion, text extraction, competency mapping, and candidate matching engine.
 * Privacy-safe: PII redaction in logs/prompts, human approval required.
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import PDFParserService from './pdfParserService.js';
import logger from '../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CandidateProfile {
  id: string;
  organizationId: string;
  displayName: string;
  email: string | null;
  candidateType: 'internal' | 'external' | 'vendor';
  userId: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface CandidateDocument {
  id: string;
  candidateId: string;
  organizationId: string;
  originalFilename: string;
  storedPath: string;
  fileType: 'pdf' | 'docx' | 'txt';
  status: string;
  extractedSections: Record<string, string>;
}

export interface CompetencySignal {
  id: string;
  candidateId: string;
  documentId: string;
  capabilityId: string;
  inferredLevel: number;
  confidence: number;
  evidenceSnippets: string[];
  approved: boolean;
  manualOverrideLevel: number | null;
}

export interface MatchResult {
  candidateId: string;
  displayName: string;
  matchScore: number;
  explanation: Record<string, any>;
  missingEvidence: string[];
}

// ---------------------------------------------------------------------------
// PII Redaction
// ---------------------------------------------------------------------------

const PII_PATTERNS = [
  /\b[\w.+-]+@[\w-]+\.[\w.]+\b/gi,
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  /\b\d{2}[-/]\d{2}[-/]\d{4}\b/g,
  /\b\d{4}[-/]\d{2}[-/]\d{2}\b/g,
  /\b\d{2,3}[-.]?\d{3}[-.]?\d{2}[-.]?\d{2}\b/g,
  /\b(?:ul\.|al\.|os\.)\s*[\w\s]+\d+/gi,
];

function redactPII(text: string): string {
  let result = text;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

// ---------------------------------------------------------------------------
// CV Section Extraction
// ---------------------------------------------------------------------------

const SECTION_KEYWORDS: Record<string, RegExp[]> = {
  experience: [/experience/i, /work\s*history/i, /employment/i, /doświadczenie/i, /praca/i],
  skills: [/skills/i, /competenc/i, /technologies/i, /umiejętności/i, /kompetencje/i],
  education: [/education/i, /academic/i, /university/i, /wykształcenie/i, /edukacja/i],
  certifications: [/certific/i, /license/i, /certyfikat/i, /uprawnienia/i],
  summary: [/summary/i, /profile/i, /objective/i, /about/i, /podsumowanie/i, /profil/i],
};

function extractSections(text: string): Record<string, string> {
  const lines = text.split(/\r?\n/);
  const sections: Record<string, string> = {};
  let currentSection = 'unknown';
  const sectionLines: Record<string, string[]> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let matched = false;
    for (const [sectionName, patterns] of Object.entries(SECTION_KEYWORDS)) {
      if (patterns.some((p) => p.test(trimmed)) && trimmed.length < 80) {
        currentSection = sectionName;
        matched = true;
        break;
      }
    }

    if (!matched) {
      if (!sectionLines[currentSection]) sectionLines[currentSection] = [];
      sectionLines[currentSection].push(trimmed);
    }
  }

  for (const [key, lines] of Object.entries(sectionLines)) {
    sections[key] = lines.join('\n');
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Text Extraction (PDF/DOCX/TXT)
// ---------------------------------------------------------------------------

async function extractText(filePath: string, fileType: string): Promise<string> {
  if (fileType === 'txt') {
    return fs.readFileSync(filePath, 'utf-8');
  }

  if (fileType === 'pdf') {
    try {
      const buffer = fs.readFileSync(filePath);
      return await PDFParserService.extractTextFromBuffer(buffer);
    } catch (err) {
      logger.warn(
        '[CVMatching] PDF parse failed, falling back to raw read:',
        (err as Error).message
      );
      return fs.readFileSync(filePath, 'utf-8');
    }
  }

  if (fileType === 'docx') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || '';
    } catch (err) {
      logger.warn('[CVMatching] DOCX parse failed:', (err as Error).message);
      return fs.readFileSync(filePath, 'utf-8');
    }
  }

  return fs.readFileSync(filePath, 'utf-8');
}

// ---------------------------------------------------------------------------
// Candidate Profile CRUD
// ---------------------------------------------------------------------------

export async function createCandidate(params: {
  organizationId: string;
  displayName: string;
  email?: string;
  candidateType?: string;
  userId?: string;
  notes?: string;
  createdBy: string;
}): Promise<string> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO candidate_profiles (id, organization_id, display_name, email, candidate_type, user_id, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.organizationId,
      params.displayName,
      params.email || null,
      params.candidateType || 'internal',
      params.userId || null,
      params.notes || null,
      params.createdBy,
    ]
  );
  return id;
}

export async function getCandidates(organizationId: string): Promise<any[]> {
  return (
    (await dbAll(
      `SELECT cp.*, 
       (SELECT COUNT(*) FROM candidate_documents cd WHERE cd.candidate_id = cp.id) as document_count,
       (SELECT COUNT(*) FROM candidate_competency_signals cs WHERE cs.candidate_id = cp.id AND cs.approved = TRUE) as approved_signals
     FROM candidate_profiles cp 
     WHERE cp.organization_id = ? AND cp.is_active = TRUE 
     ORDER BY cp.created_at DESC`,
      [organizationId]
    )) || []
  );
}

export async function getCandidate(id: string, organizationId: string): Promise<any> {
  return dbGet(`SELECT * FROM candidate_profiles WHERE id = ? AND organization_id = ?`, [
    id,
    organizationId,
  ]);
}

// ---------------------------------------------------------------------------
// CV Upload & Extraction Pipeline
// ---------------------------------------------------------------------------

export async function uploadCV(params: {
  candidateId: string;
  organizationId: string;
  originalFilename: string;
  storedPath: string;
  fileType: string;
  fileSizeBytes: number;
  uploadedBy: string;
}): Promise<string> {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO candidate_documents (id, candidate_id, organization_id, original_filename, stored_path, file_type, file_size_bytes, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.candidateId,
      params.organizationId,
      params.originalFilename,
      params.storedPath,
      params.fileType,
      params.fileSizeBytes,
      params.uploadedBy,
    ]
  );

  logAccess(id, params.organizationId, params.uploadedBy, 'view');
  return id;
}

export async function extractCV(documentId: string, organizationId: string): Promise<void> {
  const doc = await dbGet(
    `SELECT * FROM candidate_documents WHERE id = ? AND organization_id = ?`,
    [documentId, organizationId]
  );
  if (!doc) throw new Error('Document not found');

  await dbRun(`UPDATE candidate_documents SET status = 'extracting' WHERE id = ?`, [documentId]);

  try {
    const text = await extractText(doc.stored_path, doc.file_type);
    const sections = extractSections(text);
    const safeText = redactPII(text);

    await dbRun(
      `UPDATE candidate_documents SET status = 'extracted', extracted_text = ?, extracted_sections = ?, extracted_at = NOW()
       WHERE id = ?`,
      [safeText, JSON.stringify(sections), documentId]
    );

    logger.info(
      `[CVMatching] Extracted document ${documentId}: ${Object.keys(sections).length} sections`
    );
  } catch (err) {
    await dbRun(`UPDATE candidate_documents SET status = 'error', error_message = ? WHERE id = ?`, [
      (err as Error).message,
      documentId,
    ]);
    throw err;
  }
}

export async function getCandidateDocuments(
  candidateId: string,
  organizationId: string
): Promise<any[]> {
  return (
    (await dbAll(
      `SELECT id, candidate_id, original_filename, file_type, file_size_bytes, status, extracted_at, uploaded_at
     FROM candidate_documents WHERE candidate_id = ? AND organization_id = ? ORDER BY uploaded_at DESC`,
      [candidateId, organizationId]
    )) || []
  );
}

// ---------------------------------------------------------------------------
// Competency Mapping
// ---------------------------------------------------------------------------

export async function mapCompetencies(
  documentId: string,
  organizationId: string
): Promise<CompetencySignal[]> {
  const doc = await dbGet(
    `SELECT * FROM candidate_documents WHERE id = ? AND organization_id = ?`,
    [documentId, organizationId]
  );
  if (!doc) throw new Error('Document not found');
  if (doc.status !== 'extracted') throw new Error('Document not yet extracted');

  await dbRun(`UPDATE candidate_documents SET status = 'mapping' WHERE id = ?`, [documentId]);

  try {
    const sections =
      typeof doc.extracted_sections === 'string'
        ? JSON.parse(doc.extracted_sections)
        : doc.extracted_sections || {};

    const capabilities =
      (await dbAll(
        `SELECT id, name, description, domain FROM capabilities WHERE organization_id = ? AND is_active = TRUE`,
        [organizationId]
      )) || [];

    if (capabilities.length === 0) {
      await dbRun(`UPDATE candidate_documents SET status = 'mapped' WHERE id = ?`, [documentId]);
      return [];
    }

    const textForMapping = redactPII(
      [sections.skills, sections.experience, sections.certifications, sections.summary]
        .filter(Boolean)
        .join('\n\n')
    ).substring(0, 3000);

    const signals: CompetencySignal[] = [];

    for (const cap of capabilities) {
      const { level, confidence, evidence } = inferCompetencyLevel(textForMapping, cap);
      if (level > 0 && confidence >= 0.3) {
        const signalId = uuidv4();
        await dbRun(
          `INSERT INTO candidate_competency_signals 
           (id, candidate_id, document_id, organization_id, capability_id, inferred_level, confidence, evidence_snippets)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            signalId,
            doc.candidate_id,
            documentId,
            organizationId,
            cap.id,
            level,
            confidence,
            JSON.stringify(evidence),
          ]
        );
        signals.push({
          id: signalId,
          candidateId: doc.candidate_id,
          documentId,
          capabilityId: cap.id,
          inferredLevel: level,
          confidence,
          evidenceSnippets: evidence,
          approved: false,
          manualOverrideLevel: null,
        });
      }
    }

    await dbRun(`UPDATE candidate_documents SET status = 'mapped' WHERE id = ?`, [documentId]);
    logger.info(`[CVMatching] Mapped ${signals.length} competencies for document ${documentId}`);
    return signals;
  } catch (err) {
    await dbRun(`UPDATE candidate_documents SET status = 'error', error_message = ? WHERE id = ?`, [
      (err as Error).message,
      documentId,
    ]);
    throw err;
  }
}

function inferCompetencyLevel(
  text: string,
  capability: { id: string; name: string; description: string | null; domain: string }
): { level: number; confidence: number; evidence: string[] } {
  const lowerText = text.toLowerCase();
  const keywords = [
    capability.name.toLowerCase(),
    ...(capability.description || '')
      .toLowerCase()
      .split(/[\s,;]+/)
      .filter((w) => w.length > 3),
  ];

  const matchedKeywords = keywords.filter((kw) => kw.length > 2 && lowerText.includes(kw));
  if (matchedKeywords.length === 0) return { level: 0, confidence: 0, evidence: [] };

  const evidence: string[] = [];
  const sentences = text.split(/[.!?\n]+/).filter((s) => s.trim().length > 10);
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (matchedKeywords.some((kw) => lower.includes(kw))) {
      evidence.push(sentence.trim().substring(0, 200));
      if (evidence.length >= 3) break;
    }
  }

  const seniorKeywords = [
    'lead',
    'manage',
    'architect',
    'senior',
    'principal',
    'director',
    'expert',
    'years of experience',
  ];
  const midKeywords = ['develop', 'implement', 'design', 'optimize', 'build', 'responsible for'];
  const juniorKeywords = ['assist', 'support', 'learn', 'intern', 'junior', 'entry'];

  const fullMatch = evidence.join(' ').toLowerCase();
  let level = 2;
  if (seniorKeywords.some((kw) => fullMatch.includes(kw))) level = 4;
  else if (midKeywords.some((kw) => fullMatch.includes(kw))) level = 3;
  else if (juniorKeywords.some((kw) => fullMatch.includes(kw))) level = 1;

  if (matchedKeywords.length >= 3) level = Math.min(5, level + 1);

  const confidence = Math.min(0.95, 0.3 + matchedKeywords.length * 0.1 + evidence.length * 0.1);

  return {
    level: Math.min(5, Math.max(1, level)),
    confidence: Math.round(confidence * 100) / 100,
    evidence,
  };
}

export async function getCandidateSignals(
  candidateId: string,
  organizationId: string
): Promise<any[]> {
  return (
    (await dbAll(
      `SELECT cs.*, c.name as capability_name, c.domain as capability_domain
     FROM candidate_competency_signals cs
     LEFT JOIN capabilities c ON c.id = cs.capability_id
     WHERE cs.candidate_id = ? AND cs.organization_id = ?
     ORDER BY cs.inferred_level DESC, cs.confidence DESC`,
      [candidateId, organizationId]
    )) || []
  );
}

export async function approveSignal(
  signalId: string,
  organizationId: string,
  approvedBy: string,
  overrideLevel?: number
): Promise<void> {
  const updates =
    overrideLevel != null
      ? `approved = TRUE, approved_by = ?, approved_at = NOW(), manual_override_level = ?, updated_at = NOW()`
      : `approved = TRUE, approved_by = ?, approved_at = NOW(), updated_at = NOW()`;
  const params =
    overrideLevel != null
      ? [approvedBy, overrideLevel, signalId, organizationId]
      : [approvedBy, signalId, organizationId];

  await dbRun(
    `UPDATE candidate_competency_signals SET ${updates} WHERE id = ? AND organization_id = ?`,
    params
  );
}

export async function rejectSignal(signalId: string, organizationId: string): Promise<void> {
  await dbRun(`DELETE FROM candidate_competency_signals WHERE id = ? AND organization_id = ?`, [
    signalId,
    organizationId,
  ]);
}

// ---------------------------------------------------------------------------
// Matching Engine
// ---------------------------------------------------------------------------

export async function matchCandidatesToRequirements(
  organizationId: string,
  initiativeId: string
): Promise<MatchResult[]> {
  const requirements =
    (await dbAll(
      `SELECT cr.*, c.name as capability_name 
     FROM capability_requirements cr
     LEFT JOIN capabilities c ON c.id = cr.capability_id
     WHERE cr.organization_id = ? AND cr.initiative_id = ?`,
      [organizationId, initiativeId]
    )) || [];

  if (requirements.length === 0) return [];

  const candidates =
    (await dbAll(
      `SELECT DISTINCT cp.id, cp.display_name, cp.candidate_type
     FROM candidate_profiles cp
     INNER JOIN candidate_competency_signals cs ON cs.candidate_id = cp.id AND cs.approved = TRUE
     WHERE cp.organization_id = ? AND cp.is_active = TRUE`,
      [organizationId]
    )) || [];

  const results: MatchResult[] = [];

  for (const candidate of candidates) {
    const signals =
      (await dbAll(
        `SELECT capability_id, COALESCE(manual_override_level, inferred_level) as level, confidence, evidence_snippets
       FROM candidate_competency_signals
       WHERE candidate_id = ? AND organization_id = ? AND approved = TRUE`,
        [candidate.id, organizationId]
      )) || [];

    const signalMap = new Map(signals.map((s: any) => [s.capability_id, s]));
    let totalScore = 0;
    let maxScore = 0;
    const explanation: Record<string, any> = {};
    const missingEvidence: string[] = [];

    for (const req of requirements) {
      const weight = req.priority === 'required' ? 2 : 1;
      maxScore += 5 * weight;

      const signal = signalMap.get(req.capability_id);
      if (signal) {
        const effectiveLevel = signal.level;
        const score = Math.min(5, effectiveLevel) * weight;
        const meetsMin = effectiveLevel >= (req.min_level || 1);
        totalScore += score;
        explanation[req.capability_name || req.capability_id] = {
          required: req.min_level,
          actual: effectiveLevel,
          meets: meetsMin,
          confidence: signal.confidence,
          weight,
        };
      } else {
        missingEvidence.push(req.capability_name || req.capability_id);
        explanation[req.capability_name || req.capability_id] = {
          required: req.min_level,
          actual: 0,
          meets: false,
          confidence: 0,
          weight,
          note: 'No evidence in CV',
        };
      }
    }

    const matchScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    results.push({
      candidateId: candidate.id,
      displayName: candidate.display_name,
      matchScore,
      explanation,
      missingEvidence,
    });
  }

  results.sort((a, b) => b.matchScore - a.matchScore);

  for (const r of results) {
    await dbRun(
      `INSERT INTO candidate_match_results (id, candidate_id, organization_id, initiative_id, match_score, explanation, missing_evidence)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        r.candidateId,
        organizationId,
        initiativeId,
        r.matchScore,
        JSON.stringify(r.explanation),
        JSON.stringify(r.missingEvidence),
      ]
    );
  }

  return results;
}

export async function applyToUserProfile(
  candidateId: string,
  organizationId: string,
  userId: string,
  approvedBy: string
): Promise<number> {
  const signals =
    (await dbAll(
      `SELECT * FROM candidate_competency_signals
     WHERE candidate_id = ? AND organization_id = ? AND approved = TRUE`,
      [candidateId, organizationId]
    )) || [];

  let applied = 0;
  for (const signal of signals) {
    const level = signal.manual_override_level || signal.inferred_level;
    const existing = await dbGet(
      `SELECT id, level FROM user_capabilities WHERE user_id = ? AND capability_id = ? AND organization_id = ?`,
      [userId, signal.capability_id, organizationId]
    );

    if (existing) {
      if (level > existing.level) {
        await dbRun(
          `UPDATE user_capabilities SET level = ?, notes = COALESCE(notes, '') || ' [Updated from CV]', updated_at = NOW()
           WHERE id = ?`,
          [level, existing.id]
        );
        applied++;
      }
    } else {
      await dbRun(
        `INSERT INTO user_capabilities (id, user_id, organization_id, capability_id, level, notes, created_at)
         VALUES (?, ?, ?, ?, ?, '[Mapped from CV]', NOW())`,
        [uuidv4(), userId, organizationId, signal.capability_id, level]
      );
      applied++;
    }
  }

  return applied;
}

// ---------------------------------------------------------------------------
// Delete CV (right to be forgotten)
// ---------------------------------------------------------------------------

export async function deleteCV(
  documentId: string,
  organizationId: string,
  deletedBy: string
): Promise<void> {
  const doc = await dbGet(
    `SELECT stored_path FROM candidate_documents WHERE id = ? AND organization_id = ?`,
    [documentId, organizationId]
  );
  if (!doc) throw new Error('Document not found');

  await dbRun(
    `DELETE FROM candidate_competency_signals WHERE document_id = ? AND organization_id = ?`,
    [documentId, organizationId]
  );
  await dbRun(`DELETE FROM candidate_documents WHERE id = ? AND organization_id = ?`, [
    documentId,
    organizationId,
  ]);

  try {
    if (fs.existsSync(doc.stored_path)) fs.unlinkSync(doc.stored_path);
  } catch {
    /* best effort file cleanup */
  }

  logAccess(documentId, organizationId, deletedBy, 'delete');
  logger.info(`[CVMatching] Deleted CV ${documentId} (right to be forgotten)`);
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

function logAccess(
  documentId: string,
  organizationId: string,
  userId: string,
  action: string
): void {
  dbRun(
    `INSERT INTO cv_access_log (id, document_id, organization_id, accessed_by, action) VALUES (?, ?, ?, ?, ?)`,
    [uuidv4(), documentId, organizationId, userId, action]
  ).catch((err: unknown) => logger.warn('[CVMatching] access log insert failed', err));
}
