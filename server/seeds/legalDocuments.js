/**
 * Legal Documents Seed Script
 * Seeds initial legal document templates for all required document types.
 * 
 * Run: node server/seeds/legalDocuments.js
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const LEGAL_DOCUMENTS = [
    {
        docType: 'TOS',
        title: 'Terms of Service',
        contentMd: `# Terms of Service

Last Updated: ${new Date().toISOString().split('T')[0]}

## 1. Acceptance of Terms

By accessing or using our service, you agree to be bound by these Terms of Service.

## 2. Description of Service

Our platform provides digital transformation consulting and project management tools.

## 3. User Accounts

- You must provide accurate registration information
- You are responsible for maintaining account security
- You must be at least 18 years old to use this service

## 4. Acceptable Use

You agree not to:
- Violate any laws or regulations
- Infringe intellectual property rights
- Attempt to gain unauthorized access

## 5. Intellectual Property

All content and materials remain our property or licensed to us.

## 6. Limitation of Liability

We are not liable for indirect, incidental, or consequential damages.

## 7. Changes to Terms

We may modify these terms at any time with notice.

## 8. Contact

For questions, contact legal@example.com`
    },
    {
        docType: 'PRIVACY',
        title: 'Privacy Policy',
        contentMd: `# Privacy Policy

Last Updated: ${new Date().toISOString().split('T')[0]}

## 1. Information We Collect

We collect:
- Account information (name, email)
- Usage data
- Device information

## 2. How We Use Information

We use your information to:
- Provide and improve our services
- Communicate with you
- Ensure security

## 3. Data Sharing

We do not sell your data. We may share with:
- Service providers
- Legal authorities when required

## 4. Data Security

We implement industry-standard security measures.

## 5. Your Rights

You have the right to:
- Access your data
- Request deletion
- Export your data

## 6. Cookies

We use cookies for functionality and analytics.

## 7. Contact

Privacy Officer: privacy@example.com`
    },
    {
        docType: 'COOKIES',
        title: 'Cookie Policy',
        contentMd: `# Cookie Policy

Last Updated: ${new Date().toISOString().split('T')[0]}

## What Are Cookies

Cookies are small text files stored on your device.

## Types of Cookies We Use

### Essential Cookies
Required for basic functionality.

### Analytics Cookies
Help us understand how you use our service.

### Preference Cookies
Remember your settings.

## Managing Cookies

You can control cookies through your browser settings.

## Contact

For questions: privacy@example.com`
    },
    {
        docType: 'AUP',
        title: 'Acceptable Use Policy',
        contentMd: `# Acceptable Use Policy

Last Updated: ${new Date().toISOString().split('T')[0]}

## Purpose

This policy defines acceptable use of our platform.

## Prohibited Activities

You may NOT:
- Upload malicious content
- Attempt unauthorized access
- Harass other users
- Share illegal content
- Abuse system resources

## Enforcement

Violations may result in:
- Account suspension
- Account termination
- Legal action

## Reporting

Report violations to: abuse@example.com`
    },
    {
        docType: 'AI_POLICY',
        title: 'AI Usage Policy',
        contentMd: `# AI Usage Policy

Last Updated: ${new Date().toISOString().split('T')[0]}

## 1. AI Features Overview

Our platform uses AI to:
- Provide recommendations
- Analyze data
- Generate insights

## 2. Data Usage for AI

- AI may process your project data
- We do not use your data to train public models
- AI outputs are suggestions, not guarantees

## 3. AI Limitations

- AI recommendations are advisory only
- Human oversight is required for decisions
- AI may produce inaccurate outputs

## 4. Your Controls

You can:
- Disable AI features in settings
- Request AI audit logs
- Opt out of AI-assisted features

## 5. Contact

AI questions: ai-support@example.com`
    },
    {
        docType: 'DPA',
        title: 'Data Processing Addendum',
        contentMd: `# Data Processing Addendum (DPA)

Last Updated: ${new Date().toISOString().split('T')[0]}

## 1. Parties

This DPA is between the Customer (Data Controller) and Service Provider (Data Processor).

## 2. Definitions

- "Personal Data" means data relating to identified individuals
- "Processing" means any operation performed on Personal Data

## 3. Data Processing

We process data only:
- On your documented instructions
- For providing contracted services

## 4. Security Measures

We implement:
- Encryption in transit and at rest
- Access controls
- Regular security audits

## 5. Sub-processors

Current sub-processors are listed in our Trust Center.

## 6. Data Subject Rights

We assist with data subject requests within 30 days.

## 7. Data Breach Notification

We notify within 72 hours of confirmed breach.

## 8. GDPR Compliance

This DPA addresses GDPR requirements for data processing.

## 9. Contact

DPA questions: legal@example.com`
    }
];

async function seedLegalDocuments() {
    console.log('[Seed] Starting legal documents seed...');

    const today = new Date().toISOString().split('T')[0];
    const version = `${today}.1`;

    for (const doc of LEGAL_DOCUMENTS) {
        const id = uuidv4();

        await new Promise((resolve, reject) => {
            // First, check if active document exists
            db.get(
                'SELECT id FROM legal_documents WHERE doc_type = ? AND is_active = 1',
                [doc.docType],
                (err, existing) => {
                    if (err) {
                        console.error(`[Seed] Error checking ${doc.docType}:`, err);
                        resolve();
                        return;
                    }

                    if (existing) {
                        console.log(`[Seed] ${doc.docType} already has active version, skipping`);
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
                                console.log(`[Seed] Created ${doc.docType} v${version}`);
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

// Run if executed directly
if (require.main === module) {
    // Wait for DB init
    setTimeout(() => {
        seedLegalDocuments().then(() => {
            console.log('[Seed] Done');
            process.exit(0);
        });
    }, 1000);
}

module.exports = { seedLegalDocuments, LEGAL_DOCUMENTS };
