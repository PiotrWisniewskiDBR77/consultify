/**
 * Demo User Seed Script (compat wrapper)
 * Prefer generic demo seed: piotr.wisniewski@demo.com
 *
 * Run:
 *   node server/seeds/demoUser.js
 */

import demoSeed from './demoUser_demo.js';

export const seedDemoUser = demoSeed.seedDemoUser || demoSeed.seedDemoUserDBR77;
export const DEMO_EMAIL = demoSeed.DEMO_EMAIL || 'piotr.wisniewski@demo.com';
export const DEMO_PASSWORD = demoSeed.DEMO_PASSWORD;
export const DEMO_ORG_ID = demoSeed.DEMO_ORG_ID || 'org-demo-public';
export const DEMO_USER_ID = demoSeed.DEMO_USER_ID || 'user-demo-public-admin';

// Run if called directly (ES module compatible)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedDemoUser()
    .then(() => {
      console.log('🎉 Demo user seeding complete!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('💥 Demo user seeding failed:', err);
      process.exit(1);
    });
}

export default { seedDemoUser, DEMO_EMAIL, DEMO_PASSWORD, DEMO_ORG_ID, DEMO_USER_ID };
