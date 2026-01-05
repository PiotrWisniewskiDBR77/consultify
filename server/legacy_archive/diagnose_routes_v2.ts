import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Adjust path to point to src/routes
const routesDir = path.join(__dirname, 'src/routes');

console.log(`Scanning directory: ${routesDir}`);

if (!fs.existsSync(routesDir)) {
    console.error('Routes directory not found!');
    process.exit(1);
}

const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.routes.ts'));
console.log(`Found ${files.length} route files to check.`);

const BATCH_SIZE = 1; // Check one by one to be sure

async function checkRoute(file) {
    const filePath = path.join(routesDir, file);
    // console.log(`\nImporting ${file}...`);

    return new Promise(async (resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`TIMEOUT importing ${file}`));
        }, 1000); // 1 second timeout per file

        try {
            await import(filePath);
            clearTimeout(timer);
            // console.log(`✅ ${file} OK`);
            process.stdout.write('.');
            resolve(true);
        } catch (err) {
            clearTimeout(timer);
            console.error(`\n❌ FAILED ${file}:`, err.message);
            // resolve(false); // Don't crash, just report
            // Actually, if it fails with error, that's good info. If it times out, that's the blocker.
            resolve(false);
        }
    });
}

(async () => {
    console.log('Starting diagnostic...');
    const failed = [];
    for (const file of files) {
        try {
            const result = await checkRoute(file);
            if (!result) failed.push(file);
        } catch (e) {
            console.error(`\n🔥 BLOCKER FOUND: ${file} timed out or crashed fatally.`);
            console.error(e);
            failed.push(file);
        }
    }
    console.log('\nDiagnostic complete.');
    if (failed.length > 0) {
        console.log('Failed files:', failed);
    } else {
        console.log('All files imported successfully.');
    }
    process.exit(0);
})();
