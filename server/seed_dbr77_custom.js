const sqlite3 = require('sqlite3').verbose();
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4: uuidv4 } from 'uuid';

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

const ORG_ID = 'org-dbr77-test';
const password = bcrypt.hashSync('123456', 8);

const USERS = [
    {
        email: 'piotr.wisniewski@dbr77.com',
        first_name: 'Piotr',
        last_name: 'Wisniewski',
        role: 'ADMIN',
        is_owner: 1
    },
    {
        email: 'pawel.mroczkowski@dbr77.com',
        first_name: 'Pawel',
        last_name: 'Mroczkowski',
        role: 'ADMIN',
        is_owner: 0
    },
    {
        email: 'konrad.milewski@dbr77.com',
        first_name: 'Konrad',
        last_name: 'Milewski',
        role: 'ADMIN',
        is_owner: 0
    },
    {
        email: 'justyna.laskowska@dbr77.com',
        first_name: 'Justyna',
        last_name: 'Laskowska',
        role: 'USER',
        is_owner: 0
    },
    {
        email: 'tomasz.jankowski@dbr77.com',
        first_name: 'Tomasz',
        last_name: 'Jankowski',
        role: 'USER',
        is_owner: 0
    }
];

db.serialize(() => {
    console.log('--- Seeding DBR77 Organization ---');

    // Ensure Organization exists and is upgraded
    db.run(`INSERT INTO organizations (id, name, plan, status) 
            VALUES (?, ?, ?, ?) 
            ON CONFLICT(id) DO UPDATE SET name=excluded.name, plan=excluded.plan`,
        [ORG_ID, 'DBR77', 'enterprise', 'active'], function (err) {
            if (err) console.error('Error updating organization:', err.message);
            else console.log('Organization DBR77 updated/inserted.');
        });

    console.log('--- Seeding DBR77 Users ---');

    USERS.forEach(user => {
        // Check if user exists
        db.get('SELECT id FROM users WHERE email = ?', [user.email], (err, row) => {
            if (err) {
                console.error(`Error checking user ${user.email}:`, err.message);
                return;
            }

            if (row) {
                // Update existing user
                db.run(`UPDATE users SET 
                        organization_id = ?, 
                        password = ?, 
                        first_name = ?, 
                        last_name = ?, 
                        role = ?, 
                        is_owner = ?,
                        status = 'active'
                        WHERE id = ?`,
                    [ORG_ID, password, user.first_name, user.last_name, user.role, user.is_owner, row.id],
                    function (err) {
                        if (err) console.error(`Error updating user ${user.email}:`, err.message);
                        else console.log(`User updated: ${user.email}`);
                    });
            } else {
                // Insert new user
                const newId = uuidv4();
                db.run(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, is_owner, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [newId, ORG_ID, user.email, password, user.first_name, user.last_name, user.role, user.is_owner, 'active'],
                    function (err) {
                        if (err) console.error(`Error inserting user ${user.email}:`, err.message);
                        else console.log(`User inserted: ${user.email}`);
                    });
            }
        });
    });
});

setTimeout(() => {
    db.close();
    console.log('--- Seeding Complete ---');
}, 3000);
