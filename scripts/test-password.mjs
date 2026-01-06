import bcrypt from 'bcryptjs';

const password = '123456';
const hash = bcrypt.hashSync(password, 8);

console.log('Password:', password);
console.log('Generated hash:', hash);
console.log('');

// Test verification
const isValid = bcrypt.compareSync(password, hash);
console.log('Verification test:', isValid);

// Get hash from database
import Database from 'better-sqlite3';
const db = new Database('./server/consultify.db');

const user = db.prepare('SELECT email, password FROM users WHERE email = ?').get('admin@dbr77.com');
console.log('\nUser from DB:', user?.email);
console.log('Hash from DB:', user?.password);
console.log('');

if (user) {
    const dbHashValid = bcrypt.compareSync(password, user.password);
    console.log('DB hash validates with "123456":', dbHashValid);
}

db.close();
