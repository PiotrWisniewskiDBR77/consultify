-- Migration: 240_ai_development_demo_seed.sql
-- Purpose: Seed demo data for AI Development module
-- Tables: ai_system_prompts, ai_prompt_blocks, ai_experiments, knowledge_candidates, global_strategies
-- Date: 2026-01-10

-- ============================================
-- AI SYSTEM PROMPTS (Extended Demo Data)
-- ============================================

INSERT OR IGNORE INTO ai_system_prompts (id, key, name, content, description, category, system_prompt, user_prompt_template, variables, is_active, version)
VALUES 
    -- Strategic Consulting Prompts
    ('prompt-strategic-analysis', 'strategic_analysis', 'Strategic Analysis', 
     'You are a Harvard MBA-level strategic consultant. Analyze business situations with rigorous frameworks and provide actionable recommendations.',
     'Capability: analysis, Language: en', 'analysis',
     'You are a senior strategic consultant with 20+ years of experience at McKinsey, BCG, and Bain. Your approach combines rigorous analytical frameworks with practical business acumen. Always structure your analysis using proven methodologies like SWOT, Porter''s Five Forces, or Blue Ocean Strategy as appropriate.',
     'Analyze the following business situation: {{situation}}\n\nConsider:\n- Market dynamics\n- Competitive landscape\n- Internal capabilities\n- Strategic options',
     '["situation", "industry", "timeframe"]', 1, 1),
    
    ('prompt-digital-maturity', 'digital_maturity', 'Digital Maturity Assessment',
     'Assess organizational digital maturity across key dimensions and provide improvement roadmap.',
     'Capability: assessment, Language: en', 'assessment',
     'You are a digital transformation expert specializing in maturity assessments. Use established frameworks to evaluate organizations across dimensions: Strategy & Leadership, Customer Experience, Operations, Technology, Culture & Talent, and Innovation.',
     'Assess the digital maturity of {{organization_name}} based on:\n{{assessment_data}}\n\nProvide:\n1. Current maturity score (1-5)\n2. Gap analysis\n3. Priority recommendations',
     '["organization_name", "assessment_data", "industry"]', 1, 1),
    
    ('prompt-initiative-generator', 'initiative_generator', 'Initiative Generator',
     'Generate strategic initiatives based on assessment gaps and organizational goals.',
     'Capability: generation, Language: en', 'initiative',
     'You are an expert in designing digital transformation initiatives. Create detailed, actionable initiatives that address specific gaps while considering organizational constraints, resource availability, and change management requirements.',
     'Generate initiatives to address:\nGaps: {{gaps}}\nGoals: {{goals}}\nConstraints: {{constraints}}\n\nFor each initiative provide: name, description, expected impact, effort estimate, dependencies, and success metrics.',
     '["gaps", "goals", "constraints", "budget_range"]', 1, 1),
    
    ('prompt-risk-advisor', 'risk_advisor', 'Risk Advisor',
     'Identify and assess risks for strategic initiatives and digital transformation programs.',
     'Capability: advisor, Language: en', 'task',
     'You are a risk management specialist with expertise in digital transformation. Analyze initiatives and programs for potential risks across categories: Strategic, Operational, Technical, Financial, Organizational, and External. Use probability-impact matrices for prioritization.',
     'Assess risks for:\nInitiative: {{initiative_name}}\nDescription: {{description}}\nTimeline: {{timeline}}\n\nProvide risk register with mitigation strategies.',
     '["initiative_name", "description", "timeline", "organization_context"]', 1, 1),
    
    ('prompt-report-writer', 'report_writer', 'Executive Report Writer',
     'Generate executive-level reports and presentations from analysis data.',
     'Capability: generation, Language: en', 'generation',
     'You are an expert business writer who creates compelling executive communications. Your reports are clear, concise, and action-oriented. Use visual formatting, bullet points, and executive summaries to enhance readability.',
     'Create an executive report on:\nTopic: {{topic}}\nAudience: {{audience}}\nKey Data: {{data}}\n\nInclude: Executive Summary, Key Findings, Recommendations, Next Steps.',
     '["topic", "audience", "data", "format"]', 1, 1),

    -- Chat Assistants
    ('prompt-chat-strategic', 'chat_strategic', 'Strategic Chat Assistant',
     'Conversational AI for strategic planning discussions.',
     'Capability: chat, Language: en', 'chat',
     'You are a strategic advisor engaged in a collaborative dialogue. Ask clarifying questions, challenge assumptions constructively, and guide the conversation toward actionable insights. Use the Socratic method to help users discover solutions.',
     '{{user_message}}',
     '["user_message", "context", "previous_messages"]', 1, 1),
    
    ('prompt-chat-pmo', 'chat_pmo', 'PMO Assistant',
     'Project Management Office conversational assistant.',
     'Capability: chat, Language: en', 'chat',
     'You are a PMO expert helping with project and portfolio management. Provide guidance on methodologies (Agile, Waterfall, Hybrid), governance, resource allocation, and stakeholder management. Reference ISO 21500, PMBOK, and PRINCE2 standards.',
     '{{user_message}}',
     '["user_message", "project_context", "methodology"]', 1, 1),

    -- Multi-language templates
    ('prompt-multilang-analysis', 'multilang_analysis', 'Multi-Language Analysis',
     'Language-independent analysis template.',
     'Capability: analysis, Language: multi', 'analysis',
     'ROLE: Expert analyst providing objective assessment.\nBEHAVIOR: Respond in the same language as the input. Use clear, professional terminology. Avoid idioms.\nOUTPUT: Structured analysis with numbered sections.',
     'INPUT_LANGUAGE: Detect from {{input}}\nANALYZE: {{input}}\nOUTPUT_LANGUAGE: Same as input',
     '["input"]', 1, 1);

