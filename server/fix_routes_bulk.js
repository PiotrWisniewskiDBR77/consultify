import fs from 'fs';
import path from 'path';

const dir = 'server/src/routes';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.routes.ts'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let lines = content.split('\n');

    const declLineIdx = lines.findIndex(l => l.includes('const router = Router();'));
    // Find FIRST usage of router.use
    const useLineIdx = lines.findIndex(l => l.includes('router.use('));

    if (declLineIdx !== -1 && useLineIdx !== -1 && declLineIdx > useLineIdx) {
        const declLine = lines[declLineIdx];
        lines.splice(declLineIdx, 1);
        lines.splice(useLineIdx, 0, declLine, '');

        fs.writeFileSync(filePath, lines.join('\n'));
        console.log(`Fixed ${file}`);
    }
});
