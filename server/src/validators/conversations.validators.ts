// @ts-nocheck
/**
 * Conversations Validators
 * Zod schemas for conversations-related endpoints
 */

import { z } from 'zod';

// ==================== QUERY SCHEMAS ====================

export const ListConversationsQuerySchema = z.object({
  archived: z.enum(['true', 'false']).optional(),
  starred: z.enum(['true', 'false']).optional(),
  projectId: z.string().uuid().optional(),
  chatProjectId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional(),
});

// ==================== BODY SCHEMAS ====================

export const CreateConversationSchema = z.object({
  title: z.string().max(255).optional(),
  projectId: z.string().uuid().optional(),
  chatProjectId: z.string().uuid().optional(),
  pmoContext: z.record(z.string(), z.unknown()).optional(),
  language: z.enum(['en', 'pl', 'de', 'ar', 'ja', 'es']).optional(),
});

export const UpdateConversationSchema = z.object({
  title: z.string().max(255).optional(),
  starred: z.boolean().optional(),
  archived: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  pmoContext: z.record(z.string(), z.unknown()).optional(),
  chatProjectId: z.string().uuid().nullable().optional(),
  language: z.enum(['en', 'pl', 'de', 'ar', 'ja', 'es']).optional(),
});

export const AddMessageSchema = z.object({
  role: z.enum(['user', 'ai']),
  content: z.string().min(1),
  messageType: z
    .enum([
      'text',
      'action_request',
      'summary',
      'file',
      'tool_call',
      'voice',
      // V8: governed proposal + execution message family (CHAT_V8_ACTIONS_AND_APPROVALS)
      'execution_proposal',
      'execution_progress',
      'execution_result',
    ])
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tokenCount: z.number().int().positive().optional(),
  modelUsed: z.string().max(100).optional(),
});

export const BulkOperationSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['archive', 'unarchive', 'delete', 'star', 'unstar']),
});

export const MigrateConversationsSchema = z.object({
  conversations: z.array(
    z.object({
      projectId: z.string().uuid().optional(),
      messages: z.array(
        z.object({
          role: z.string(),
          content: z.string(),
          timestamp: z.string().optional(),
        })
      ),
    })
  ),
});

// ==================== PARAM SCHEMAS ====================

export const ConversationIdParamSchema = z.object({
  id: z.string().uuid(),
});

// ==================== TYPE EXPORTS ====================

export type ListConversationsQuery = z.infer<typeof ListConversationsQuerySchema>;
export type CreateConversationBody = z.infer<typeof CreateConversationSchema>;
export type UpdateConversationBody = z.infer<typeof UpdateConversationSchema>;
export type AddMessageBody = z.infer<typeof AddMessageSchema>;
export type BulkOperationBody = z.infer<typeof BulkOperationSchema>;
export type MigrateConversationsBody = z.infer<typeof MigrateConversationsSchema>;