-- ============================================
-- AI PROMPT BLOCKS (Composable Components)
-- ============================================

INSERT OR IGNORE INTO ai_prompt_blocks (id, name, description, category, content, variables, is_active, usage_count)
VALUES 
    -- ROLE Blocks
    ('block-role-strategic', 'Strategic Consultant Role', 'Establishes Harvard MBA/PhD level strategic consulting persona', 'ROLE',
     'You are a senior strategic consultant with Harvard MBA credentials and 20+ years of experience at top-tier consulting firms (McKinsey, BCG, Bain). Your expertise spans corporate strategy, digital transformation, and organizational change. You combine rigorous analytical frameworks with practical business acumen.',
     '[]', 1, 45),
    
    ('block-role-pmo', 'PMO Expert Role', 'Establishes project management expertise', 'ROLE',
     'You are a certified PMO expert (PMP, PRINCE2 Practitioner, SAFe Agilist) with extensive experience in managing complex portfolios and programs. You are well-versed in ISO 21500, PMBOK 7th Edition, and hybrid methodologies.',
     '[]', 1, 38),
    
    ('block-role-analyst', 'Data Analyst Role', 'Establishes analytical expertise', 'ROLE',
     'You are a senior data analyst specialized in business intelligence and strategic insights. You excel at transforming complex data into actionable recommendations using statistical methods and visualization best practices.',
     '[]', 1, 32),

    -- BEHAVIOR Blocks
    ('block-behavior-professional', 'Professional Communication', 'Sets professional, clear communication style', 'BEHAVIOR',
     'COMMUNICATION STYLE:\n- Use clear, professional language\n- Avoid jargon unless necessary (define when used)\n- Structure responses with headers and bullet points\n- Be concise but comprehensive\n- Maintain objective tone',
     '[]', 1, 67),
    
    ('block-behavior-socratic', 'Socratic Method', 'Enables questioning and discovery approach', 'BEHAVIOR',
     'INTERACTION STYLE:\n- Ask clarifying questions before providing solutions\n- Challenge assumptions constructively\n- Guide users to discover insights through dialogue\n- Validate understanding before proceeding\n- Encourage critical thinking',
     '[]', 1, 28),
    
    ('block-behavior-multilang', 'Multi-Language Behavior', 'Ensures language-independent responses', 'BEHAVIOR',
     'LANGUAGE HANDLING:\n- Detect input language automatically\n- Respond in the same language as input\n- Use universally understood concepts\n- Avoid idioms, slang, and culture-specific references\n- Maintain consistent terminology across languages',
     '[]', 1, 41),

    -- OUTPUT Blocks
    ('block-output-executive', 'Executive Summary Format', 'Structures output for executive audience', 'OUTPUT',
     'OUTPUT FORMAT:\n1. **Executive Summary** (2-3 sentences, key takeaways)\n2. **Key Findings** (bullet points, max 5)\n3. **Analysis** (structured sections)\n4. **Recommendations** (numbered, actionable)\n5. **Next Steps** (specific, time-bound)',
     '[]', 1, 52),
    
    ('block-output-technical', 'Technical Report Format', 'Structures output for technical audience', 'OUTPUT',
     'OUTPUT FORMAT:\n1. **Overview** (problem statement, scope)\n2. **Methodology** (approach, tools used)\n3. **Technical Analysis** (detailed findings)\n4. **Data & Evidence** (supporting information)\n5. **Technical Recommendations** (implementation details)\n6. **Appendix** (additional data, references)',
     '[]', 1, 24),
    
    ('block-output-bullet', 'Bullet Point Format', 'Simple bullet point response format', 'OUTPUT',
     'OUTPUT FORMAT:\n- Use bullet points for all main content\n- Keep each point to 1-2 sentences\n- Group related points under headers\n- Use sub-bullets for details\n- End with clear action items',
     '[]', 1, 89),

    -- CONSTRAINT Blocks
    ('block-constraint-factual', 'Factual Constraints', 'Limits responses to verifiable information', 'CONSTRAINT',
     'CONSTRAINTS:\n- Only provide information that can be verified\n- Distinguish between facts and opinions/assumptions\n- Cite sources when available\n- Acknowledge uncertainty explicitly\n- Avoid speculation without clear caveats',
     '[]', 1, 35),
    
    ('block-constraint-scope', 'Scope Boundaries', 'Maintains focus on defined scope', 'CONSTRAINT',
     'SCOPE CONSTRAINTS:\n- Stay within the defined topic/question\n- If asked about out-of-scope topics, acknowledge and redirect\n- Provide relevant context without scope creep\n- Reference scope boundaries when declining requests',
     '[]', 1, 22),
    
    ('block-constraint-length', 'Response Length Control', 'Controls response verbosity', 'CONSTRAINT',
     'LENGTH CONSTRAINTS:\n- Keep responses concise and focused\n- Aim for {{max_words}} words maximum\n- Use progressive disclosure (summary first, details on request)\n- Avoid repetition and filler content',
     '["max_words"]', 1, 18),

    -- CONTEXT Blocks
    ('block-context-org', 'Organization Context', 'Injects organizational context', 'CONTEXT',
     'ORGANIZATION CONTEXT:\n- Name: {{organization_name}}\n- Industry: {{industry}}\n- Size: {{organization_size}}\n- Current Maturity: {{maturity_level}}\n- Key Challenges: {{challenges}}\n\nConsider this context in all responses.',
     '["organization_name", "industry", "organization_size", "maturity_level", "challenges"]', 1, 44),
    
    ('block-context-project', 'Project Context', 'Injects project-specific context', 'CONTEXT',
     'PROJECT CONTEXT:\n- Project: {{project_name}}\n- Phase: {{current_phase}}\n- Timeline: {{timeline}}\n- Budget: {{budget}}\n- Stakeholders: {{key_stakeholders}}\n- Risks: {{known_risks}}',
     '["project_name", "current_phase", "timeline", "budget", "key_stakeholders", "known_risks"]', 1, 31),

    -- TASK Blocks
    ('block-task-analyze', 'Analysis Task', 'Standard analysis task template', 'TASK',
     'TASK: Analyze the following:\n{{input}}\n\nAnalysis should cover:\n1. Current state assessment\n2. Gap identification\n3. Root cause analysis\n4. Impact evaluation\n5. Recommendation prioritization',
     '["input"]', 1, 56),
    
    ('block-task-compare', 'Comparison Task', 'Comparison and evaluation task template', 'TASK',
     'TASK: Compare and evaluate:\nOption A: {{option_a}}\nOption B: {{option_b}}\n\nEvaluation criteria:\n- Feasibility\n- Cost-effectiveness\n- Risk profile\n- Strategic alignment\n- Implementation complexity\n\nProvide recommendation with rationale.',
     '["option_a", "option_b"]', 1, 27),
    
    ('block-task-generate', 'Generation Task', 'Content generation task template', 'TASK',
     'TASK: Generate {{output_type}} based on:\nInput: {{input}}\nRequirements: {{requirements}}\nFormat: {{format}}\n\nEnsure output meets all specified requirements and follows format guidelines.',
     '["output_type", "input", "requirements", "format"]', 1, 42);

