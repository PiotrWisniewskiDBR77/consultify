import { describe, expect, it } from 'vitest';
import { parseCommand } from '../../../server/src/services/reportAgentService';

describe('reportAgentService.parseCommand', () => {
  it('detects reorder actions', () => {
    expect(parseCommand('Please reorder the sections')).toEqual({ type: 'REORDER_SECTIONS' });
    expect(parseCommand('Move the conclusion to the top')).toEqual({ type: 'REORDER_SECTIONS' });
  });

  it('detects add actions', () => {
    expect(parseCommand('Add a section about risks')).toEqual({ type: 'ADD_SECTION' });
    expect(parseCommand('Insert a block with timeline')).toEqual({ type: 'ADD_SECTION' });
  });

  it('detects remove actions', () => {
    expect(parseCommand('Remove the section on assumptions')).toEqual({ type: 'REMOVE_SECTION' });
    expect(parseCommand('Delete the block about scope')).toEqual({ type: 'REMOVE_SECTION' });
  });

  it('detects update actions', () => {
    expect(parseCommand('Shorten the executive summary')).toEqual({ type: 'UPDATE_SECTION' });
    expect(parseCommand('Change style and length')).toEqual({ type: 'UPDATE_SECTION' });
  });

  it('detects suggest structure actions', () => {
    expect(parseCommand('Suggest a structure for the report')).toEqual({ type: 'SUGGEST_STRUCTURE' });
    expect(parseCommand('Recommend best practice outline')).toEqual({ type: 'SUGGEST_STRUCTURE' });
  });

  it('detects regenerate actions', () => {
    expect(parseCommand('Regenerate the section on costs')).toEqual({ type: 'REGENERATE_SECTION' });
    expect(parseCommand('Refresh everything')).toEqual({ type: 'REGENERATE_ALL' });
  });

  it('detects quality checks', () => {
    expect(parseCommand("What's missing in this report?")).toEqual({ type: 'QUALITY_CHECK' });
    expect(parseCommand('Run a quality review')).toEqual({ type: 'QUALITY_CHECK' });
  });

  it('falls back to conversational for unrelated input', () => {
    expect(parseCommand('Hello there, how are you?')).toEqual({ type: 'CONVERSATIONAL' });
  });
});
