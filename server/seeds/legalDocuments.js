/**
 * Legal Documents Seed Script
 * Seeds legal documents from /Legal markdown files into the database.
 * 
 * Run: node server/seeds/legalDocuments.js
 */

import { getDatabase } from '../database/Database.js';
const db = getDatabase();
import { v4 as uuidv4 } from 'uuid';
const fs = require('fs');
const path = require('path');

// Legal documents root directory
const LEGAL_DIR = path.join(__dirname, '../../Legal');

// Document definitions mapping to files in /Legal folder
const LEGAL_DOCUMENT_DEFS = [
    {
        docType: 'TOS',
        title: 'Terms of Service',
        file: 'terms-of-service.md',
        required: true, // Users must accept
    },
    {
        docType: 'PRIVACY',
        title: 'Privacy Policy',
        file: 'privacy-policy.md',
        required: true,
    },
    {
        docType: 'COOKIES',
        title: 'Cookie Policy',
        file: 'cookie-policy.md',
        required: false,
    },
    {
        docType: 'AUP',
        title: 'Acceptable Use Policy',
        file: 'acceptable-use-policy.md',
        required: false,
    },
    {
        docType: 'AI_POLICY',
        title: 'AI Usage Policy',
        file: 'ai-usage-policy.md',
        required: false,
    },
    {
        docType: 'DPA',
        title: 'Data Processing Addendum',
        file: 'data-processing-addendum.md',
        required: false, // Enterprise only
    },
    {
        docType: 'SUBSCRIPTION',
        title: 'Subscription Agreement',
        file: 'subscription-agreement.md',
        required: false,
    },
    {
        docType: 'SLA',
        title: 'Service Level Agreement',
        file: 'service-level-agreement.md',
        required: false, // Scale+ only
    },
    {
        docType: 'REFUND',
        title: 'Refund & Cancellation Policy',
        file: 'refund-cancellation-policy.md',
        required: false,
    },
    {
        docType: 'SECURITY',
        title: 'Security Overview',
        file: 'security-overview.md',
        required: false,
    },
    {
        docType: 'CUSTOMER_SECURITY',
        title: 'Customer Data Security',
        file: 'customer-data-security.md',
        required: false,
    },
    {
        docType: 'SUBPROCESSORS',
        title: 'Sub-processor List',
        file: 'subprocessor-list.md',
        required: false,
    },
];

/**
 * Load document content from markdown file
 */
function loadDocumentContent(filename) {
    const filePath = path.join(LEGAL_DIR, filename);
    try {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf-8');
        }
        console.warn(`[Seed] File not found: ${filePath}`);
        return null;
    } catch (err) {
        console.error(`[Seed] Error reading ${filename}:`, err.message);
        return null;
    }
}

/**
 * Load and prepare all legal documents
 */
function prepareLegalDocuments() {
    const documents = [];
    
    for (const def of LEGAL_DOCUMENT_DEFS) {
        const content = loadDocumentContent(def.file);
        
        if (content) {
            documents.push({
                docType: def.docType,
                title: def.title,
                contentMd: content,
                required: def.required,
            });
        } else {
            // Use fallback minimal content if file doesn't exist
            console.log(`[Seed] Using fallback for ${def.docType}`);
            documents.push({
                docType: def.docType,
                title: def.title,
                contentMd: generateFallbackContent(def),
                required: def.required,
            });
        }
    }
    
    return documents;
}

/**
 * Generate fallback content for documents without files
 */
function generateFallbackContent(def) {
    const today = new Date().toISOString().split('T')[0];
    return `# ${def.title}

**Effective Date:** ${today}
**Version:** 1.0

This document is pending legal review. Please contact legal@dbr77.com for questions.

## Contact

**DBR77 Robotics Sp. z o.o.**
ul. Żółkiewskiego 31
87-100 Toruń, Poland

Email: legal@dbr77.com
`;
}

/**
 * Seed legal documents to database
 */
