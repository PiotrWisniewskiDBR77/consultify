-- Migration: 046_compliance.sql
-- Compliance Center - SOC2, GDPR, HIPAA, ISO27001
-- Created: 2025-12-27

-- Compliance frameworks
CREATE TABLE IF NOT EXISTS compliance_frameworks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE, -- 'SOC2', 'GDPR', 'HIPAA', 'ISO27001'
    display_name TEXT NOT NULL,
    description TEXT,
    version TEXT,
    
    -- Requirements structure
    requirements TEXT NOT NULL, -- JSON array of requirement objects
    
    -- Metadata
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert default frameworks
INSERT OR IGNORE INTO compliance_frameworks (id, name, display_name, description, version, requirements) VALUES
('fw_soc2', 'SOC2', 'SOC 2 Type II', 'Service Organization Control 2', '2017', '[
    {"id": "CC1.1", "category": "Control Environment", "title": "Control Environment Principles", "description": "COSO principle regarding commitment to integrity"},
    {"id": "CC2.1", "category": "Communication", "title": "Internal Communication", "description": "Information and communication policies"},
    {"id": "CC3.1", "category": "Risk Assessment", "title": "Risk Assessment Process", "description": "Objectives and risk identification"},
    {"id": "CC4.1", "category": "Monitoring", "title": "Monitoring Activities", "description": "Ongoing and separate evaluations"},
    {"id": "CC5.1", "category": "Control Activities", "title": "Control Selection", "description": "Selection of control activities"},
    {"id": "CC6.1", "category": "Logical Access", "title": "Access Controls", "description": "Logical and physical access controls"},
    {"id": "CC7.1", "category": "System Operations", "title": "System Changes", "description": "Change management process"},
    {"id": "CC8.1", "category": "Change Management", "title": "Infrastructure Changes", "description": "Infrastructure and software changes"},
    {"id": "CC9.1", "category": "Risk Mitigation", "title": "Risk Mitigation", "description": "Risk mitigation activities"}
]'),
('fw_gdpr', 'GDPR', 'GDPR', 'General Data Protection Regulation', '2018', '[
    {"id": "ART5", "category": "Principles", "title": "Processing Principles", "description": "Lawfulness, fairness, transparency"},
    {"id": "ART6", "category": "Lawful Basis", "title": "Lawful Processing", "description": "Legal basis for processing"},
    {"id": "ART7", "category": "Consent", "title": "Consent Conditions", "description": "Valid consent requirements"},
    {"id": "ART12", "category": "Transparency", "title": "Transparent Information", "description": "Information to data subjects"},
    {"id": "ART13", "category": "Data Collection", "title": "Information at Collection", "description": "Information when collecting data"},
    {"id": "ART15", "category": "Data Subject Rights", "title": "Right of Access", "description": "Data subject access requests"},
    {"id": "ART17", "category": "Data Subject Rights", "title": "Right to Erasure", "description": "Right to be forgotten"},
    {"id": "ART25", "category": "Privacy by Design", "title": "Data Protection by Design", "description": "Privacy by design and default"},
    {"id": "ART30", "category": "Documentation", "title": "Records of Processing", "description": "Processing activities records"},
    {"id": "ART32", "category": "Security", "title": "Security Measures", "description": "Technical and organizational measures"},
    {"id": "ART33", "category": "Breach", "title": "Breach Notification", "description": "Supervisory authority notification"},
    {"id": "ART35", "category": "Impact Assessment", "title": "DPIA", "description": "Data protection impact assessment"}
]'),
('fw_hipaa', 'HIPAA', 'HIPAA', 'Health Insurance Portability and Accountability Act', '1996', '[
    {"id": "164.308a1", "category": "Administrative", "title": "Security Management", "description": "Risk analysis and management"},
    {"id": "164.308a3", "category": "Administrative", "title": "Workforce Security", "description": "Authorization and supervision"},
    {"id": "164.308a4", "category": "Administrative", "title": "Information Access", "description": "Access management"},
    {"id": "164.308a5", "category": "Administrative", "title": "Security Awareness", "description": "Security training program"},
    {"id": "164.310a1", "category": "Physical", "title": "Facility Access", "description": "Facility access controls"},
    {"id": "164.310b", "category": "Physical", "title": "Workstation Use", "description": "Workstation use policies"},
    {"id": "164.310c", "category": "Physical", "title": "Workstation Security", "description": "Workstation security measures"},
    {"id": "164.312a1", "category": "Technical", "title": "Access Control", "description": "Unique user identification"},
    {"id": "164.312b", "category": "Technical", "title": "Audit Controls", "description": "Audit logging and reporting"},
    {"id": "164.312c1", "category": "Technical", "title": "Integrity", "description": "Data integrity mechanisms"},
    {"id": "164.312e1", "category": "Technical", "title": "Transmission Security", "description": "Encryption in transit"}
]'),
('fw_iso27001', 'ISO27001', 'ISO 27001:2022', 'Information Security Management System', '2022', '[
    {"id": "A5", "category": "Organizational", "title": "Organizational Controls", "description": "37 organizational controls"},
    {"id": "A6", "category": "People", "title": "People Controls", "description": "8 people controls"},
    {"id": "A7", "category": "Physical", "title": "Physical Controls", "description": "14 physical controls"},
    {"id": "A8", "category": "Technological", "title": "Technological Controls", "description": "34 technological controls"}
]');

