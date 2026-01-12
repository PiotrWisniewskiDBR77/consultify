
const fs = require('fs');
const path = require('path');

const planPath = '/Users/piotrwisniewski/.cursor/plans/plan_realizacji_90%_pokrycia_testów_88c65dcb.plan.md';
const projectRoot = '/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify';

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);
    arrayOfFiles = arrayOfFiles || [];
    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            arrayOfFiles.push(path.join(dirPath, "/", file));
        }
    });
    return arrayOfFiles;
}

const allProjectFiles = getAllFiles(projectRoot).map(f => path.relative(projectRoot, f));

try {
    let content = fs.readFileSync(planPath, 'utf8');
    const lines = content.split('\n');
    let updatedContent = '';
    let updatesCount = 0;

    for (let line of lines) {
        // Match lines like: 116. `tests/some/path.test.js` ❌ (reason)
        const match = line.match(/^(\s*\d+\.\s*)`([^`]+)`(\s*❌.*)?$/);

        if (match) {
            const prefix = match[1];
            let planPathStr = match[2];

            // Normalize path for check
            let checkPath = planPathStr;
            // Handle tests/components/ -> components/ if file exists there
            if (checkPath.startsWith('tests/components/')) {
                let compPath = checkPath.replace('tests/components/', 'components/').replace('.test.tsx', '.tsx');
                if (allProjectFiles.includes(compPath)) {
                    // Component exists, so the test file might exist too or needs to be checked
                }
            }

            // Standard check
            let found = allProjectFiles.find(f => f === planPathStr);

            if (!found) {
                // Try to find by basename in same directory structure
                const base = path.basename(planPathStr);
                found = allProjectFiles.find(f => f.endsWith(base) && f.includes(path.dirname(planPathStr)));
            }

            if (found) {
                line = `${prefix}\`${found}\` ✅ (już istnieje)`;
                updatesCount++;
            }
        }
        updatedContent += line + '\n';
    }

    fs.writeFileSync(planPath, updatedContent);
    console.log(`Updated ${updatesCount} lines.`);

} catch (err) {
    console.error('Error:', err);
}
