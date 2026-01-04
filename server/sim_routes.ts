
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const routesDir = path.join(__dirname, 'src/routes');

console.log('Starting route loading simulation...');

const problematicFiles = [
    'pmoDomains.routes.ts',
    'raid.routes.ts',
    'ai.routes.js',
    'initiatives.routes.js'
]; // Candidates based on recent edits

async function testImport(file) {
    const p = path.join(routesDir, file);
    try {
        console.log(`Importing ${file}...`);
        await Promise.race([
            import(p),
            new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 2000))
        ]);
        console.log(`✅ ${file} LOADED`);
    } catch (e) {
        console.error(`❌ ${file} FAILED: ${e.message}`);
    }
}

(async () => {
    for (const f of problematicFiles) {
        if (fs.existsSync(path.join(routesDir, f))) {
            await testImport(f);
        } else {
            console.log(`Skipping ${f} (not found)`);
        }
    }
    console.log('Simulation complete.');
})();
