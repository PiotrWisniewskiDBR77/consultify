// AI Service for Project Intelligence Hub
// Provides prompts and context for AI-powered interviews and insight detection

export const INSIGHT_CATEGORIES = {
  objective: {
    label: 'Objectives',
    icon: 'Target',
    color: 'emerald',
    description: 'Project goals and desired outcomes',
    pmoMapping: {
      iso21500: 'Project Objectives (5.3)',
      pmbok7: 'Delivery Performance Domain',
      prince2: 'Business Case Theme',
    },
    questions: [
      'What are the main goals of this project?',
      'What measurable outcomes are you expecting?',
      'What is the timeline for achieving these objectives?',
      'How does this align with organizational strategy?',
    ],
  },
  stakeholder: {
    label: 'Stakeholders',
    icon: 'Users',
    color: 'blue',
    description: 'Key people and their interests',
    pmoMapping: {
      iso21500: 'Stakeholder Engagement (5.5)',
      pmbok7: 'Stakeholder Performance Domain',
      prince2: 'Organization Theme',
    },
    questions: [
      'Who are the key stakeholders for this project?',
      'Who has decision-making authority?',
      'How should we engage with each stakeholder group?',
      'Are there any stakeholders with conflicting interests?',
    ],
  },
  risk: {
    label: 'Risks',
    icon: 'AlertTriangle',
    color: 'amber',
    description: 'Potential threats and uncertainties',
    pmoMapping: {
      iso21500: 'Risk Management (5.8)',
      pmbok7: 'Uncertainty Performance Domain',
      prince2: 'Risk Theme',
    },
    questions: [
      'What are the main risks you see for this project?',
      'What could go wrong that would impact our timeline?',
      'Are there any external factors that concern you?',
      'What is the worst-case scenario we should prepare for?',
    ],
  },
  assumption: {
    label: 'Assumptions',
    icon: 'Lightbulb',
    color: 'yellow',
    description: 'Things taken for granted',
    pmoMapping: {
      iso21500: 'Planning Processes (5.4)',
      pmbok7: 'Planning Performance Domain',
      prince2: 'Plans Theme',
    },
    questions: [
      'What assumptions are we making about resources?',
      'What do we assume about the technical environment?',
      'What market or business assumptions are critical?',
      'What would happen if these assumptions proved false?',
    ],
  },
  constraint: {
    label: 'Constraints',
    icon: 'Lock',
    color: 'red',
    description: 'Fixed boundaries and limitations',
    pmoMapping: {
      iso21500: 'Project Constraints (5.3)',
      pmbok7: 'Project Work Performance Domain',
      prince2: 'Business Case Theme',
    },
    questions: [
      'What budget constraints exist for this project?',
      'Are there fixed deadlines we must meet?',
      'What regulatory or compliance requirements apply?',
      'What resources are limited or unavailable?',
    ],
  },
  decision: {
    label: 'Decisions',
    icon: 'CheckCircle',
    color: 'purple',
    description: 'Key choices and their rationale',
    pmoMapping: {
      iso21500: 'Directing Processes (5.2)',
      pmbok7: 'Team Performance Domain',
      prince2: 'Progress Theme',
    },
    questions: [
      'What major decisions have already been made?',
      'What decisions are still pending?',
      'Who needs to be involved in key decisions?',
      'What criteria will guide our decisions?',
    ],
  },
  dependency: {
    label: 'Dependencies',
    icon: 'Link',
    color: 'indigo',
    description: 'External and internal dependencies',
    pmoMapping: {
      iso21500: 'Integration Management (5.6)',
      pmbok7: 'Delivery Performance Domain',
      prince2: 'Plans Theme',
    },
    questions: [
      'What other projects or systems does this depend on?',
      'Are there external vendors or partners we rely on?',
      'What must be completed before we can start certain work?',
      'Are other projects waiting on our deliverables?',
    ],
  },
  success_criteria: {
    label: 'Success Criteria',
    icon: 'Award',
    color: 'teal',
    description: 'How success will be measured',
    pmoMapping: {
      iso21500: 'Performance Measurement (5.7)',
      pmbok7: 'Measurement Performance Domain',
      prince2: 'Progress Theme',
    },
    questions: [
      'How will we know if this project is successful?',
      'What KPIs should we track?',
      'What are the acceptance criteria for deliverables?',
      'Who will validate that success criteria are met?',
    ],
  },
} as const;

export type InsightCategoryKey = keyof typeof INSIGHT_CATEGORIES;

// System prompt for interview mode
export const INTERVIEW_SYSTEM_PROMPT = `You are an expert project management consultant conducting a structured interview to gather project intelligence. Your role is to:

1. Ask insightful questions about the project
2. Listen carefully to responses and identify key information
3. Probe deeper when you detect important details
4. Help organize information into PMO categories

Categories you're gathering information for:
- Objectives: Project goals and measurable outcomes
- Stakeholders: Key people, their roles, and interests
- Risks: Potential threats and uncertainties
- Assumptions: Things being taken for granted
- Constraints: Fixed boundaries and limitations
- Decisions: Key choices that have been or need to be made
- Dependencies: Internal and external dependencies
- Success Criteria: How success will be measured

Guidelines:
- Be conversational but focused
- Ask one question at a time
- Acknowledge responses before moving on
- Use follow-up questions to get specific details
- When you detect important information, note the category it belongs to
- Be supportive and professional`;

// System prompt for insight detection
export const INSIGHT_DETECTION_PROMPT = `Analyze the following conversation and extract structured project insights. For each insight found, provide:

1. Category (objective, stakeholder, risk, assumption, constraint, decision, dependency, success_criteria)
2. Title (brief, descriptive)
3. Content (structured based on category)
4. Confidence level (high, medium, low)
5. Source quote from the conversation

Return insights as a JSON array. Only include clearly identified insights with sufficient detail.`;

// Generate interview opening based on topic
export function generateInterviewOpening(topic: string, projectName?: string): string {
  const projectContext = projectName ? ` for ${projectName}` : '';

  return `Welcome to the Project Intelligence interview${projectContext}! I'm here to help capture and organize important information about ${topic || 'your project'}.

I'll guide you through a structured conversation covering key areas like objectives, stakeholders, risks, and more. Feel free to share as much detail as you'd like – I'll help organize everything into actionable insights.

Let's start: **What are the primary objectives or goals for this ${topic || 'initiative'}?**`;
}

// Get next interview question based on progress
export function getNextInterviewQuestion(
  currentCategory: InsightCategoryKey,
  answeredQuestions: number[]
): string | null {
  const category = INSIGHT_CATEGORIES[currentCategory];
  if (!category) return null;

  const availableQuestions = category.questions.filter((_, i) => !answeredQuestions.includes(i));

  if (availableQuestions.length === 0) return null;

  return availableQuestions[0];
}

// Transition message between categories
export function getCategoryTransition(
  fromCategory: InsightCategoryKey,
  toCategory: InsightCategoryKey
): string {
  const from = INSIGHT_CATEGORIES[fromCategory];
  const to = INSIGHT_CATEGORIES[toCategory];

  return `Great, I've captured some valuable insights about ${from.label.toLowerCase()}. Now let's discuss **${to.label}** – ${to.description.toLowerCase()}.`;
}
