/**
 * Seed legal documents from /Legal markdown files into PostgreSQL.
 * Run: node server/seeds/seedLegalDocs.mjs
 */
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const LEGAL_DIR = path.resolve(import.meta.dirname, '../../Legal');

const DOCS = [
  { docType: 'TOS', title: 'Terms of Service', file: 'terms-of-service.md' },
  { docType: 'PRIVACY', title: 'Privacy Policy', file: 'privacy-policy.md' },
  { docType: 'COOKIES', title: 'Cookie Policy', file: 'cookie-policy.md' },
  { docType: 'AUP', title: 'Acceptable Use Policy', file: 'acceptable-use-policy.md' },
  { docType: 'AI_POLICY', title: 'AI Usage Policy', file: 'ai-usage-policy.md' },
  { docType: 'DPA', title: 'Data Processing Addendum', file: 'data-processing-addendum.md' },
  { docType: 'SUBSCRIPTION', title: 'Subscription Agreement', file: 'subscription-agreement.md' },
  { docType: 'SLA', title: 'Service Level Agreement', file: 'service-level-agreement.md' },
  { docType: 'REFUND', title: 'Refund & Cancellation Policy', file: 'refund-cancellation-policy.md' },
  { docType: 'SECURITY', title: 'Security Overview', file: 'security-overview.md' },
  { docType: 'CUSTOMER_SECURITY', title: 'Customer Data Security', file: 'customer-data-security.md' },
  { docType: 'SUBPROCESSORS', title: 'Sub-processor List', file: 'subprocessor-list.md' },
];

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: false });

async function seed() {
  const client = await pool.connect();
  const today = new Date().toISOString().split('T')[0];

  try {
    for (const doc of DOCS) {
      const filePath = path.join(LEGAL_DIR, doc.file);
      if (!fs.existsSync(filePath)) {
        console.warn(`  SKIP ${doc.docType}: file not found (${doc.file})`);
        continue;
      }
      const contentMd = fs.readFileSync(filePath, 'utf-8');

      // Check if active document already exists
      const existing = await client.query(
        `SELECT id, version FROM legal_documents WHERE COALESCE(doc_type, UPPER(type)) = $1 AND (is_active = TRUE OR status = 'active') LIMIT 1`,
        [doc.docType]
      );

      if (existing.rows.length > 0) {
        // Update existing document content
        await client.query(
          `UPDATE legal_documents SET content_md = $1, content = $1, title = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
          [contentMd, doc.title, existing.rows[0].id]
        );
        console.log(`  UPDATE ${doc.docType} (v${existing.rows[0].version}, ${contentMd.length} chars)`);
      } else {
        // Insert new document
        const id = randomUUID();
        await client.query(
          `INSERT INTO legal_documents
           (id, type, doc_type, name, title, version, content, content_md,
            status, is_active, effective_date, effective_from,
            scope_type, created_by, published_by,
            created_at, updated_at, published_at, requires_acceptance)
           VALUES ($1, $2, $2, $3, $3, '2.0', $4, $4,
                   'active', TRUE, $5, $5,
                   'global', 'system', 'system',
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)`,
          [id, doc.docType, doc.title, contentMd, today]
        );
        console.log(`  INSERT ${doc.docType} v2.0 (${contentMd.length} chars)`);
      }
    }
    console.log('\nDone. All legal documents seeded.');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
