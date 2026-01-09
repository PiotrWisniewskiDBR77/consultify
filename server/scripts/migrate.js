
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'consultinity',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(config);

async function migrate() {
    console.log('[Migrate] Connecting to database...');
    const client = await pool.connect();

    try {
        // 1. Create migrations table
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                filename TEXT UNIQUE NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Get applied migrations
        const res = await client.query('SELECT filename FROM schema_migrations');
        const applied = new Set(res.rows.map(r => r.filename));

        // 3. Read migration files
        const migrationsDir = path.join(__dirname, '../migrations');
        if (!fs.existsSync(migrationsDir)) {
            console.log('[Migrate] No migrations directory found.');
            return;
        }

        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort(); // Ensure order (001, 002...)

        // 4. Apply new migrations
        for (const file of files) {
            if (applied.has(file)) {
                // Already applied
                continue;
            }

            console.log(`[Migrate] Applying ${file}...`);
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
                await client.query('COMMIT');
                console.log(`[Migrate] Applied ${file}`);
            } catch (e) {
                await client.query('ROLLBACK');
                console.error(`[Migrate] Failed to apply ${file}:`, e.message);
                process.exit(1);
            }
        }

        console.log('[Migrate] All migrations applied.');

    } catch (err) {
        console.error('[Migrate] Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
