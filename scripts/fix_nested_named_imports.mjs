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

        // Match indented import { ... } from '...';
        content = content.replace(/^(\s+)import\s+\{\s*([a-zA-Z0-9_,\s]+)\s*\}\s+from\s+['"]([^'"]+)['"];/gm, (match, indent, imports, modPath) => {
            
            let newPath = modPath;
            if (modPath.startsWith('ai/')) newPath = '../' + modPath;
            if (modPath.startsWith('services/')) newPath = '../' + modPath;
            if (modPath.startsWith('utils/')) newPath = '../' + modPath;
            if (modPath.startsWith('models/')) newPath = '../' + modPath;
            
            changed = true;
            return `${indent}const { ${imports} } = await import('${newPath}');`;
        });

        if (changed) {
            console.log(`Fixed nested named imports in ${filePath}`);
            fs.writeFileSync(filePath, content);
        }
    });
});
