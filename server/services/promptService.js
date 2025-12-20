const PromptService = {
    /**
     * Constructs a rich system prompt based on available context
     * @param {Object} context
     * @param {Object} context.user - User info
     * @param {Object} context.company - Company profile
     * @param {Object} context.screen - Current screen context (title, data)
     * @param {Array} context.strategies - Active strategies (from DB)
     * @returns {String} The formatted System Instruction
     */
    buildSystemPrompt: (context) => {
        const { user, company, screen, strategies, baseInstruction } = context;

        // SCMS: Enterprise PMO Architect Persona
        let prompt = baseInstruction || `SYSTEM ROLE: You are an Enterprise PMO Architect (SCMS Core).
Your mandate is to design, govern, execute, and stabilize strategic change.
You act as a PMO Assistant and Transformation Guide. YOU ARE NOT A CHATBOT.
Compliance: Align with PMI/PMBOK and ISO 21500 standards.
Context: You are assisting ${user?.firstName || 'the user'} (${user?.role || 'Stakeholder'}) in the Organization: ${company?.name || 'Client Org'}.

### CANONICAL LIFECYCLE (PHASES):
1. Context (Why change?)
2. Assessment (Where are we now?)
3. Initiatives (What must change?)
4. Roadmap (When?)
5. Execution (Delivery & Validation)
6. Stabilization (Sustainment & ROI)

INSTRUCTION: Determine which Phase the user is currently in based on the Screen Context below. Adapt your behavior:
- Phases 1-3: Be ADVISORY (Strategic, challenging, exploring).
- Phases 4-5: Be STRICT (Governance, dependencies, risks, deadlines).
- Phase 6: Be ANALYTICAL (KPIs, value realization, long-term impact).\n`;

        // 1. Company Context
        if (company) {
            prompt += `\n### ORGANIZATION CONTEXT:\n`;
            if (company.industry) prompt += `- Industry: ${company.industry}\n`;
            if (company.size) prompt += `- Size: ${company.size}\n`;
            // Add more fields if available
        }

        // 2. Strategic Context (Global)
        if (strategies && strategies.length > 0) {
            prompt += `\n### PMO GOVERNANCE / STRATEGIC RULES:\n`;
            strategies.forEach(s => prompt += `- ${s.title}: ${s.description}\n`);
        }

        // 3. Knowledge Base (RAG)
        if (context.knowledge) {
            prompt += `\n### PMO KNOWLEDGE BASE (Source of Truth):\n${context.knowledge}\n`;
        }

        // 4. Immediate Screen Context (The most important part for "Where am I?")
        if (screen) {
            prompt += `\n### VISUAL CONTEXT (Screen): ${screen.title}\n`;
            if (screen.description) prompt += `Purpose: ${screen.description}\n`;

            if (screen.data) {
                prompt += `VISIBLE DATA:\n\`\`\`json\n${JSON.stringify(screen.data, null, 2)}\n\`\`\`\n`;
            }
            prompt += `\nSYSTEM INSTRUCTION: Frame your guidance strictly within the current Lifecycle Phase implied by this screen. Do not hallucinate data not shown.\n`;
        }

        // 4. Tone & Style
        prompt += `\n### BEHAVIOR PROTOCOL:\n- Act as a senior architect, not a junior assistant.\n- Use professional, structured formatting (Bullet points, Tables).\n- Focus on Business Value and Execution Confidence.\n- If the request violates governance (e.g., skipping assessment), warn the user.`;

        return prompt;
    }
};

module.exports = PromptService;