-- ============================================
-- AI EXPERIMENTS (A/B Testing Demo Data)
-- Uses ai_ab_experiments table from 052_ab_testing.sql
-- ============================================

-- Insert demo experiments into existing ai_ab_experiments table
INSERT OR IGNORE INTO ai_ab_experiments (id, name, description, prompt_id, status, primary_metric, min_sample_size, confidence_level, variants, traffic_split, created_by, created_at, started_at)
VALUES 
    ('exp-chat-prompt-v2', 'Chat Prompt v2 Test', 'Testing improved chat prompt with enhanced context handling', 'prompt-chat-strategic', 'running', 'user_satisfaction', 200, 0.95,
     '[{"id":"var-control","name":"Control","description":"Current production prompt","config":{}},{"id":"var-enhanced","name":"Enhanced v2","description":"New context-aware prompt","config":{}}]',
     '[50, 50]', 'system', datetime('now', '-14 days'), datetime('now', '-14 days')),
    
    ('exp-model-routing', 'Model Routing Optimization', 'Compare GPT-4 vs Claude for strategic analysis', 'prompt-strategic-analysis', 'running', 'quality_score', 150, 0.95,
     '[{"id":"var-gpt4","name":"GPT-4","description":"OpenAI GPT-4 for analysis","config":{"model":"gpt-4"}},{"id":"var-claude","name":"Claude 3","description":"Anthropic Claude 3 for analysis","config":{"model":"claude-3"}}]',
     '[50, 50]', 'system', datetime('now', '-10 days'), datetime('now', '-10 days')),
    
    ('exp-temperature-tuning', 'Temperature Parameter Tuning', 'Find optimal temperature for creative generation', 'prompt-initiative-generator', 'completed', 'engagement', 300, 0.95,
     '[{"id":"var-temp-07","name":"Temperature 0.7","description":"Default temperature","config":{"temperature":0.7}},{"id":"var-temp-09","name":"Temperature 0.9","description":"Higher creativity","config":{"temperature":0.9}}]',
     '[50, 50]', 'system', datetime('now', '-30 days'), datetime('now', '-30 days')),

    ('exp-multilang-prompts', 'Multi-Language Prompt Test', 'Testing language-independent vs language-specific prompts', 'prompt-multilang-analysis', 'draft', 'language_accuracy', 500, 0.99,
     '[{"id":"var-specific","name":"Language-Specific","description":"Separate prompts per language","config":{}},{"id":"var-independent","name":"Language-Independent","description":"Single universal prompt","config":{}}]',
     '[50, 50]', 'system', datetime('now', '-1 days'), NULL);

