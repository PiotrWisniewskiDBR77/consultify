/**
 * Seed Script for Project Intelligence Hub
 * 
 * Creates sample insights, sessions, and messages for testing
 */

import { v4 as uuidv4 } from 'uuid';

const SAMPLE_PROJECT_ID = 'demo-project-1'; // Replace with actual project ID
const SAMPLE_USER_ID = 'admin-user-1'; // Replace with actual user ID

// Sample Interview Session
const createSession = () => ({
    id: uuidv4(),
    project_id: SAMPLE_PROJECT_ID,
    user_id: SAMPLE_USER_ID,
    topic: 'Initial Project Discovery',
    status: 'completed',
    progress: JSON.stringify({
        completed: ['context', 'objectives', 'stakeholders', 'risks'],
        current: null,
        remaining: ['assumptions', 'constraints', 'success_criteria', 'dependencies']
    }),
    started_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    completed_at: new Date().toISOString(),
    duration_minutes: 45
});

// Sample Insights
const SAMPLE_INSIGHTS = [
    {
        category: 'objective',
        title: 'Increase operational efficiency by 30%',
        content: JSON.stringify({
            description: 'Primary goal is to increase operational efficiency by 30% through process automation and digital transformation initiatives.',
            kpis: ['Throughput rate', 'Error rate', 'Processing time'],
            priority: 'high'
        }),
        confidence: 'high',
        status: 'confirmed',
        pmo_domain: 'BENEFITS_REALIZATION'
    },
    {
        category: 'objective',
        title: 'Reduce manual data entry by 50%',
        content: JSON.stringify({
            description: 'Eliminate redundant manual data entry processes by implementing automated data capture and integration systems.',
            kpis: ['Manual entries per day', 'Data accuracy rate'],
            priority: 'medium'
        }),
        confidence: 'high',
        status: 'confirmed',
        pmo_domain: 'BENEFITS_REALIZATION'
    },
    {
        category: 'stakeholder',
        title: 'John Smith - Executive Sponsor',
        content: JSON.stringify({
            name: 'John Smith',
            role: 'CFO',
            department: 'Finance',
            interest: 'high',
            influence: 'high',
            contact: 'john.smith@company.com'
        }),
        confidence: 'high',
        status: 'confirmed',
        pmo_domain: 'RESOURCE_RESPONSIBILITY'
    },
    {
        category: 'stakeholder',
        title: 'Anna Kowalska - Project Manager',
        content: JSON.stringify({
            name: 'Anna Kowalska',
            role: 'Project Manager',
            department: 'PMO',
            interest: 'high',
            influence: 'medium',
            contact: 'anna.kowalska@company.com'
        }),
        confidence: 'high',
        status: 'confirmed',
        pmo_domain: 'RESOURCE_RESPONSIBILITY'
    },
    {
        category: 'risk',
        title: 'Legacy system integration complexity',
        content: JSON.stringify({
            description: 'Integration with existing legacy ERP system may be more complex than initially estimated due to outdated APIs.',
            probability: 'medium',
            impact: 'high',
            mitigation: 'Engage integration specialist early in the project, conduct thorough API assessment in Phase 1'
        }),
        confidence: 'medium',
        status: 'confirmed',
        pmo_domain: 'RISK_ISSUE_MANAGEMENT'
    },
    {
        category: 'risk',
        title: 'Resource availability during peak season',
        content: JSON.stringify({
            description: 'Key team members may have limited availability during Q4 due to year-end activities.',
            probability: 'high',
            impact: 'medium',
            mitigation: 'Plan critical milestones outside Q4, secure commitment from management for dedicated resources'
        }),
        confidence: 'high',
        status: 'confirmed',
        pmo_domain: 'RISK_ISSUE_MANAGEMENT'
    },
    {
        category: 'assumption',
        title: 'Budget approval before Q2',
        content: JSON.stringify({
            description: 'We assume the full project budget will be approved by the board before end of Q1.',
            validatedBy: 'CFO',
            validationDate: null
        }),
        confidence: 'medium',
        status: 'draft',
        pmo_domain: 'SCOPE_CHANGE_CONTROL'
    },
    {
        category: 'assumption',
        title: 'Cloud infrastructure available',
        content: JSON.stringify({
            description: 'IT department will have the cloud infrastructure ready for deployment by project start.',
            validatedBy: 'CTO',
            validationDate: null
        }),
        confidence: 'medium',
        status: 'confirmed',
        pmo_domain: 'SCOPE_CHANGE_CONTROL'
    },
    {
        category: 'constraint',
        title: 'Budget limit: 500,000 PLN',
        content: JSON.stringify({
            description: 'Total project budget cannot exceed 500,000 PLN including contingency.',
            type: 'budget',
            impact: 'Scope may need to be prioritized if estimates exceed budget'
        }),
        confidence: 'high',
        status: 'confirmed',
        pmo_domain: 'SCOPE_CHANGE_CONTROL'
    },
    {
        category: 'constraint',
        title: 'Go-live deadline: December 2025',
        content: JSON.stringify({
            description: 'System must be operational by December 2025 to align with fiscal year reporting requirements.',
            type: 'time',
            impact: 'Phase 3 features may be deferred to post-launch if schedule slips'
        }),
        confidence: 'high',
        status: 'confirmed',
        pmo_domain: 'SCOPE_CHANGE_CONTROL'
    },
    {
        category: 'decision',
        title: 'Selected cloud provider: Azure',
        content: JSON.stringify({
            description: 'Microsoft Azure selected as the cloud platform for hosting the new system.',
            decidedBy: 'IT Architecture Board',
            date: '2024-12-15',
            rationale: 'Existing enterprise agreement, security compliance, integration with O365'
        }),
        confidence: 'high',
        status: 'confirmed',
        pmo_domain: 'GOVERNANCE_DECISION_MAKING'
    },
    {
        category: 'dependency',
        title: 'SAP upgrade completion',
        content: JSON.stringify({
            description: 'Project depends on completion of SAP S/4HANA upgrade scheduled for Q2.',
            type: 'internal',
            relatedProject: 'SAP Modernization Program',
            owner: 'IT Department'
        }),
        confidence: 'high',
        status: 'confirmed',
        pmo_domain: 'SCHEDULE_MILESTONES'
    },
    {
        category: 'dependency',
        title: 'Vendor contract finalization',
        content: JSON.stringify({
            description: 'Waiting for legal review of implementation partner contract.',
            type: 'external',
            relatedProject: null,
            owner: 'Legal Department'
        }),
        confidence: 'medium',
        status: 'draft',
        pmo_domain: 'SCHEDULE_MILESTONES'
    },
    {
        category: 'success_criteria',
        title: 'System uptime 99.9%',
        content: JSON.stringify({
            description: 'New system must maintain 99.9% uptime after go-live.',
            metric: 'System availability percentage',
            target: '99.9%',
            measurement: 'Measured monthly via monitoring tools'
        }),
        confidence: 'high',
        status: 'confirmed',
        pmo_domain: 'PERFORMANCE_MONITORING'
    },
    {
        category: 'success_criteria',
        title: 'User adoption rate 80%',
        content: JSON.stringify({
            description: 'At least 80% of target users actively using the system within 3 months of launch.',
            metric: 'Active user percentage',
            target: '80%',
            measurement: 'Tracked via system login analytics'
        }),
        confidence: 'medium',
        status: 'confirmed',
        pmo_domain: 'PERFORMANCE_MONITORING'
    }
];

