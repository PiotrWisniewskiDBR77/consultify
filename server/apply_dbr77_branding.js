const sqlite3 = require('sqlite3').verbose();
import path from 'path';
import { v4: uuidv4 } from 'uuid';

const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

const orgId = 'org-dbr77-test';

const branding = {
    logo_url: 'https://dbr77.com/wp-content/uploads/2025/11/Logo-DBR77-RGB-color-for-dark-bgr.png',
    brand_color: '#92004F', // Deep Pink
    accent_color: '#5E50AC', // Purple
    website: 'https://dbr77.com',
    linkedin_url: 'https://pl.linkedin.com/company/dbr77com',
    description: 'Welcome to DBR77 Platform - your innovation partner for the digital future. We are a leading technology company specializing in the development of digital twins, the optimization of marketplace solutions and the creation of digital development roadmaps, aiming to give production and logistics companies a competitive edge through digital solutions.'
};

console.log('--- Applying DBR77 Branding ---');

db.serialize(() => {
    // Check if profile exists
    db.get('SELECT id FROM organization_profiles WHERE organization_id = ?', [orgId], (err, row) => {
        if (err) {
            console.error('Error checking profile:', err.message);
            return;
        }

        if (row) {
            // Update
            const fields = Object.keys(branding).map(key => `${key} = ?`).join(', ');
            const values = Object.values(branding);
            values.push(orgId);

            db.run(`UPDATE organization_profiles SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ?`, values, (err) => {
                if (err) console.error('Error updating branding:', err.message);
                else console.log('DBR77 Branding updated successfully.');
                db.close();
            });
        } else {
            // Insert
            const id = uuidv4();
            const keys = ['id', 'organization_id', ...Object.keys(branding)];
            const placeholders = keys.map(() => '?').join(', ');
            const values = [id, orgId, ...Object.values(branding)];

            db.run(`INSERT INTO organization_profiles (${keys.join(', ')}) VALUES (${placeholders})`, values, (err) => {
                if (err) console.error('Error inserting branding:', err.message);
                else console.log('DBR77 Branding inserted successfully.');
                db.close();
            });
        }
    });

    // Update the organization name and plan just in case
    db.run(`UPDATE organizations SET name = 'DBR77', plan = 'enterprise' WHERE id = ?`, [orgId], (err) => {
        if (err) console.error('Error updating organization info:', err.message);
        else console.log('Organization name and plan verified.');
    });
});
