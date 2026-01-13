/**
 * Legal Documents Seed Script (File-Based)
 *
 * Seeds legal documents from the /Legal directory Markdown files.
 * This replaces the inline document content with external file-based management.
 *
 * Run: node server/seeds/legalDocumentsFromFiles.js
 */

import fs from 'fs';
import path from 'path';
import { getDatabase } from '../src/database/Database.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';

// Path to Legal directory
const LEGAL_DIR = path.resolve(__dirname, '../../Legal');
const METADATA_PATH = path.resolve(LEGAL_DIR, 'config/legal-metadata.json');

/**
 * Load metadata from legal-metadata.json
 */
function loadMetadata() {
  try {
    const content = fs.readFileSync(METADATA_PATH, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('[Seed] Error loading legal-metadata.json:', error.message);
    throw error;
  }
}

/**
 * Load document content from Markdown file
 */
function loadDocumentContent(filename) {
  try {
    const filePath = path.resolve(LEGAL_DIR, filename);
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`[Seed] Error loading ${filename}:`, error.message);
    return null;
  }
}

/**
 * Seed all legal documents from files
 */
async function seedLegalDocuments() {
  console.log('[Seed] Starting legal documents seed from files...');
  console.log(`[Seed] Legal directory: ${LEGAL_DIR}`);

  // Load metadata
  const metadata = loadMetadata();
  console.log(`[Seed] Loaded metadata version: ${metadata.metadata.version}`);

  const documents = metadata.documents;
  const docTypes = Object.keys(documents);

  console.log(`[Seed] Found ${docTypes.length} documents to process`);

  for (const docType of docTypes) {
    const doc = documents[docType];
    const content = loadDocumentContent(doc.file);

    if (!content) {
      console.warn(`[Seed] Skipping ${docType} - file not found`);
      continue;
    }

    await new Promise((resolve) => {
      // Check if document already exists
      db.get(
        'SELECT id, version FROM legal_documents WHERE doc_type = ? AND is_active = 1',
        [docType],
        (err, existing) => {
          if (err) {
            console.error(`[Seed] Error checking ${docType}:`, err.message);
            resolve();
            return;
          }

          if (existing) {
            // Check if version changed
            if (existing.version === doc.version) {
              console.log(`[Seed] ${docType} v${doc.version} already exists, skipping`);
              resolve();
              return;
            }

            // Deactivate old version
            db.run(
              'UPDATE legal_documents SET is_active = 0 WHERE id = ?',
              [existing.id],
              (updateErr) => {
                if (updateErr) {
                  console.error(`[Seed] Error deactivating old ${docType}:`, updateErr.message);
                }
                insertDocument(docType, doc, content, resolve);
              }
            );
          } else {
            insertDocument(docType, doc, content, resolve);
          }
        }
      );
    });
  }

  console.log('[Seed] Legal documents seed complete');
}

/**
 * Insert a new document version
 */
function insertDocument(docType, docMeta, content, callback) {
  const id = uuidv4();

  db.run(
    `INSERT INTO legal_documents 
        (id, doc_type, version, title, content_md, effective_from, created_by, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, docType, docMeta.version, docMeta.title, content, docMeta.effectiveDate, 'system'],
    (err) => {
      if (err) {
        console.error(`[Seed] Error inserting ${docType}:`, err.message);
      } else {
        console.log(`[Seed] Created ${docType} v${docMeta.version}`);
      }
      callback();
    }
  );
}

/**
 * Verify all documents were seeded
 */
async function verifyDocuments() {
  return new Promise((resolve) => {
    db.all(
      'SELECT doc_type, version, title FROM legal_documents WHERE is_active = 1 ORDER BY doc_type',
      [],
      (err, rows) => {
        if (err) {
          console.error('[Seed] Error verifying documents:', err.message);
        } else {
          console.log('\n[Seed] Active legal documents:');
          rows.forEach((row) => {
            console.log(`  - ${row.doc_type}: ${row.title} (v${row.version})`);
          });
        }
        resolve();
      }
    );
  });
}

// Run if executed directly
if (require.main === module) {
  // Wait for DB init
  setTimeout(async () => {
    try {
      await seedLegalDocuments();
      await verifyDocuments();
      console.log('\n[Seed] Done');
      process.exit(0);
    } catch (error) {
      console.error('[Seed] Fatal error:', error);
      process.exit(1);
    }
  }, 1000);
}

export { seedLegalDocuments, loadMetadata, loadDocumentContent };

export default { seedLegalDocuments, loadMetadata, loadDocumentContent };
