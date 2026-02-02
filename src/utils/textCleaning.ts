/**
 * Text Cleaning Utility for Speech Synthesis
 *
 * Removes markdown, code blocks, and other non-speech elements from text.
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
