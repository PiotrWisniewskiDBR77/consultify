#!/usr/bin/env node

/**
 * Knowledge Base Ingestion Script
 * 
 * Ingests all knowledge documents into the RAG system.
 * Run with: node scripts/ingest-knowledge.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { ingestionPipeline } = require('../server/services/ai/ingestionPipeline');
const { aiLogger } = require('../server/services/ai/logger');

const KNOWLEDGE_DIR = path.join(__dirname, '..', 'data', 'knowledge');

async function main() {
    console.log('='.repeat(60));
    console.log('Knowledge Base Ingestion');
    console.log('='.repeat(60));
    console.log(`Knowledge directory: ${KNOWLEDGE_DIR}`);
    console.log('');

    // Check if OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
        console.error('ERROR: OPENAI_API_KEY environment variable is not set');
        console.error('Embeddings require OpenAI API access');
        process.exit(1);
    }

    try {
        console.log('Starting ingestion...\n');

        const result = await ingestionPipeline.ingestDirectory(KNOWLEDGE_DIR, {
            sourceType: 'knowledge_base',
            recursive: true,
            metadata: {
                source: 'drd_methodology',
                version: '1.0'
            }
        });

        console.log('\n' + '='.repeat(60));
        console.log('Ingestion Complete');
        console.log('='.repeat(60));
        console.log(`Total files processed: ${result.totalFiles}`);
        console.log(`Successful: ${result.successful}`);
        console.log(`Failed: ${result.failed}`);
        console.log('');

        const stats = ingestionPipeline.getStats();
        console.log('Statistics:');
        console.log(`  Documents processed: ${stats.documentsProcessed}`);
        console.log(`  Chunks created: ${stats.chunksCreated}`);
        console.log(`  Errors: ${stats.errors}`);
        console.log('');

        if (result.failed > 0) {
            console.log('Failed files:');
            result.results
                .filter(r => r.error)
                .forEach(r => console.log(`  - ${r.file}: ${r.error}`));
        }

        console.log('\nSuccessful ingestions:');
        result.results
            .filter(r => !r.error)
            .forEach(r => console.log(`  - ${r.fileName}: ${r.chunksCreated} chunks`));

    } catch (error) {
        console.error('Ingestion failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }

    console.log('\nDone.');
    process.exit(0);
}

// Handle direct execution
if (require.main === module) {
    main();
}

module.exports = { main };