-- Add variant_id columns to support the service (which uses variant_id instead of variant_index)
-- This is safe - will be ignored if columns already exist
ALTER TABLE ai_ab_assignments ADD COLUMN variant_id TEXT;
ALTER TABLE ai_ab_outcomes ADD COLUMN variant_id TEXT;

-- Add some demo A/B test outcomes for running experiments
-- Using both variant_index (original schema) and variant_id (service expectation)
INSERT OR IGNORE INTO ai_ab_outcomes (id, experiment_id, user_id, variant_index, variant_id, metric, value, recorded_at)
VALUES
    -- Chat Prompt v2 Test outcomes
    ('out-001', 'exp-chat-prompt-v2', 'demo-user-1', 0, 'var-control', 'satisfaction', 4.0, datetime('now', '-10 days')),
    ('out-002', 'exp-chat-prompt-v2', 'demo-user-2', 1, 'var-enhanced', 'satisfaction', 4.5, datetime('now', '-9 days')),
    ('out-003', 'exp-chat-prompt-v2', 'demo-user-3', 0, 'var-control', 'satisfaction', 3.5, datetime('now', '-8 days')),
    ('out-004', 'exp-chat-prompt-v2', 'demo-user-1', 1, 'var-enhanced', 'satisfaction', 4.2, datetime('now', '-7 days')),
    ('out-005', 'exp-chat-prompt-v2', 'demo-user-2', 0, 'var-control', 'satisfaction', 3.8, datetime('now', '-6 days')),
    ('out-006', 'exp-chat-prompt-v2', 'demo-user-3', 1, 'var-enhanced', 'satisfaction', 4.8, datetime('now', '-5 days')),
    ('out-007', 'exp-chat-prompt-v2', 'demo-user-1', 0, 'var-control', 'conversion', 1, datetime('now', '-10 days')),
    ('out-008', 'exp-chat-prompt-v2', 'demo-user-2', 1, 'var-enhanced', 'conversion', 1, datetime('now', '-9 days')),
    ('out-009', 'exp-chat-prompt-v2', 'demo-user-3', 1, 'var-enhanced', 'conversion', 1, datetime('now', '-8 days')),
    ('out-010', 'exp-chat-prompt-v2', 'demo-user-1', 0, 'var-control', 'latency', 1200, datetime('now', '-10 days')),
    ('out-011', 'exp-chat-prompt-v2', 'demo-user-2', 1, 'var-enhanced', 'latency', 1350, datetime('now', '-9 days')),
    -- Model Routing outcomes
    ('out-012', 'exp-model-routing', 'demo-user-1', 0, 'var-gpt4', 'satisfaction', 4.1, datetime('now', '-8 days')),
    ('out-013', 'exp-model-routing', 'demo-user-2', 1, 'var-claude', 'satisfaction', 4.3, datetime('now', '-7 days')),
    ('out-014', 'exp-model-routing', 'demo-user-3', 0, 'var-gpt4', 'satisfaction', 4.0, datetime('now', '-6 days')),
    ('out-015', 'exp-model-routing', 'demo-user-1', 1, 'var-claude', 'satisfaction', 4.5, datetime('now', '-5 days'));

