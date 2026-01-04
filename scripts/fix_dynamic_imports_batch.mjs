import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SERVER_ROOT = path.join(ROOT, 'server');

// Index files
const fileMap = new Map(); // filename -> absolute path

function indexDir(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
             indexDir(fullPath);
        } else {
             fileMap.set(item, fullPath);
        }
    }
}

// Index likely source directories
[
    'services', 'src/services',
    'utils', 'src/utils',
    'middleware', 'src/middleware',
    'ai', 'src/ai',
    'models', 'src/models'
].forEach(d => indexDir(path.join(SERVER_ROOT, d)));

function getRelativeImportPath(sourceFile, targetName) {
    // If it already looks like a path, leave it (unless we want to verify existence?)
    // But existing faulty code is like import('activityService.js') which is NOT a path.
    // So we only resolve if it doesn't start with . or /
    
    // strip .js or .ts for lookup
    const cleanName = targetName.replace(/\.(js|ts)$/, '');
    
    // exact match with extension in map?
    let targetPath = fileMap.get(targetName);
    
    // try exact match without extension in map keys (map keys have extensions)
    if (!targetPath) {
        // iterate map keys to find match
        for (const [key, val] of fileMap.entries()) {
            if (key === targetName || key.replace(/\.(js|ts)$/, '') === cleanName) {
                targetPath = val;
                break;
            }
        }
    }

    if (!targetPath) return null;
    
    let rel = path.relative(path.dirname(sourceFile), targetPath);
    if (!rel.startsWith('.')) rel = './' + rel;
    
    // Ensure we import it as .js if we are in ESM (unless it is from node_modules, but these are local)
    // If target is .ts, usage in .js usually needs .js extension if compiled or using proper loader?
    // We will preserve target extension OR force .js?
    // Let's force .js as safe bet for mixed environment
    // rel = rel.replace(/\.ts$/, '.js'); 
    // Wait, if I import .ts file in .js file using .ts extension, tsx handles it.
    // If I use .js in .js file, it expects .js.
    // safely, keep as is or just verify what fileMap had.
    // If fileMap had .js, good. If .ts, we might need .js if compiled.
    // Let's not mutate extension for now, assume fileMap key extension is truth on disk.
    
    return rel;
}

const routeDirs = [
    path.join(SERVER_ROOT, 'routes'),
    path.join(SERVER_ROOT, 'src/routes')
];

routeDirs.forEach(dir => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        if (!file.endsWith('.js') && !file.endsWith('.ts')) return;
        
        const filePath = path.join(dir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        let changed = false;
        
        // Regex for dynamic imports: const X = import('Y');
        content = content.replace(/const\s+(\w+)\s*=\s*import\(['"]([^'"]+)['"]\);/g, (match, varName, modName) => {
             let finalPath = modName;
             // Resolve if it's not a path
             if (!modName.startsWith('.') && !modName.startsWith('/')) {
                  const rel = getRelativeImportPath(filePath, modName);
                  if (rel) finalPath = rel;
             } else {
                 // Even if it starts with ./, check if it needs .js? 
             }
             
             changed = true;
             // Use the "namespace import" trick or just default import if confident
             // Many services export default class/object.
             return `import * as ${varName}Module from '${finalPath}';\nconst ${varName} = ${varName}Module.default || ${varName}Module;`;
        });

         // Destructuring: const { X } = import('Y');
        content = content.replace(/const\s+\{\s*([a-zA-Z0-9_,\s]+)\s*\}\s*=\s*import\(['"]([^'"]+)['"]\);/g, (match, imports, modName) => {
             let finalPath = modName;
             if (!modName.startsWith('.') && !modName.startsWith('/')) {
                  const rel = getRelativeImportPath(filePath, modName);
                  if (rel) finalPath = rel;
             }
             changed = true;
             return `import { ${imports} } from '${finalPath}';`;
        });
        
        if (changed) {
            console.log(`Fixed imports in ${filePath}`);
            fs.writeFileSync(filePath, content);
        }
    });
});