// Sample Messages
const SAMPLE_MESSAGES = [
    { role: 'ai', content: 'Witaj! Jestem Twoim asystentem Project Intelligence. Pomogę Ci zebrać i zorganizować wiedzę o projekcie. Zacznijmy od kontekstu - opowiedz mi o tym projekcie.' },
    { role: 'user', content: 'Projekt dotyczy transformacji cyfrowej naszego działu operacyjnego. Chcemy zwiększyć efektywność o 30% poprzez automatyzację procesów.' },
    { role: 'ai', content: 'Rozumiem - transformacja cyfrowa z ambitnym celem 30% wzrostu efektywności. To solidny cel. Wykryłem to jako główny cel projektu. Kto jest sponsorem tego projektu i kto będzie odpowiedzialny za realizację?' },
    { role: 'user', content: 'Sponsorem jest John Smith, nasz CFO. Project Managerem będzie Anna Kowalska z PMO.' },
    { role: 'ai', content: 'Świetnie, mamy kluczowych interesariuszy. Dodałem Johna Smitha jako Sponsora Wykonawczego i Annę Kowalską jako Project Managera. Jakie widzisz główne ryzyka dla tego projektu?' },
    { role: 'user', content: 'Największym ryzykiem jest integracja ze starym systemem ERP - może być bardziej skomplikowana niż zakładamy. Poza tym, w Q4 zespół może być mniej dostępny przez zamknięcie roku.' }
];

