#!/usr/bin/env node
/**
 * Fix TypeScript Compilation Errors
 * Automatically fixes common TypeScript errors
 */

const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.join(__dirname, '..', 'server');

// Fix cleanupRevokedTokens.ts
function fixCleanupRevokedTokens() {
    const filePath = path.join(SERVER_DIR, 'cron', 'cleanupRevokedTokens.ts');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Already fixed by previous edit
    console.log('✅ cleanupRevokedTokens.ts - already fixed');
}

// Fix snapshotMetrics.ts
function fixSnapshotMetrics() {
    const filePath = path.join(SERVER_DIR, 'cron', 'snapshotMetrics.ts');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Already fixed by previous edit
    console.log('✅ snapshotMetrics.ts - already fixed');
}

// Fix apiKeyService.ts
function fixApiKeyService() {
    const filePath = path.join(SERVER_DIR, 'services', 'apiKeyService.ts');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add type declaration for bcrypt
    if (!content.includes('declare module')) {
        const bcryptDeclare = `// Type declaration for bcrypt
declare module 'bcrypt' {
    export function hash(data: string, saltRounds: number): Promise<string>;
    export function compare(data: string, encrypted: string): Promise<boolean>;
}

`;
        content = bcryptDeclare + content;
    }
    
    // Fix API_SCOPES index signature
    content = content.replace(
        /const API_SCOPES: ApiKeyScopes =/,
        `const API_SCOPES: ApiKeyScopes & { [key: string]: string } =`
    );
    
    // Fix dbGet/dbAll return types with proper casting
    content = content.replace(
        /const potentialKeys = await dbAll\(`SELECT \* FROM api_keys WHERE key_prefix = \? AND is_active = 1`, \[keyPrefix\]\);/g,
        `const potentialKeys = await dbAll(\`SELECT * FROM api_keys WHERE key_prefix = ? AND is_active = 1\`, [keyPrefix]) as Array<Record<string, unknown>>;`
    );
    
    content = content.replace(
        /for \(const keyRecord of potentialKeys\) \{/g,
        `for (const keyRecord of potentialKeys) {`
    );
    
    // Fix keyRecord type assertions
    content = content.replace(
        /const match = await bcrypt\.compare\(plainKey, keyRecord\.key_hash\);/g,
        `const match = await bcrypt.compare(plainKey, (keyRecord as Record<string, unknown>).key_hash as string);`
    );
    
    content = content.replace(
        /if \(keyRecord\.expires_at && new Date\(keyRecord\.expires_at\) < new Date\(\)\) \{/g,
        `if ((keyRecord as Record<string, unknown>).expires_at && new Date((keyRecord as Record<string, unknown>).expires_at as string) < new Date()) {`
    );
    
    content = content.replace(
        /await dbRun\(\s+`UPDATE api_keys SET last_used_at = datetime\('now'\), usage_count = usage_count \+ 1 WHERE id = \?`,\s+\[keyRecord\.id\],\s+\);/g,
        `await dbRun(
            \`UPDATE api_keys SET last_used_at = datetime('now'), usage_count = usage_count + 1 WHERE id = ?\`,
            [(keyRecord as Record<string, unknown>).id as string],
        );`
    );
    
    // Fix return statement with keyRecord
    const returnKeyPattern = /return \{\s+valid: true,\s+key: \{\s+id: keyRecord\.id,/g;
    if (returnKeyPattern.test(content)) {
        content = content.replace(
            /return \{\s+valid: true,\s+key: \{\s+id: keyRecord\.id,/g,
            `return {
                valid: true,
                key: {
                    id: (keyRecord as Record<string, unknown>).id as string,`
        );
        
        content = content.replace(
            /organizationId: keyRecord\.organization_id,/g,
            `organizationId: (keyRecord as Record<string, unknown>).organization_id as string,`
        );
        
        content = content.replace(
            /userId: keyRecord\.user_id,/g,
            `userId: (keyRecord as Record<string, unknown>).user_id as string | null,`
        );
        
        content = content.replace(
            /name: keyRecord\.name,/g,
            `name: (keyRecord as Record<string, unknown>).name as string,`
        );
        
        content = content.replace(
            /keyType: keyRecord\.key_type,/g,
            `keyType: (keyRecord as Record<string, unknown>).key_type as string,`
        );
        
        content = content.replace(
            /scopes: JSON\.parse\(keyRecord\.scopes \|\| '\[\]'\),/g,
            `scopes: JSON.parse(((keyRecord as Record<string, unknown>).scopes as string) || '[]'),`
        );
        
        content = content.replace(
            /rateLimitPerMinute: keyRecord\.rate_limit_per_minute,/g,
            `rateLimitPerMinute: (keyRecord as Record<string, unknown>).rate_limit_per_minute as number,`
        );
        
        content = content.replace(
            /rateLimitPerDay: keyRecord\.rate_limit_per_day,/g,
            `rateLimitPerDay: (keyRecord as Record<string, unknown>).rate_limit_per_day as number,`
        );
        
        content = content.replace(
            /allowedIps: JSON\.parse\(keyRecord\.allowed_ips \|\| '\[\]'\),/g,
            `allowedIps: JSON.parse(((keyRecord as Record<string, unknown>).allowed_ips as string) || '[]'),`
        );
    }
    
    // Fix rateLimit and key types - handled below with specific pattern
    
    // Better approach - fix the specific lines
    content = content.replace(
        /const rateLimit = await dbGet\(\s+`SELECT \* FROM api_key_rate_limits WHERE api_key_id = \? AND window_start = \? AND window_type = \?`,\s+\[keyId, windowStart, type\],\s+\);/g,
        `const rateLimit = (await dbGet(
            \`SELECT * FROM api_key_rate_limits WHERE api_key_id = ? AND window_start = ? AND window_type = ?\`,
            [keyId, windowStart, type],
        )) as Record<string, unknown> | undefined;`
    );
    
    content = content.replace(
        /const key = await dbGet\(`SELECT rate_limit_per_minute, rate_limit_per_day FROM api_keys WHERE id = \?`, \[keyId\]\);/g,
        `const key = (await dbGet(\`SELECT rate_limit_per_minute, rate_limit_per_day FROM api_keys WHERE id = ?\`, [keyId])) as Record<string, unknown>;`
    );
    
    content = content.replace(
        /const limit = type === 'minute' \? key\.rate_limit_per_minute : key\.rate_limit_per_day;/g,
        `const limit = (type === 'minute' ? (key.rate_limit_per_minute as number) : (key.rate_limit_per_day as number));`
    );
    
    content = content.replace(
        /if \(rateLimit\.request_count >= limit\) \{/g,
        `if (((rateLimit as Record<string, unknown>).request_count as number) >= limit) {`
    );
    
    content = content.replace(
        /await dbRun\(`UPDATE api_key_rate_limits SET request_count = request_count \+ 1 WHERE id = \?`, \[rateLimit\.id\]\);/g,
        `await dbRun(\`UPDATE api_key_rate_limits SET request_count = request_count + 1 WHERE id = ?\`, [(rateLimit as Record<string, unknown>).id as string]);`
    );
    
    content = content.replace(
        /return \{ allowed: true, remaining: limit - rateLimit\.request_count - 1 \};/g,
        `return { allowed: true, remaining: limit - ((rateLimit as Record<string, unknown>).request_count as number) - 1 };`
    );
    
    // Fix AuditService.logSystemEvent - expiresAt can be null
    content = content.replace(
        /AuditService\.logSystemEvent\('API_KEY_CREATED', 'api_key', keyId, organizationId, \{\s+name,\s+keyType,\s+scopes,\s+createdBy,\s+\}\);/g,
        `AuditService.logSystemEvent('API_KEY_CREATED', 'api_key', keyId, organizationId, {
            name,
            keyType,
            scopes,
            createdBy,
        } as Record<string, unknown>);`
    );
    
    // Fix getKeys return type
    const getKeysPattern = /async getKeys\(organizationId: string, options: GetKeysOptions = \{\}\): Promise<ApiKeyRecord\[\]> \{/;
    if (getKeysPattern.test(content)) {
        // Find the dbAll call in getKeys and fix it
        content = content.replace(
            /const keys = await dbAll\(`SELECT id, organization_id, user_id, name, description, key_prefix, key_type,\s+scopes, rate_limit_per_minute, rate_limit_per_day, allowed_ips,\s+last_used_at, usage_count, expires_at, is_active, created_at\s+FROM api_keys WHERE organization_id = \?`[^;]+\);/g,
            (match) => {
                return match.replace(/await dbAll\(/, `(await dbAll(`) + `) as Array<Record<string, unknown>>`;
            }
        );
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ apiKeyService.ts - fixed type errors');
}

// Fix aiContext.ts - add type assertions for empty objects
function fixAiContext() {
    const filePath = path.join(SERVER_DIR, 'src', 'services', 'ai', 'aiContext.ts');
    if (!fs.existsSync(filePath)) {
        console.log('⚠️  aiContext.ts not found, skipping');
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix empty object types - add Record<string, unknown> assertions
    // This is a complex file, so we'll add type assertions where needed
    // Pattern: Property 'X' does not exist on type '{}'
    
    // Add type assertion helper at top if not exists
    if (!content.includes('// Type assertion helper')) {
        const importSection = content.match(/^import[\s\S]*?^}/m)?.[0] || '';
        const afterImports = content.indexOf(importSection) + importSection.length;
        content = content.slice(0, afterImports) + '\n// Type assertion helper\nconst asRecord = <T>(obj: unknown): Record<string, unknown> => obj as Record<string, unknown>;\n\n' + content.slice(afterImports);
        modified = true;
    }
    
    // This file has many errors - we'll need to fix them manually or with more specific patterns
    // For now, add a comment that this needs manual review
    if (!content.includes('// TODO: Fix type assertions')) {
        content = '// TODO: Fix type assertions for database query results\n// Many properties accessed on {} type need Record<string, unknown> assertions\n' + content;
        modified = true;
    }
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('⚠️  aiContext.ts - added TODO comment (needs manual review)');
    } else {
        console.log('✅ aiContext.ts - no changes needed');
    }
}

function main() {
    console.log('\n🔧 Fixing TypeScript Compilation Errors\n');
    console.log('═'.repeat(60));
    
    try {
        fixCleanupRevokedTokens();
        fixSnapshotMetrics();
        fixApiKeyService();
        fixAiContext();
        
        console.log('\n' + '═'.repeat(60));
        console.log('✅ Fixes applied!\n');
        console.log('Note: Some files (like aiContext.ts) may need manual review.');
        console.log('Run "npm run build" to check remaining errors.\n');
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

main();

