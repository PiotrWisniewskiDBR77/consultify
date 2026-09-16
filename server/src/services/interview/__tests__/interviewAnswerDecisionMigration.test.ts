import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

let executable = '';

const definesTable = (tableName: string): boolean =>
  executable
    .split(';')
    .map((statement) => statement.trim())
    .some((statement) =>
      new RegExp(`^CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${tableName}\\b`, 'i').test(
        statement
      )
    );

describe('Interview answer decisions additive migration contract', () => {
  beforeAll(() => {
    const testPath = expect.getState().testPath;
    if (!testPath) throw new Error('Vitest did not expose the current test path');
    const migrationPath = resolve(
      dirname(testPath),
      '../../../../migrations/20262170_interview_answer_decisions.sql'
    );
    executable = readFileSync(migrationPath, 'utf8')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
  });

  it('uses only the explicitly authorized additive statement families', () => {
    const statements = executable
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);

    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      expect(statement).toMatch(/^CREATE (?:TABLE|(?:UNIQUE )?INDEX) IF NOT EXISTS\b/i);
    }
  });

  it('defines one parent command replay boundary for a complete multi-answer command', () => {
    expect(definesTable('interview_answer_decision_commands')).toBe(true);
    expect(executable).toContain(
      'ON interview_answer_decision_commands (organization_id, client_request_id)'
    );
    expect(executable).toContain('request_fingerprint TEXT NOT NULL');
    expect(executable).toContain('expected_answer_count INTEGER NOT NULL');
    expect(executable).toContain('assignment_sequence INTEGER NOT NULL');
    expect(executable).toContain('answer_manifest_digest TEXT NOT NULL');
    expect(executable).toContain('response_json JSONB NOT NULL');
    expect(executable).toContain(
      'ON interview_answer_decision_commands (organization_id, assignment_id, assignment_sequence)'
    );
  });

  it('defines tenant-scoped immutable answer receipts with deterministic submission order', () => {
    expect(definesTable('interview_answer_decisions')).toBe(true);
    expect(executable).toContain('PRIMARY KEY (organization_id, id)');
    expect(executable).toContain('REFERENCES interview_answer_decision_commands');
    expect(executable).toContain(
      'ON interview_answer_decisions (organization_id, submission_id, ordinal)'
    );
    expect(executable).toContain(
      'ON interview_answer_decisions (organization_id, question_id, submission_id, ordinal, id)'
    );
    expect(executable).toContain("decision IN ('approved', 'sent_back')");
  });

  it('cascades permanent Interview and tenant deletion without retaining answer PII', () => {
    expect(executable).toContain('REFERENCES organizations(id) ON DELETE CASCADE');
    expect(executable).toContain('REFERENCES interview_assignments(id) ON DELETE CASCADE');
    expect(executable).toContain('REFERENCES interview_sessions(id) ON DELETE CASCADE');
    expect(executable).toContain('REFERENCES interview_questions(id) ON DELETE CASCADE');
    expect(executable).toContain(
      'REFERENCES interview_answer_decision_commands (organization_id, id)\n    ON DELETE CASCADE'
    );
    expect(executable).not.toContain('ON DELETE RESTRICT');
  });
});
