/**
 * APLIX Questions Rewrite — adds specific description (hint), evidence_prompt,
 * and expected_answer_shape to all 150 APLIX-NA questions.
 *
 * Run: DOTENV_CONFIG_PATH=.env.local npx tsx server/scripts/rewrite-aplix-questions.ts
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { globalQuestions, hqQuestions, plantQuestions, extrusionQuestions, formingQuestions } from './rewrite-aplix-questions-part1';
import { convertingQuestions, maintenanceQuestions, qualityQuestions, planningQuestions, supplyChainQuestions } from './rewrite-aplix-questions-part2';
import { ciQuestions, dataQuestions, peopleQuestions, rndQuestions, salesCsQuestions } from './rewrite-aplix-questions-part3';

interface QuestionUpdate {
  id: string;
  question_text: string;
  description: string;
  evidence_prompt: string;
  expected_answer_shape: string;
}

const allQuestions: QuestionUpdate[] = [
  ...globalQuestions,
  ...hqQuestions,
  ...plantQuestions,
  ...extrusionQuestions,
  ...formingQuestions,
  ...convertingQuestions,
  ...maintenanceQuestions,
  ...qualityQuestions,
  ...planningQuestions,
  ...supplyChainQuestions,
  ...ciQuestions,
  ...dataQuestions,
  ...peopleQuestions,
  ...rndQuestions,
  ...salesCsQuestions,
];

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log(`Connected. Updating ${allQuestions.length} APLIX questions...\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const q of allQuestions) {
    try {
      const res = await client.query(
        `UPDATE interview_library_template_questions
         SET question_text = $1,
             description = $2,
             evidence_prompt = $3,
             expected_answer_shape = $4
         WHERE id = $5`,
        [q.question_text, q.description, q.evidence_prompt, q.expected_answer_shape, q.id]
      );
      if (res.rowCount === 1) {
        updated++;
        console.log(`  ✓ ${q.id}`);
      } else {
        skipped++;
        console.log(`  ⚠ ${q.id} — not found (rowCount=${res.rowCount})`);
      }
    } catch (err: any) {
      errors++;
      console.error(`  ✗ ${q.id} — ${err.message}`);
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
  await client.end();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
