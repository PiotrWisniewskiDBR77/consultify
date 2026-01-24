const db = require('../database');
const { v4: uuidv4 } = require('uuid');

async function testInvitation() {
    console.log('Testing invitation creation...');

    // First, check the table structure
    await new Promise((resolve) => {
        db.all("PRAGMA table_info(invitations)", [], (err, rows) => {
            if (err) {
                console.error('Error getting table info:', err);
            } else {
                console.log('Table Structure:');
                rows.forEach(row => {
                    console.log(`- ${row.name}: ${row.type} (NotNull: ${row.notnull}, PK: ${row.pk})`);
                });
            }
            resolve();
        });
    });

    const result = await new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO invitations (id, organization_id, email, role, token, status, expires_at) 
             VALUES (?, ?, ?, ?, ?, 'pending', datetime('now', '+7 days'))`,
            [uuidv4(), 'org-dbr77-system', 'test@example.com', 'USER', null], // Explicit NULL for token
            function (err) {
                if (err) {
                    console.error('Expected failure:', err.message);
                    resolve(err);
                } else {
                    console.log('Success (True if nullable)');
                    resolve(null);
                }
            }
        );
    });

    if (result && result.message.includes('NOT NULL constraint failed: invitations.token')) {
        console.log('\n❌ FAILED: invitation.token NOT NULL constraint is STILL active.');
    } else {
        console.log('\n✅ SUCCESS: invitation.token is now NULLABLE.');
    }

    process.exit(0);
}

testInvitation();
