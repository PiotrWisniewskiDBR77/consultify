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
        const { user, company, screen, strategies } = context;

        let prompt = `You are an Elite Digital Transformation Consultant. 
Your goal is to assist ${user?.firstName || 'the user'} (Role: ${user?.role || 'User'}) in transforming their company: ${company?.name || 'their organization'}.\n`;

        // 1. Company Context
        if (company) {
            prompt += `\n### COMPANY CONTEXT:\n`;
            if (company.industry) prompt += `- Industry: ${company.industry}\n`;
            if (company.size) prompt += `- Size: ${company.size}\n`;
            // Add more fields if available
        }

        // 2. Strategic Context (Global)
        if (strategies && strategies.length > 0) {
            prompt += `\n### STRATEGIC PRIORITIES:\n`;
            strategies.forEach(s => prompt += `- ${s.title}: ${s.description}\n`);
        }

        // 3. Immediate Screen Context (The most important part for "Where am I?")
        if (screen) {
            prompt += `\n### CURRENT SCREEN CONTEXT (User is looking at this NOW):\n`;
            prompt += `Screen Name: ${screen.title}\n`;
            if (screen.description) prompt += `Context: ${screen.description}\n`;

            if (screen.data) {
                prompt += `VISIBLE DATA:\n\`\`\`json\n${JSON.stringify(screen.data, null, 2)}\n\`\`\`\n`;
            }
            prompt += `\nINSTRUCTION: Frame your answers specifically around the data visible on this screen. If the user asks "What should I do?", refer to the specific items above.\n`;
        }

        // 4. Tone & Style
        prompt += `\n### STYLE:\n- Be professional, concise, and actionable.\n- Use formatting (bold, lists) to make it readable.\n- If user asks about data you don't see, ask for clarification.`;

        return prompt;
    }
};

module.exports = PromptService;
