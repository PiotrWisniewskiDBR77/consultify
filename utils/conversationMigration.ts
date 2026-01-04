/**
 * Conversation Migration Utility
 *
 * Migrates chat messages from localStorage (legacy Zustand store)
 * to the new database-backed conversation system.
 */

import { Api } from '../services/api';
import { ChatMessage } from '../types';

const MIGRATION_KEY = 'consultify-conversations-migrated';
const LEGACY_STORAGE_KEY = 'consultify-storage';

interface LegacyStoreState {
    state: {
        projectChatMessages?: Record<string, ChatMessage[]>;
        activeChatMessages?: ChatMessage[];
    };
}

/**
 * Check if migration has already been performed
 */
export function isMigrationComplete(): boolean {
    return localStorage.getItem(MIGRATION_KEY) === 'true';
}

/**
 * Mark migration as complete
 */
function markMigrationComplete(): void {
    localStorage.setItem(MIGRATION_KEY, 'true');
}

/**
 * Get legacy chat data from localStorage
 */
function getLegacyData(): LegacyStoreState | null {
    try {
        const data = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (!data) return null;
        return JSON.parse(data) as LegacyStoreState;
    } catch (err) {
        console.error('[Migration] Failed to parse legacy data:', err);
        return null;
    }
}

/**
 * Extract conversation data for migration
 */
function extractConversations(legacyData: LegacyStoreState): Array<{
    projectId?: string;
    messages: Array<{ role: string; content: string; timestamp?: Date }>;
}> {
    const conversations: Array<{
        projectId?: string;
        messages: Array<{ role: string; content: string; timestamp?: Date }>;
    }> = [];

    const { projectChatMessages, activeChatMessages } = legacyData.state || {};

    // Extract project-specific messages
    if (projectChatMessages) {
        for (const [projectId, messages] of Object.entries(projectChatMessages)) {
            if (messages && messages.length > 0) {
                conversations.push({
                    projectId: projectId === 'global' ? undefined : projectId,
                    messages: messages.map((m) => ({
                        role: m.role,
                        content: m.content,
                        timestamp: m.timestamp,
                    })),
                });
            }
        }
    }

    // Extract active messages if not already captured
    if (activeChatMessages && activeChatMessages.length > 0) {
        // Check if these are different from project messages
        const isAlreadyCaptured = conversations.some(
            (c) =>
                c.messages.length === activeChatMessages.length &&
                c.messages[0]?.content === activeChatMessages[0]?.content,
        );

        if (!isAlreadyCaptured) {
            conversations.push({
                messages: activeChatMessages.map((m) => ({
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp,
                })),
            });
        }
    }

    return conversations;
}

/**
 * Perform migration of legacy conversations to database
 * @returns Migration result
 */
export async function migrateConversations(): Promise<{
    success: boolean;
    migratedCount: number;
    error?: string;
}> {
    // Skip if already migrated
    if (isMigrationComplete()) {
        console.log('[Migration] Already complete, skipping');
        return { success: true, migratedCount: 0 };
    }

    // Get legacy data
    const legacyData = getLegacyData();
    if (!legacyData) {
        console.log('[Migration] No legacy data found');
        markMigrationComplete();
        return { success: true, migratedCount: 0 };
    }

    // Extract conversations
    const conversations = extractConversations(legacyData);
    if (conversations.length === 0) {
        console.log('[Migration] No conversations to migrate');
        markMigrationComplete();
        return { success: true, migratedCount: 0 };
    }

    try {
        console.log(`[Migration] Migrating ${conversations.length} conversations...`);

        // Call API to migrate
        const result = await Api.migrateConversations(conversations);

        if (result.success) {
            console.log(`[Migration] Successfully migrated ${result.migrated.length} conversations`);
            markMigrationComplete();

            // Clean up legacy data (optional - keep for rollback)
            // cleanupLegacyData();

            return {
                success: true,
                migratedCount: result.migrated.length,
            };
        } else {
            throw new Error('Migration API returned failure');
        }
    } catch (err) {
        console.error('[Migration] Failed:', err);
        return {
            success: false,
            migratedCount: 0,
            error: err instanceof Error ? err.message : 'Unknown error',
        };
    }
}

/**
 * Clean up legacy data after successful migration
 * (Optional - call manually if needed)
 */
export function cleanupLegacyData(): void {
    try {
        const legacyData = getLegacyData();
        if (legacyData && legacyData.state) {
            // Remove chat messages from state
            delete legacyData.state.projectChatMessages;
            delete legacyData.state.activeChatMessages;
            localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyData));
            console.log('[Migration] Cleaned up legacy chat data');
        }
    } catch (err) {
        console.error('[Migration] Cleanup failed:', err);
    }
}

/**
 * Reset migration flag (for testing/debugging)
 */
export function resetMigrationFlag(): void {
    localStorage.removeItem(MIGRATION_KEY);
    console.log('[Migration] Reset migration flag');
}

/**
 * Hook to auto-migrate on first load
 * Call this in App.tsx or a global provider
 */
export function useMigration(): { migrating: boolean; migrated: boolean } {
    const [migrating, setMigrating] = React.useState(false);
    const [migrated, setMigrated] = React.useState(isMigrationComplete());

    React.useEffect(() => {
        if (!migrated && !migrating) {
            setMigrating(true);
            migrateConversations()
                .then((result) => {
                    setMigrated(result.success);
                })
                .finally(() => {
                    setMigrating(false);
                });
        }
    }, [migrated, migrating]);

    return { migrating, migrated };
}

// Need React import for the hook
import React from 'react';

export default {
    isMigrationComplete,
    migrateConversations,
    cleanupLegacyData,
    resetMigrationFlag,
    useMigration,
};