async function seedLegalDocuments() {
    console.log('[Seed] Starting legal documents seed...');
    console.log(`[Seed] Legal directory: ${LEGAL_DIR}`);

    const today = new Date().toISOString().split('T')[0];
    const version = '1.0';
    
    const documents = prepareLegalDocuments();
    console.log(`[Seed] Prepared ${documents.length} documents`);

    for (const doc of documents) {
        const id = uuidv4();

        await new Promise((resolve) => {
            // First, check if active document exists
            db.get(
                'SELECT id, version FROM legal_documents WHERE doc_type = ? AND is_active = 1',
                [doc.docType],
                (err, existing) => {
                    if (err) {
                        console.error(`[Seed] Error checking ${doc.docType}:`, err);
                        resolve();
                        return;
                    }

                    if (existing) {
                        console.log(`[Seed] ${doc.docType} already has active version (${existing.version}), skipping`);
                        resolve();
                        return;
                    }

                    // Insert new document
                    db.run(
                        `INSERT INTO legal_documents 
                        (id, doc_type, version, title, content_md, effective_from, created_by, is_active)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                        [id, doc.docType, version, doc.title, doc.contentMd, today, 'system'],
                        (err) => {
                            if (err) {
                                console.error(`[Seed] Error inserting ${doc.docType}:`, err);
                            } else {
                                console.log(`[Seed] Created ${doc.docType} v${version} (${doc.contentMd.length} chars)`);
                            }
                            resolve();
                        }
                    );
                }
            );
        });
    }

    console.log('[Seed] Legal documents seed complete');
}

/**
 * Update existing documents with new content from files
 * Use this to refresh content without changing versions
 */
async function updateLegalDocuments() {
    console.log('[Seed] Updating legal documents from files...');
    
    const documents = prepareLegalDocuments();
    
    for (const doc of documents) {
        await new Promise((resolve) => {
            db.run(
                `UPDATE legal_documents 
                SET content_md = ?, updated_at = CURRENT_TIMESTAMP
                WHERE doc_type = ? AND is_active = 1`,
                [doc.contentMd, doc.docType],
                function(err) {
                    if (err) {
                        console.error(`[Seed] Error updating ${doc.docType}:`, err);
                    } else if (this.changes > 0) {
                        console.log(`[Seed] Updated ${doc.docType} content`);
                    } else {
                        console.log(`[Seed] No active ${doc.docType} to update`);
                    }
                    resolve();
                }
            );
        });
    }
    
    console.log('[Seed] Update complete');
}

/**
 * Create new version of documents (for major updates)
 */
async function createNewVersion(newVersion = '1.1') {
    console.log(`[Seed] Creating new version ${newVersion} of all documents...`);
    
    const today = new Date().toISOString().split('T')[0];
    const documents = prepareLegalDocuments();
    
    for (const doc of documents) {
        const id = uuidv4();
        
        await new Promise((resolve) => {
            // Deactivate old version
            db.run(
                `UPDATE legal_documents SET is_active = 0 WHERE doc_type = ? AND is_active = 1`,
                [doc.docType],
                (err) => {
                    if (err) {
                        console.error(`[Seed] Error deactivating old ${doc.docType}:`, err);
                        resolve();
                        return;
                    }
                    
                    // Insert new version
                    db.run(
                        `INSERT INTO legal_documents 
                        (id, doc_type, version, title, content_md, effective_from, created_by, is_active)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                        [id, doc.docType, newVersion, doc.title, doc.contentMd, today, 'system'],
                        (err) => {
                            if (err) {
                                console.error(`[Seed] Error creating ${doc.docType} v${newVersion}:`, err);
                            } else {
                                console.log(`[Seed] Created ${doc.docType} v${newVersion}`);
                            }
                            resolve();
                        }
                    );
                }
            );
        });
    }
    
    console.log('[Seed] New version creation complete');
}

// Export for use in other scripts
const LEGAL_DOCUMENTS = prepareLegalDocuments();

// Run if executed directly
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'seed';
    
    // Wait for DB init
    setTimeout(async () => {
        try {
            switch (command) {
                case 'seed':
                    await seedLegalDocuments();
                    break;
                case 'update':
                    await updateLegalDocuments();
                    break;
                case 'new-version':
                    const version = args[1] || '1.1';
                    await createNewVersion(version);
                    break;
                default:
                    console.log('Usage: node legalDocuments.js [seed|update|new-version <version>]');
            }
            console.log('[Seed] Done');
            process.exit(0);
        } catch (err) {
            console.error('[Seed] Error:', err);
            process.exit(1);
        }
    }, 1000);
}

export default { 
    seedLegalDocuments, 
    updateLegalDocuments,
    createNewVersion,
    LEGAL_DOCUMENTS,
    LEGAL_DOCUMENT_DEFS,
};
