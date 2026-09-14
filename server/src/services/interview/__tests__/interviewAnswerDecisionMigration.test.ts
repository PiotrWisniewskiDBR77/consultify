import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'server/migrations/20262170_interview_answer_decisions.sql'
);
const migration = readFileSync(migrationPath, 'utf8');
const executable = migration
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

describe('Interview answer decisions additive migration contract', () => {
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
    expect(executable).toContain('CREATE TABLE IF NOT EXISTS interview_answer_decision_commands');
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
    expect(executable).toContain('CREATE TABLE IF NOT EXISTS interview_answer_decisions');
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
