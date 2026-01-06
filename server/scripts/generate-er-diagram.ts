/**
 * ER Diagram Generator
 * Automatically generates Mermaid ER diagrams from database schema
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from '../database/index.js';
import logger from '../utils/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateERDiagram(): Promise<string> {
    const db = getDatabase();

    try {
        logger.info('[ER Diagram] Generating diagram...');

        // Get all tables
        const tablesResult = await db.query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
            []
        );

        const tables = tablesResult.rows.map((r: any) => r.name);

        // Get foreign keys for each table
        const relationships: string[] = [];

        for (const table of tables) {
            const fkResult = await db.query(`PRAGMA foreign_key_list(${table})`, []);

            for (const fk of fkResult.rows) {
                relationships.push(`    ${table} ||--o{ ${fk.table} : "has"`);
            }
        }

        // Generate Mermaid diagram
        const diagram = `erDiagram
${tables.map(t => `    ${t} {
        string id PK
    }`).join('\n')}

${relationships.join('\n')}
`;

        // Save to file
        const outputPath = path.join(__dirname, '../../docs/database/schema.mermaid');
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, diagram);

        logger.info(`[ER Diagram] ✅ Generated: ${outputPath}`);
        return outputPath;
    } catch (error) {
        logger.error('[ER Diagram] Generation failed:', error);
        throw error;
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    generateERDiagram().then((path) => {
        console.log(`ER diagram generated: ${path}`);
        process.exit(0);
    }).catch((error) => {
        console.error('Failed:', error);
        process.exit(1);
    });
}
