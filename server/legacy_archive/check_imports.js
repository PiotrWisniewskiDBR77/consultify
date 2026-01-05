import fs from 'fs';
import path from 'path';

const dir = 'server/src/routes';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.routes.ts'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    if (content.includes('router.use(defaultRateLimiter)') && !content.includes('defaultRateLimiter } from')) {
        console.log(`Broken defaultRateLimiter in ${file}`);
    }
    if (content.includes('router.use(aiRateLimiter)') && !content.includes('aiRateLimiter } from')) {
        console.log(`Broken aiRateLimiter in ${file}`);
    }
    if (content.includes('router.use(authRateLimiter)') && !content.includes('authRateLimiter } from')) {
        console.log(`Broken authRateLimiter in ${file}`);
    }
});