-- Organization compliance status
CREATE TABLE IF NOT EXISTS compliance_status (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    framework_id TEXT NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
    requirement_id TEXT NOT NULL,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'compliant', 'non_compliant', 'not_applicable')),
    
    -- Evidence
    evidence_description TEXT,
    evidence_urls TEXT, -- JSON array of URLs
    evidence_files TEXT, -- JSON array of file references
    
    -- Notes
    notes TEXT,
    implementation_notes TEXT,
    
    -- Review
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TEXT,
    next_review_at TEXT,
    
    -- Risk
    risk_level TEXT DEFAULT 'medium' CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    UNIQUE(organization_id, framework_id, requirement_id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_status_org ON compliance_status(organization_id);
CREATE INDEX IF NOT EXISTS idx_compliance_status_framework ON compliance_status(framework_id);
CREATE INDEX IF NOT EXISTS idx_compliance_status_status ON compliance_status(status);

-- GDPR Data Processing Records (Article 30)
CREATE TABLE IF NOT EXISTS data_processing_records (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Processing activity
    name TEXT NOT NULL,
    description TEXT,
    purpose TEXT NOT NULL,
    legal_basis TEXT NOT NULL, -- 'consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests'
    
    -- Data categories
    data_categories TEXT NOT NULL, -- JSON array
    special_categories INTEGER DEFAULT 0, -- Whether includes special category data
    
    -- Data subjects
    data_subject_categories TEXT, -- JSON array: 'customers', 'employees', 'prospects'
    
    -- Recipients
    recipients TEXT, -- JSON array
    third_country_transfers TEXT, -- JSON array of countries
    transfer_safeguards TEXT, -- Legal mechanism for transfers
    
    -- Retention
    retention_period TEXT,
    retention_criteria TEXT,
    
    -- Security
    security_measures TEXT, -- JSON array
    
    -- Status
    is_active INTEGER DEFAULT 1,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_data_processing_org ON data_processing_records(organization_id);

-- Data Subject Access Requests (DSAR)
CREATE TABLE IF NOT EXISTS data_subject_requests (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Requester
    requester_email TEXT NOT NULL,
    requester_name TEXT,
    requester_verified INTEGER DEFAULT 0,
    verification_method TEXT,
    
    -- Request
    request_type TEXT NOT NULL CHECK(request_type IN ('access', 'rectification', 'erasure', 'restriction', 'portability', 'objection')),
    request_details TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'rejected', 'extended')),
    
    -- Timing
    received_at TEXT DEFAULT (datetime('now')),
    due_date TEXT, -- Usually 30 days from receipt
    extended_until TEXT,
    extension_reason TEXT,
    completed_at TEXT,
    
    -- Response
    response_details TEXT,
    response_files TEXT, -- JSON array
    
    -- Assignment
    assigned_to TEXT REFERENCES users(id),
    
    -- Rejection
    rejection_reason TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dsar_org ON data_subject_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_dsar_status ON data_subject_requests(status);
CREATE INDEX IF NOT EXISTS idx_dsar_due_date ON data_subject_requests(due_date);

-- Compliance audits
CREATE TABLE IF NOT EXISTS compliance_audits (
    id TEXT PRIMARY KEY,
    organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE, -- null for platform-level
    framework_id TEXT REFERENCES compliance_frameworks(id),
    
    -- Audit info
    name TEXT NOT NULL,
    description TEXT,
    audit_type TEXT DEFAULT 'internal' CHECK(audit_type IN ('internal', 'external', 'certification')),
    
    -- Scope
    scope TEXT, -- JSON array of requirement IDs
    
    -- Timeline
    planned_start TEXT,
    planned_end TEXT,
    actual_start TEXT,
    actual_end TEXT,
    
    -- Status
    status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    
    -- Results
    findings_count INTEGER DEFAULT 0,
    critical_findings INTEGER DEFAULT 0,
    high_findings INTEGER DEFAULT 0,
    medium_findings INTEGER DEFAULT 0,
    low_findings INTEGER DEFAULT 0,
    
    -- Report
    report_url TEXT,
    report_summary TEXT,
    
    -- Auditor
    auditor_name TEXT,
    auditor_organization TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    created_by TEXT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_compliance_audits_org ON compliance_audits(organization_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audits_status ON compliance_audits(status);

-- Audit findings
CREATE TABLE IF NOT EXISTS compliance_findings (
    id TEXT PRIMARY KEY,
    audit_id TEXT NOT NULL REFERENCES compliance_audits(id) ON DELETE CASCADE,
    
    -- Finding
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    requirement_id TEXT,
    
    -- Severity
    severity TEXT DEFAULT 'medium' CHECK(severity IN ('critical', 'high', 'medium', 'low', 'observation')),
    
    -- Status
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'accepted', 'disputed')),
    
    -- Remediation
    remediation_plan TEXT,
    remediation_due_date TEXT,
    remediation_owner TEXT REFERENCES users(id),
    resolved_at TEXT,
    resolution_notes TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_compliance_findings_audit ON compliance_findings(audit_id);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_status ON compliance_findings(status);
CREATE INDEX IF NOT EXISTS idx_compliance_findings_severity ON compliance_findings(severity);






