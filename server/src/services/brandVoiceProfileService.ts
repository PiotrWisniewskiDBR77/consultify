/**
 * Brand Voice Profile Service
 *
 * Manages per-organization brand voice profiles that control report tone,
 * vocabulary, hedging rules, and compliance constraints.
 */

import { v4 as uuidv4 } from 'uuid';

import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface BrandVoiceProfile {
  id: string;
  organizationId: string;
  registerPreferences: {
    default: 'executive' | 'professional' | 'technical' | 'narrative';
    overrides: Record<string, string>;
  };
  vocabularyPreferences: {
    preferred: string[];
    forbidden: string[];
  };
  hedgingRules: {
    requireEvidenceForRecommendations: boolean;
    allowSpeculativeLanguage: boolean;
    maxHedgingPhrases: number;
  };
  complianceMode: boolean;
  complianceRules: {
    noMarketingLanguage: boolean;
    requireSourceForClaims: boolean;
    requireNextStepForRecommendations: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface ContentViolation {
  type: string;
  message: string;
  position?: number;
}

// ==========================================
// DEFAULTS
// ==========================================

const DEFAULT_PROFILE: Omit<
  BrandVoiceProfile,
  'id' | 'organizationId' | 'createdAt' | 'updatedAt'
> = {
  registerPreferences: {
    default: 'professional',
    overrides: {},
  },
  vocabularyPreferences: {
    preferred: [],
    forbidden: [],
  },
  hedgingRules: {
    requireEvidenceForRecommendations: true,
    allowSpeculativeLanguage: false,
    maxHedgingPhrases: 3,
  },
  complianceMode: false,
  complianceRules: {
    noMarketingLanguage: false,
    requireSourceForClaims: false,
    requireNextStepForRecommendations: false,
  },
};

// ==========================================
// HELPERS
// ==========================================

function safeParseJSON<T>(value: unknown, fallback: T): T {
  if (!value || typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToProfile(row: any): BrandVoiceProfile {
  return {
    id: row.id,
    organizationId: row.organization_id,
    registerPreferences: safeParseJSON(
      row.register_preferences,
      DEFAULT_PROFILE.registerPreferences
    ),
    vocabularyPreferences: safeParseJSON(
      row.vocabulary_preferences,
      DEFAULT_PROFILE.vocabularyPreferences
    ),
    hedgingRules: safeParseJSON(row.hedging_rules, DEFAULT_PROFILE.hedgingRules),
    complianceMode: Boolean(row.compliance_mode),
    complianceRules: safeParseJSON(row.compliance_rules, DEFAULT_PROFILE.complianceRules),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// HEDGING PHRASES (used by validateContent)
// ==========================================

const HEDGING_PHRASES = [
  'it seems',
  'it appears',
  'possibly',
  'perhaps',
  'might',
  'could potentially',
  'it is believed',
  'we think',
  'in our opinion',
  'arguably',
  'presumably',
  'supposedly',
  'to some extent',
];

const MARKETING_PHRASES = [
  'best in class',
  'world-class',
  'cutting-edge',
  'revolutionary',
  'game-changing',
  'industry-leading',
  'unparalleled',
  'groundbreaking',
  'next-generation',
  'state-of-the-art',
  'synergy',
  'paradigm shift',
  'disruptive',
  'transformative',
  'leverage',
  'holistic',
  'seamless',
  'turnkey',
  'mission-critical',
  'bleeding-edge',
];

// ==========================================
// SERVICE FUNCTIONS
// ==========================================

export async function getOrCreateBrandVoice(organizationId: string): Promise<BrandVoiceProfile> {
  try {
    const row = await dbGet(
      'SELECT * FROM organization_brand_voice_profiles WHERE organization_id = ?',
      [organizationId]
    );

    if (row) {
      return rowToProfile(row);
    }

    const now = new Date().toISOString();
    const id = uuidv4();

    await dbRun(
      `INSERT INTO organization_brand_voice_profiles
       (id, organization_id, register_preferences, vocabulary_preferences,
        hedging_rules, compliance_mode, compliance_rules, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        organizationId,
        JSON.stringify(DEFAULT_PROFILE.registerPreferences),
        JSON.stringify(DEFAULT_PROFILE.vocabularyPreferences),
        JSON.stringify(DEFAULT_PROFILE.hedgingRules),
        0,
        JSON.stringify(DEFAULT_PROFILE.complianceRules),
        now,
        now,
      ]
    );

    return {
      id,
      organizationId,
      ...DEFAULT_PROFILE,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    logger.warn('[BrandVoice] Failed to get/create profile, returning defaults', { error });
    const now = new Date().toISOString();
    return {
      id: 'default',
      organizationId,
      ...DEFAULT_PROFILE,
      createdAt: now,
      updatedAt: now,
    };
  }
}

export async function updateBrandVoice(
  organizationId: string,
  updates: Partial<BrandVoiceProfile>
): Promise<BrandVoiceProfile> {
  const existing = await getOrCreateBrandVoice(organizationId);
  const now = new Date().toISOString();

  const merged: BrandVoiceProfile = {
    ...existing,
    registerPreferences: updates.registerPreferences ?? existing.registerPreferences,
    vocabularyPreferences: updates.vocabularyPreferences ?? existing.vocabularyPreferences,
    hedgingRules: updates.hedgingRules ?? existing.hedgingRules,
    complianceMode: updates.complianceMode ?? existing.complianceMode,
    complianceRules: updates.complianceRules ?? existing.complianceRules,
    updatedAt: now,
  };

  await dbRun(
    `UPDATE organization_brand_voice_profiles
     SET register_preferences = ?,
         vocabulary_preferences = ?,
         hedging_rules = ?,
         compliance_mode = ?,
         compliance_rules = ?,
         updated_at = ?
     WHERE organization_id = ?`,
    [
      JSON.stringify(merged.registerPreferences),
      JSON.stringify(merged.vocabularyPreferences),
      JSON.stringify(merged.hedgingRules),
      merged.complianceMode ? 1 : 0,
      JSON.stringify(merged.complianceRules),
      now,
      organizationId,
    ]
  );

  logger.info('[BrandVoice] Updated brand voice profile', { organizationId });
  return merged;
}

export function validateContent(
  content: string,
  profile: BrandVoiceProfile
): { passed: boolean; violations: ContentViolation[] } {
  const violations: ContentViolation[] = [];
  const lowerContent = content.toLowerCase();

  // Check forbidden words
  for (const word of profile.vocabularyPreferences.forbidden) {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed) continue;
    const idx = lowerContent.indexOf(trimmed);
    if (idx !== -1) {
      violations.push({
        type: 'forbidden_word',
        message: `Forbidden word/phrase found: "${word.trim()}"`,
        position: idx,
      });
    }
  }

  // Check hedging phrases limit
  if (profile.hedgingRules.maxHedgingPhrases >= 0) {
    let hedgingCount = 0;
    for (const phrase of HEDGING_PHRASES) {
      let searchIdx = 0;
      while (true) {
        const foundIdx = lowerContent.indexOf(phrase, searchIdx);
        if (foundIdx === -1) break;
        hedgingCount++;
        if (hedgingCount === 1 && !profile.hedgingRules.allowSpeculativeLanguage) {
          violations.push({
            type: 'speculative_language',
            message: `Speculative/hedging language detected: "${phrase}"`,
            position: foundIdx,
          });
        }
        searchIdx = foundIdx + phrase.length;
      }
    }
    if (hedgingCount > profile.hedgingRules.maxHedgingPhrases) {
      violations.push({
        type: 'excessive_hedging',
        message: `Too many hedging phrases: ${hedgingCount} found, max ${profile.hedgingRules.maxHedgingPhrases} allowed`,
      });
    }
  }

  // Compliance checks
  if (profile.complianceMode) {
    if (profile.complianceRules.noMarketingLanguage) {
      for (const phrase of MARKETING_PHRASES) {
        const idx = lowerContent.indexOf(phrase);
        if (idx !== -1) {
          violations.push({
            type: 'marketing_language',
            message: `Marketing language detected: "${phrase}"`,
            position: idx,
          });
        }
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

/*
 * SQL for the organization_brand_voice_profiles table:
 *
 * CREATE TABLE IF NOT EXISTS organization_brand_voice_profiles (
 *   id TEXT PRIMARY KEY,
 *   organization_id TEXT NOT NULL UNIQUE,
 *   register_preferences TEXT DEFAULT '{}',
 *   vocabulary_preferences TEXT DEFAULT '{}',
 *   hedging_rules TEXT DEFAULT '{}',
 *   compliance_mode BOOLEAN DEFAULT FALSE,
 *   compliance_rules TEXT DEFAULT '{}',
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 * );
 *
 * CREATE INDEX IF NOT EXISTS idx_brand_voice_org
 *   ON organization_brand_voice_profiles(organization_id);
 */