/**
 * Seed the database with sample data
 */
async function seedIntelligenceData(db, projectId, userId) {
    const actualProjectId = projectId || SAMPLE_PROJECT_ID;
    const actualUserId = userId || SAMPLE_USER_ID;
    
    console.log('[Intelligence Seed] Starting seed process...');
    
    // Ensure tables exist
    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS interview_sessions (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            topic TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            progress TEXT DEFAULT '{"completed":[],"current":null,"remaining":[]}',
            started_at TEXT DEFAULT CURRENT_TIMESTAMP,
            completed_at TEXT,
            duration_minutes INTEGER
        )
    `);

    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS project_insights (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            session_id TEXT,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            source TEXT,
            confidence TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'draft',
            related_insights TEXT,
            pmo_domain TEXT,
            created_by TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.runAsync(`
        CREATE TABLE IF NOT EXISTS interview_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            detected_insights TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create session
    const session = createSession();
    session.project_id = actualProjectId;
    session.user_id = actualUserId;
    
    await db.runAsync(`
        INSERT OR REPLACE INTO interview_sessions (id, project_id, user_id, topic, status, progress, started_at, completed_at, duration_minutes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        session.id,
        session.project_id,
        session.user_id,
        session.topic,
        session.status,
        session.progress,
        session.started_at,
        session.completed_at,
        session.duration_minutes
    ]);
    console.log(`[Intelligence Seed] Created session: ${session.id}`);

    // Create insights
    for (const insight of SAMPLE_INSIGHTS) {
        const insightId = uuidv4();
        const now = new Date().toISOString();
        
        await db.runAsync(`
            INSERT OR REPLACE INTO project_insights (id, project_id, session_id, category, title, content, confidence, status, pmo_domain, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            insightId,
            actualProjectId,
            session.id,
            insight.category,
            insight.title,
            insight.content,
            insight.confidence,
            insight.status,
            insight.pmo_domain,
            actualUserId,
            now,
            now
        ]);
    }
    console.log(`[Intelligence Seed] Created ${SAMPLE_INSIGHTS.length} insights`);

    // Create messages
    for (let i = 0; i < SAMPLE_MESSAGES.length; i++) {
        const msg = SAMPLE_MESSAGES[i];
        const msgId = uuidv4();
        const timestamp = new Date(Date.now() - (SAMPLE_MESSAGES.length - i) * 60000).toISOString();
        
        await db.runAsync(`
            INSERT OR REPLACE INTO interview_messages (id, session_id, role, content, created_at)
            VALUES (?, ?, ?, ?, ?)
        `, [
            msgId,
            session.id,
            msg.role,
            msg.content,
            timestamp
        ]);
    }
    console.log(`[Intelligence Seed] Created ${SAMPLE_MESSAGES.length} messages`);

    console.log('[Intelligence Seed] Seed complete!');
    return { sessionId: session.id, insightCount: SAMPLE_INSIGHTS.length };
}

export {
seedIntelligenceData, SAMPLE_INSIGHTS, SAMPLE_MESSAGES
};

export default { seedIntelligenceData, SAMPLE_INSIGHTS, SAMPLE_MESSAGES };