-- Add A/B test assignments
INSERT OR IGNORE INTO ai_ab_assignments (id, experiment_id, user_id, variant_index, variant_id, assigned_at)
VALUES
    ('assign-001', 'exp-chat-prompt-v2', 'demo-user-1', 0, 'var-control', datetime('now', '-14 days')),
    ('assign-002', 'exp-chat-prompt-v2', 'demo-user-2', 1, 'var-enhanced', datetime('now', '-14 days')),
    ('assign-003', 'exp-chat-prompt-v2', 'demo-user-3', 0, 'var-control', datetime('now', '-14 days')),
    ('assign-004', 'exp-model-routing', 'demo-user-1', 0, 'var-gpt4', datetime('now', '-10 days')),
    ('assign-005', 'exp-model-routing', 'demo-user-2', 1, 'var-claude', datetime('now', '-10 days')),
    ('assign-006', 'exp-model-routing', 'demo-user-3', 0, 'var-gpt4', datetime('now', '-10 days'));

-- ============================================
-- KNOWLEDGE CANDIDATES (Ideas Demo Data)
-- ============================================

INSERT OR IGNORE INTO knowledge_candidates (id, content, reasoning, source, status, category, tags, impact_score, created_at)
VALUES 
    ('idea-001', 'Add real-time collaboration features to assessment module', 
     'Multiple users frequently need to work on the same assessment simultaneously. Real-time sync would improve team efficiency and reduce version conflicts.',
     'user_feedback', 'pending', 'Process Improvement', '["collaboration", "assessment", "real-time"]', 4.5, datetime('now', '-5 days')),
    
    ('idea-002', 'Implement AI-powered risk prediction for initiatives',
     'AI could analyze historical data to predict potential risks before they materialize, enabling proactive mitigation.',
     'ai_suggestion', 'approved', 'Tool Usage', '["AI", "risk-management", "predictive"]', 5.0, datetime('now', '-10 days')),
    
    ('idea-003', 'Add gamification elements to increase user engagement',
     'Achievements, progress bars, and team competitions could motivate users to complete assessments and follow recommendations.',
     'user_feedback', 'implemented', 'Team Collaboration', '["gamification", "engagement", "motivation"]', 4.0, datetime('now', '-30 days')),
    
    ('idea-004', 'Create industry-specific assessment templates',
     'Pre-configured templates for Healthcare, Finance, Manufacturing would accelerate onboarding for new clients.',
     'consultant_insight', 'pending', 'Process Improvement', '["templates", "industry", "onboarding"]', 4.2, datetime('now', '-2 days')),
    
    ('idea-005', 'Integrate with external data sources for benchmarking',
     'Connecting to industry databases would enable automatic benchmarking against peers without manual data entry.',
     'ai_suggestion', 'approved', 'Tool Usage', '["integration", "benchmarking", "automation"]', 4.8, datetime('now', '-15 days'));

