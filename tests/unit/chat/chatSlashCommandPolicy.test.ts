import { describe, expect, it } from 'vitest';

import { retiredChatWriteCommand } from '../../../src/utils/chatSlashCommandPolicy';

describe('Chat slash-command governed write boundary', () => {
  it.each([
    ['/task Prepare steering committee brief', 'task'],
    ['/decision Approve the recovery plan', 'decision'],
  ] as const)('fails %s closed without claiming a target write', (command, targetKind) => {
    const result = retiredChatWriteCommand(command);

    expect(result).toMatchObject({ targetKind });
    expect(result?.notice).toContain('No ' + targetKind + ' was created');
    expect(result?.notice).toContain('/my-work?tab=agent');
    expect(result?.notice).toContain('independent OWNER or ADMIN');
  });

  it.each(['/task', '/decision   ', 'please create a task', '/tasks Something'])(
    'does not intercept ordinary or incomplete input: %s',
    (command) => {
      expect(retiredChatWriteCommand(command)).toBeNull();
    }
  );
});
