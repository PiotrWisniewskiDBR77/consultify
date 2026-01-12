import dotenv from 'dotenv';
dotenv.config();

const providers = [
    'OPENAI_API_KEY',
    'GOOGLE_API_KEY',
    'ANTHROPIC_API_KEY',
    'DEEPSEEK_API_KEY',
    'COHERE_API_KEY',
    'NVIDIA_API_KEY',
    'ALIBABA_API_KEY',
    'ZAI_API_KEY'
];

console.log('--- ENV VAR CHECK ---');
providers.forEach(key => {
    const val = process.env[key];
    if (!val) {
        console.log(`${key}: MISSING`);
    } else if (val.length < 10) {
        console.log(`${key}: TOO SHORT (${val})`);
    } else if (val.startsWith('sk-proj') || val.startsWith('AIza') || val.startsWith('sk-ant') || val.startsWith('nvapi')) {
        console.log(`${key}: PRESENT (Format looks correct: ${val.substring(0, 4)}...)`);
    } else {
        console.log(`${key}: PRESENT (Unknown format: ${val.substring(0, 4)}...)`);
    }
});

console.log('SQLITE_PATH:', process.env.SQLITE_PATH);
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('REDIS_URL:', process.env.REDIS_URL);
