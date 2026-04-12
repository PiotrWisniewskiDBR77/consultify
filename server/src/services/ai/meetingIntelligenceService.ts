/**
 * AI Meeting Intelligence Service
 *
 * Integrates voice sessions with calendar data to automatically:
 * - Generate structured meeting notes
 * - Extract action items with owners and deadlines
 * - Identify key decisions made
 * - Hand off to Notebook module for persistence
 */
import { randomUUID } from 'node:crypto';

import { run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export interface MeetingNote {
  id: string;
  title: string;
  date: string;
  participants: string[];
  summary: string;
  keyPoints: string[];
  decisions: Array<{
    decision: string;
    decidedBy: string;
    rationale?: string;
  }>;
  actionItems: Array<{
    task: string;
    owner: string;
    deadline?: string;
    priority: 'low' | 'medium' | 'high';
  }>;
  followUps: string[];
  rawTranscript?: string;
}

export interface MeetingContext {
  calendarEventId?: string;
  title: string;
  scheduledTime?: string;
  participants: string[];
  agenda?: string;
  organizationId: string;
  userId: string;
}

class MeetingIntelligenceService {
  private llmClient: any = null;

  setLLMClient(client: any): void {
    this.llmClient = client;
  }

  async generateMeetingNotes(input: {
    transcript: string;
    context: MeetingContext;
    language?: string;
  }): Promise<MeetingNote> {
    const { transcript, context, language = 'en' } = input;

    if (this.llmClient && transcript.length > 100) {
      return this.generateWithLLM(transcript, context, language);
    }

    return this.generateHeuristic(transcript, context);
  }

  private async generateWithLLM(
    transcript: string,
    context: MeetingContext,
    language: string
  ): Promise<MeetingNote> {
    const prompt = `You are a senior executive assistant. Analyze this meeting transcript and produce structured notes.

Meeting: "${context.title}"
Participants: ${context.participants.join(', ')}
${context.agenda ? `Agenda: ${context.agenda}` : ''}

Transcript (first 5000 chars):
"""
${transcript.slice(0, 5000)}
"""

Produce structured notes in ${language === 'pl' ? 'Polish' : 'English'} with:
1. A concise summary (2-3 sentences)
2. Key points discussed (bullet list)
3. Decisions made (with who decided and rationale)
4. Action items (with owner, deadline estimate, priority)
5. Follow-up topics for next meeting

Respond ONLY with valid JSON:
{
  "summary": "...",
  "keyPoints": ["..."],
  "decisions": [{"decision": "...", "decidedBy": "...", "rationale": "..."}],
  "actionItems": [{"task": "...", "owner": "...", "deadline": "...", "priority": "high|medium|low"}],
  "followUps": ["..."]
}`;

    try {
      const result = await this.llmClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });

      const raw = result.choices?.[0]?.message?.content;
      const parsed = JSON.parse(raw || '{}');

      const note: MeetingNote = {
        id: randomUUID(),
        title: context.title,
        date: context.scheduledTime || new Date().toISOString(),
        participants: context.participants,
        summary: parsed.summary || 'Meeting notes generated',
        keyPoints: parsed.keyPoints || [],
        decisions: (parsed.decisions || []).map((d: any) => ({
          decision: d.decision || '',
          decidedBy: d.decidedBy || 'Unspecified',
          rationale: d.rationale,
        })),
        actionItems: (parsed.actionItems || []).map((a: any) => ({
          task: a.task || '',
          owner: a.owner || 'Unassigned',
          deadline: a.deadline,
          priority: a.priority || 'medium',
        })),
        followUps: parsed.followUps || [],
        rawTranscript: transcript,
      };

      await this.persistNote(note, context.organizationId, context.userId);

      return note;
    } catch (err: any) {
      logger.warn(`[MeetingIntel] LLM generation failed, falling back to heuristic: ${err?.message}`);
      return this.generateHeuristic(transcript, context);
    }
  }

  private generateHeuristic(transcript: string, context: MeetingContext): MeetingNote {
    const sentences = transcript.split(/[.!?]\s+/).filter((s) => s.length > 20);

    const actionPatterns = /(?:action|task|todo|do|assign|deadline|termin|zadanie|zrobic|zrobić)/i;
    const decisionPatterns = /(?:decided|agreed|approved|decision|decyzja|zdecydowano|zatwierdzono)/i;

    const actionItems = sentences
      .filter((s) => actionPatterns.test(s))
      .slice(0, 5)
      .map((s) => ({
        task: s.trim(),
        owner: 'Unassigned',
        priority: 'medium' as const,
      }));

    const decisions = sentences
      .filter((s) => decisionPatterns.test(s))
      .slice(0, 3)
      .map((s) => ({
        decision: s.trim(),
        decidedBy: 'Team',
      }));

    return {
      id: randomUUID(),
      title: context.title,
      date: context.scheduledTime || new Date().toISOString(),
      participants: context.participants,
      summary: sentences.slice(0, 2).join('. ') + '.',
      keyPoints: sentences.slice(0, 5).map((s) => s.trim()),
      decisions,
      actionItems,
      followUps: [],
      rawTranscript: transcript,
    };
  }

  private async persistNote(note: MeetingNote, orgId: string, userId: string): Promise<void> {
    await dbRun(
      `INSERT INTO notebook_entries
        (id, organization_id, user_id, title, content, entry_type, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'meeting_note', ?, datetime('now'), datetime('now'))`,
      [
        note.id,
        orgId,
        userId,
        note.title,
        this.formatNoteAsMarkdown(note),
        JSON.stringify({
          participants: note.participants,
          actionItemCount: note.actionItems.length,
          decisionCount: note.decisions.length,
          calendarDate: note.date,
        }),
      ]
    ).catch((err) => logger.debug(`[MeetingIntel] Persist skipped: ${err?.message}`));
  }

  private formatNoteAsMarkdown(note: MeetingNote): string {
    const parts: string[] = [
      `# ${note.title}`,
      `**Date:** ${note.date}`,
      `**Participants:** ${note.participants.join(', ')}`,
      '',
      '## Summary',
      note.summary,
      '',
      '## Key Points',
      ...note.keyPoints.map((kp) => `- ${kp}`),
    ];

    if (note.decisions.length > 0) {
      parts.push('', '## Decisions');
      for (const d of note.decisions) {
        parts.push(`- **${d.decision}** (by ${d.decidedBy}${d.rationale ? ` — ${d.rationale}` : ''})`);
      }
    }

    if (note.actionItems.length > 0) {
      parts.push('', '## Action Items');
      for (const a of note.actionItems) {
        parts.push(`- [ ] ${a.task} → **${a.owner}**${a.deadline ? ` (by ${a.deadline})` : ''} [${a.priority}]`);
      }
    }

    if (note.followUps.length > 0) {
      parts.push('', '## Follow-ups');
      for (const f of note.followUps) {
        parts.push(`- ${f}`);
      }
    }

    return parts.join('\n');
  }
}

export const meetingIntelligenceService = new MeetingIntelligenceService();
export default meetingIntelligenceService;
