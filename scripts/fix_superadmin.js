import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const controllerPath = path.resolve(__dirname, '../server/src/controllers/SuperAdminController.js');
const servicesDir = path.resolve(__dirname, '../server/src/services');

if (!fs.existsSync(controllerPath)) {
    console.error('SuperAdminController.js not found!');
    process.exit(1);
}

let content = fs.readFileSync(controllerPath, 'utf-8');
let changed = false;

// Regex to match: import('value.js')
const importRegex = /import\(['"]([^'"]+\.js)['"]\)/g;

content = content.replace(importRegex, (match, importFile) => {
    // importFile is like 'usageService.js'
    // Check if it exists in servicesDir

    // Try original name
    let exists = false;
    let targetName = importFile;

    // Try camelCase to PascalCase? usageService.js -> UsageService.ts
    const pascalName = importFile.charAt(0).toUpperCase() + importFile.slice(1).replace('.js', '.ts');
    const tsName = importFile.replace('.js', '.ts');

    if (fs.existsSync(path.join(servicesDir, importFile))) {
        exists = true;
    } else if (fs.existsSync(path.join(servicesDir, tsName))) {
        exists = true;
    } else if (fs.existsSync(path.join(servicesDir, pascalName))) {
        exists = true;
        targetName = pascalName.replace('.ts', '.js'); // Import as .js for ESM
    }

    if (exists) {
        console.log(`[FOUND] ${importFile} -> ../services/${targetName}`);
        changed = true;
        return `import('../services/${targetName}')`;
    } else {
        console.log(`[MISSING] ${importFile} -> Stubbing`);
        changed = true;
        return `Promise.resolve({}) /* Stubbed missing ${importFile} */`;
    }
});

if (changed) {
    fs.writeFileSync(controllerPath, content);
    console.log('Updated SuperAdminController.js');
} else {
    console.log('No changes made.');
}
