console.error(
  [
    '[migrate.js] This legacy migration runner is blocked.',
    'Use `npx tsx server/scripts/migrate.postgres.ts` instead so database target resolution',
    'always goes through `server/src/config/databaseTargetResolver.ts`.',
  ].join(' ')
);
process.exit(1);
