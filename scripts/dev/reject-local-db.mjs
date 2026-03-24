const scriptName = process.argv[2] || 'localdb';

console.error(`[dev] \`${scriptName}\` has been disabled.`);
console.error('[dev] This project no longer supports local Postgres development targets.');
console.error('[dev] Use `npm run dev:staging`, `npm run dev:staging:ro`, or `npm run dev:railway` with the external database.');
process.exit(1);
