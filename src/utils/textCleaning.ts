/**
 * Text Cleaning Utility for Speech Synthesis
 *
 * Removes markdown, code blocks, and other non-speech elements from text.
 * Includes executive brief mode for Deep Thinking outputs.
 */

export function cleanTextForSpeech(text: string): string {
  if (!text) return '';

  return (
    text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, ' ')
      // Remove inline code
      .replace(/`[^`]+`/g, '')
      // Remove markdown links, keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove markdown images
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      // Remove markdown headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove markdown bold/italic
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
      .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
      // Remove bullet points
      .replace(/^[-*+•]\s+/gm, '')
      // Remove numbered lists
      .replace(/^\d+\.\s+/gm, '')
      // Remove URLs
      .replace(/https?:\/\/\S+/g, '')
      // Remove emoji
      .replace(/[\u{1F600}-\u{1F6FF}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      // Clean up whitespace
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * formatExecutiveBrief
 *
 * Transforms a full Deep Thinking report into a concise executive brief
 * suitable for voice playback (2-3 minutes max). Extracts:
 * 1. Executive Summary
 * 2. Key Recommendation
 * 3. Top 3 risks
 * 4. Decision-ready conclusion
 *
 * Falls back to cleanTextForSpeech + truncation if sections cannot be parsed.
 */
export function formatExecutiveBrief(text: string, lang: 'en' | 'pl' = 'en'): string {
  if (!text) return '';

  const cleaned = cleanTextForSpeech(text);

  // Try to extract structured sections
  const sections: string[] = [];

  // Executive Summary section
  const execSummaryPatterns = [
    /Executive\s+Summary[:\s]*([^#]+?)(?=##|$)/is,
    /Podsumowanie\s+(?:Wykonawcze|Zarządcze)[:\s]*([^#]+?)(?=##|$)/is,
    /Summary[:\s]*([^#]+?)(?=##|$)/is,
  ];
  for (const pattern of execSummaryPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1].trim().length > 30) {
      const intro = lang === 'pl' ? 'Podsumowanie wykonawcze.' : 'Executive summary.';
      sections.push(`${intro} ${match[1].trim().slice(0, 500)}`);
      break;
    }
  }

  // Recommendation section
  const recoPatterns = [
    /Recommend(?:ation|ed)[:\s]*([^#]+?)(?=##|Risk|$)/is,
    /Rekomendacja[:\s]*([^#]+?)(?=##|Ryzy|$)/is,
  ];
  for (const pattern of recoPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1].trim().length > 20) {
      const intro = lang === 'pl' ? 'Rekomendacja.' : 'Recommendation.';
      sections.push(`${intro} ${match[1].trim().slice(0, 400)}`);
      break;
    }
  }

  // Risk section
  const riskPatterns = [
    /Risk[s]?\s*(?:and\s*Mitigation)?[:\s]*([^#]+?)(?=##|Conclusion|Next|$)/is,
    /Ryzyk[ao][:\s]*([^#]+?)(?=##|Podsum|Wnios|$)/is,
  ];
  for (const pattern of riskPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1].trim().length > 20) {
      const intro = lang === 'pl' ? 'Główne ryzyka.' : 'Key risks.';
      sections.push(`${intro} ${match[1].trim().slice(0, 400)}`);
      break;
    }
  }

  // If we got at least 2 sections, use them
  if (sections.length >= 2) {
    const outro = lang === 'pl' ? 'Koniec podsumowania wykonawczego.' : 'End of executive brief.';
    return sections.join(' ... ') + ` ... ${outro}`;
  }

  // Fallback: use first ~1500 chars (about 2 min of speech at normal speed)
  const MAX_BRIEF_LENGTH = 1500;
  const truncated =
    cleaned.length > MAX_BRIEF_LENGTH
      ? cleaned.slice(0, MAX_BRIEF_LENGTH) +
        (lang === 'pl'
          ? '... To było podsumowanie kluczowych punktów.'
          : '... That concludes the key points summary.')
      : cleaned;
  return truncated;
}
