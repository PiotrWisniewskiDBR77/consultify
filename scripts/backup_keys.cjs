
const fs = require('fs');
const path = require('path');

// Load .env manually
const envPath = path.join(__dirname, '../.env');
const keys = {};

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
            // Filter for API Keys only
            if (key.endsWith('_API_KEY')) {
                keys[key] = value;
            }
        }
    });
}

const backupPath = path.join(__dirname, '../secure_backups/working_keys.json');
const backupDir = path.dirname(backupPath);

if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

fs.writeFileSync(backupPath, JSON.stringify(keys, null, 2));
console.log(`Backed up ${Object.keys(keys).length} keys to ${backupPath}`);