-- ============================================
-- GLOBAL STRATEGIES (Strategic Directions Demo)
-- ============================================

INSERT OR IGNORE INTO global_strategies (id, title, description, priority, progress_percentage, success_metrics, is_active, created_at)
VALUES 
    ('strategy-ai-first', 'AI-First Approach', 
     'Prioritize AI-powered solutions in all new features. The AI should be the primary interface for user interactions, with traditional UI as fallback.',
     'high', 75, '["AI interaction rate > 60%", "User satisfaction > 4.0", "Task completion time reduction > 30%"]', 1, datetime('now', '-60 days')),
    
    ('strategy-multilang', 'Multi-Language Excellence',
     'Ensure all features work flawlessly across all 6 supported languages. Language detection should be automatic and responses should be culturally appropriate.',
     'high', 60, '["Language accuracy > 95%", "User satisfaction consistent across languages", "Zero language-related bugs"]', 1, datetime('now', '-45 days')),
    
    ('strategy-enterprise', 'Enterprise-Grade Security',
     'Implement and maintain enterprise-level security standards. All data must be encrypted, access must be audited, and compliance must be continuous.',
     'urgent', 85, '["SOC2 compliance", "GDPR compliance", "Zero security incidents", "100% audit coverage"]', 1, datetime('now', '-90 days')),
    
    ('strategy-ux', 'Seamless User Experience',
     'Create intuitive, consistent user experiences across all modules. Reduce friction, minimize clicks, and provide contextual help at every step.',
     'medium', 50, '["NPS > 50", "Task completion rate > 90%", "Support ticket reduction > 40%"]', 1, datetime('now', '-30 days'));

-- ============================================
-- AI FEEDBACK (For Stats)
-- ============================================

CREATE TABLE IF NOT EXISTS ai_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    prompt_id TEXT,
    rating INTEGER,
    feedback_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO ai_feedback (id, user_id, prompt_id, rating, feedback_text, created_at)
VALUES 
    ('fb-001', 'demo-user-1', 'prompt-strategic-analysis', 5, 'Excellent strategic insights', datetime('now', '-1 days')),
    ('fb-002', 'demo-user-2', 'prompt-digital-maturity', 4, 'Good assessment framework', datetime('now', '-2 days')),
    ('fb-003', 'demo-user-1', 'prompt-chat-strategic', 5, 'Very helpful dialogue', datetime('now', '-3 days')),
    ('fb-004', 'demo-user-3', 'prompt-initiative-generator', 4, 'Creative suggestions', datetime('now', '-4 days')),
    ('fb-005', 'demo-user-2', 'prompt-risk-advisor', 5, 'Comprehensive risk analysis', datetime('now', '-5 days')),
    ('fb-006', 'demo-user-1', 'prompt-report-writer', 4, 'Clear executive summary', datetime('now', '-6 days')),
    ('fb-007', 'demo-user-3', 'prompt-chat-pmo', 5, 'Great PMO guidance', datetime('now', '-7 days')),
    ('fb-008', 'demo-user-2', 'prompt-multilang-analysis', 4, 'Works well in German', datetime('now', '-8 days'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_experiments_status ON ai_experiments(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_candidates_status ON knowledge_candidates(status);
CREATE INDEX IF NOT EXISTS idx_global_strategies_active ON global_strategies(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created ON ai_feedback(created_at);
