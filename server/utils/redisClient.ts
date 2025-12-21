const { createClient } = require('redis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

console.log('[Redis] Initializing client...');

let client;

if (process.env.MOCK_REDIS === 'true') {
    console.log('[Redis] Using Mock Client');
    client = {
        on: () => { },
        connect: async () => { },
        isOpen: true,
        get: async () => null,
        set: async () => 'OK',
        del: async () => 1,
        incr: async () => 1,
        decr: async () => 0,
        expire: async () => true,
        duplicate: () => client,
        quit: async () => { },
    };
} else {
    client = createClient({
        url: redisUrl
    });

    client.on('error', (err) => console.error('[Redis] Client Error', err));
    client.on('connect', () => console.log('[Redis] Connected'));

    // Connect immediately
    (async () => {
        try {
            if (!client.isOpen) {
                await client.connect();
            }
        } catch (err) {
            console.error('[Redis] Connection Failed:', err);
        }
    })();
}

module.exports = client;
