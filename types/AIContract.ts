import { z } from 'zod';

// --- Zod Schemas for Runtime Validation ---

// Defines the allowed personas for the AI
export const PersonaSchema = z.enum([
    'consultant',       // Helpful, standard
    'project_manager',  // Strict, timeline-focused
    'architect',        // Technical, system-focused
    'analyst',          // Data-driven, precise
    'auditor'           // Compliance-focused, skeptical
]);

// Defines the structure of the UI state (focus, tabs)
export const UIStateSchema = z.object({
    activeTab: z.string().optional(),
    activeModal: z.string().optional(),
    focusedItemId: z.string().optional(),
    mode: z.enum(['view', 'edit', 'create']).optional()
});

// THE MAIN CONTRACT: ScreenContextPayload
export const ScreenContextSchema = z.object({
    version: z.literal('1.0'),

    // Integrity & Lifecycle
    screenId: z.string().min(1, "screenId is required"), // e.g. 'exec_kanban'
    timestamp: z.number(), // generated at source
    sequenceId: z.number(), // strictly increasing counter from frontend

    // Identity
    persona: PersonaSchema.optional().default('consultant'),

    // Business Data (The "Meat")
    data: z.record(z.string(), z.any()), // We allow loose data here, but it must be an object

    // UI Noise
    uiState: UIStateSchema.optional(),

    // Optional: User Intent hint
    intent: z.string().optional() // e.g., "User is trying to fix a bug"
});

// --- TypeScript Types (Derived) ---
export type AIContextPersona = z.infer<typeof PersonaSchema>;
export type ScreenContextUIState = z.infer<typeof UIStateSchema>;
export type ScreenContextPayload = z.infer<typeof ScreenContextSchema>;

// Helper to validate payload
export const validateScreenContext = (payload: unknown): ScreenContextPayload | null => {
    const result = ScreenContextSchema.safeParse(payload);
    if (!result.success) {
        console.error("[ScreenContext] Validation Failed:", result.error);
        return null;
    }
    return result.data;
};
