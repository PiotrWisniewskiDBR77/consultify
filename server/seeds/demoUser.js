/**
 * Demo User Seed Script
 * Creates the demo@legolex.com user and organization if they don't exist
 * 
 * Run: node server/seeds/demoUser.js
 */

import { getDatabase } from '../src/database/Database.js';
const db = getDatabase();
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const DEMO_ORG_ID = 'org-legolex-demo';
const DEMO_USER_ID = 'user-demo-admin';
const DEMO_EMAIL = 'demo@legolex.com';
const DEMO_PASSWORD = 'Demo123!';

async function seedDemoUser() {
    console.log('🚀 Seeding Demo User...');

    return new Promise((resolve, reject) => {
        // Check if demo user exists
        db.get(`SELECT id FROM users WHERE email = ?`, [DEMO_EMAIL], (err, user) => {
            if (err) {
                console.error('❌ Error checking for demo user:', err);
                return reject(err);
            }

            if (user) {
                console.log('✅ Demo user already exists:', DEMO_EMAIL);
                return resolve();
            }

            // Check if demo organization exists
            db.get(`SELECT id FROM organizations WHERE id = ?`, [DEMO_ORG_ID], (err, org) => {
                if (err) {
                    console.error('❌ Error checking for demo org:', err);
                    return reject(err);
                }

                const createUser = () => {
                    const hashedPassword = bcrypt.hashSync(DEMO_PASSWORD, 8);
                    db.run(
                        `INSERT INTO users(id, organization_id, email, password, first_name, last_name, role, status) 
                         VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
                        [DEMO_USER_ID, DEMO_ORG_ID, DEMO_EMAIL, hashedPassword, 'Demo', 'User', 'ADMIN', 'active'],
                        function(err) {
                            if (err) {
                                console.error('❌ Error creating demo user:', err);
                                return reject(err);
                            }
                            console.log('✅ Created demo user:', DEMO_EMAIL);

                            // Create a sample project
                            const projectId = 'project-demo-001';
                            db.run(
                                `INSERT OR IGNORE INTO projects(id, organization_id, name, status, owner_id) VALUES(?, ?, ?, ?, ?)`,
                                [projectId, DEMO_ORG_ID, 'Strategic Transformation Demo', 'active', DEMO_USER_ID],
                                function(err) {
                                    if (err) {
                                        console.warn('⚠️ Could not create demo project:', err);
                                    } else {
                                        console.log('✅ Created demo project');
                                    }
                                    resolve();
                                }
                            );
                        }
                    );
                };

                if (!org) {
                    // Create organization first
                    db.run(
                        `INSERT INTO organizations(id, name, plan, status) VALUES(?, ?, ?, ?)`,
                        [DEMO_ORG_ID, 'Legolex Demo Corp', 'enterprise', 'active'],
                        function(err) {
                            if (err) {
                                console.error('❌ Error creating demo org:', err);
                                return reject(err);
                            }
                            console.log('✅ Created demo organization');
                            createUser();
                        }
                    );
                } else {
                    console.log('✅ Demo organization already exists');
                    createUser();
                }
            });
        });
    });
}

// Run if called directly
if (require.main === module) {
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

export {
seedDemoUser, DEMO_EMAIL, DEMO_PASSWORD, DEMO_ORG_ID, DEMO_USER_ID
};

export default { seedDemoUser, DEMO_EMAIL, DEMO_PASSWORD, DEMO_ORG_ID, DEMO_USER_ID };
















