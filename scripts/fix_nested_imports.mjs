import fs from 'fs';
import path from 'path';

const dirs = ['server/routes', 'server/middleware', 'server/utils'];

dirs.forEach(dir => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        if (!file.endsWith('.js') && !file.endsWith('.ts')) return;
        const filePath = path.join(dir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        let changed = false;

        // Match indented import * as ...
        // We use a general regex that captures indentation
        // We allow optional empty lines between import and const? No, the previous script put them adjacent.
        // We match multiline with [\r\n]+
        
        content = content.replace(/^(\s+)import\s+\*\s+as\s+(\w+)Module\s+from\s+['"]([^'"]+)['"];\s*[\r\n]+\s*const\s+(\w+)\s*=\s*\2Module\.default\s*\|\|\s*\2Module;/gm, (match, indent, modName, modPath, varName) => {
            
            let newPath = modPath;
            // Fix path if it looks like top-level folder but should be relative
            if (modPath.startsWith('ai/')) newPath = '../' + modPath;
            if (modPath.startsWith('services/')) newPath = '../' + modPath;
            if (modPath.startsWith('utils/')) newPath = '../' + modPath;
            if (modPath.startsWith('models/')) newPath = '../' + modPath; // probably models/

            // Also check if modPath is literally 'ai/smartSuggestions.js' 
            // My previous script might have resolved 'ai/smartSuggestions.js' to just that if it was in fileMap but fileMap key was relative?
            
            changed = true;
            return `${indent}const ${modName}Module = await import('${newPath}');\n${indent}const ${varName} = ${modName}Module.default || ${modName}Module;`;
        });

        if (changed) {
            console.log(`Fixed nested imports in ${filePath}`);
            fs.writeFileSync(filePath, content);
        }
    });
});
