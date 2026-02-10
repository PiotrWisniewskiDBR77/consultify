/**
 * Duplicate detection utility for initiatives
 * Checks for similar initiative titles using Levenshtein distance
 */

export interface Initiative {
  id: string;
  name?: string;
  title?: string;
  status?: string;
}

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits needed to transform one string into another
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Normalize string for comparison (lowercase, trim, remove extra spaces)
 */
function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if two strings are similar based on Levenshtein distance
 * Returns true if similarity ratio is above threshold (default 0.8 = 80% similar)
 */
function isSimilar(str1: string, str2: string, threshold: number = 0.8): boolean {
  const normalized1 = normalizeString(str1);
  const normalized2 = normalizeString(str2);

  // Exact match after normalization
  if (normalized1 === normalized2) {
    return true;
  }

  // Check if one contains the other (for cases like "Initiative A" vs "Initiative A (copy)")
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }

  // Calculate similarity ratio
  const maxLen = Math.max(normalized1.length, normalized2.length);
  if (maxLen === 0) return false;

  const distance = levenshteinDistance(normalized1, normalized2);
  const similarity = 1 - distance / maxLen;

  return similarity >= threshold;
}

/**
 * Check for duplicate initiatives
 * @param title - The title of the new initiative to check
 * @param existingInitiatives - Array of existing initiatives (including archived/deleted ones)
 * @param excludeId - Optional ID to exclude from check (for updates)
 * @returns The name/title of the duplicate initiative, or null if no duplicate found
 */
export function checkDuplicateInitiative(
  title: string,
  existingInitiatives: Initiative[],
  excludeId?: string
): string | null {
  if (!title || !title.trim()) {
    return null;
  }

  const normalizedTitle = normalizeString(title);

  for (const initiative of existingInitiatives) {
    // Skip excluded initiative (for updates)
    if (excludeId && initiative.id === excludeId) {
      continue;
    }

    const existingTitle = initiative.name || initiative.title || '';
    if (!existingTitle) {
      continue;
    }

    if (isSimilar(title, existingTitle)) {
      return existingTitle;
    }
  }

  return null;
}
