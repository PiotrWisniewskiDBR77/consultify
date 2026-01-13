-- =============================================================================
-- Migration: 215_partner_portal.sql
-- Description: Partner Portal module - tables for partner management, 
--              certifications, commissions, and client organizations
-- =============================================================================

-- Partner Organizations Table
CREATE TABLE IF NOT EXISTS partner_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    tax_id VARCHAR(100),
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    website VARCHAR(255),
    logo_url VARCHAR(500),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    
    -- Partner tier and status
    tier VARCHAR(50) DEFAULT 'registered' CHECK (tier IN ('registered', 'certified', 'premier', 'elite')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'inactive')),
    
    -- Partnership details
    partner_since TIMESTAMP WITH TIME ZONE,
    contract_start_date DATE,
    contract_end_date DATE,
    
    -- Discount and commission rates
    license_discount_percent DECIMAL(5,2) DEFAULT 0.00,
    commission_rate_percent DECIMAL(5,2) DEFAULT 10.00,
    
    -- Performance metrics
    performance_score INTEGER DEFAULT 0 CHECK (performance_score >= 0 AND performance_score <= 100),
    
    -- Directory listing
    public_listing_enabled BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- Partner Users (relationship between users and partner organizations)
CREATE TABLE IF NOT EXISTS partner_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(partner_org_id, user_id)
);

-- Partner Specializations (frameworks they specialize in)
CREATE TABLE IF NOT EXISTS partner_specializations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    framework VARCHAR(50) NOT NULL CHECK (framework IN ('DRD', 'SIRI', 'ADMA', 'CMMI', 'Lean4.0', 'ISO21500', 'PMBOK', 'PRINCE2')),
    certified BOOLEAN DEFAULT false,
    certified_at TIMESTAMP WITH TIME ZONE,
    certification_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(partner_org_id, framework)
);

-- Partner Regions (regions where they operate)
CREATE TABLE IF NOT EXISTS partner_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    region VARCHAR(50) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(partner_org_id, region)
);

-- Partner Certifications (learning path progress)
CREATE TABLE IF NOT EXISTS partner_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    certification_name VARCHAR(255) NOT NULL,
    certification_type VARCHAR(50) CHECK (certification_type IN ('foundation', 'pmo_standards', 'ai_modules', 'assessment_specialist', 'advanced')),
    status VARCHAR(50) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'expired')),
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    certificate_id VARCHAR(100),
    certificate_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Partner Learning Modules (courses in the learning path)
CREATE TABLE IF NOT EXISTS partner_learning_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    certification_type VARCHAR(50) NOT NULL,
    module_order INTEGER DEFAULT 0,
    duration_minutes INTEGER DEFAULT 60,
    content_type VARCHAR(50) DEFAULT 'video' CHECK (content_type IN ('video', 'document', 'quiz', 'interactive')),
    content_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Partner Learning Progress (per-module progress)
CREATE TABLE IF NOT EXISTS partner_learning_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certification_id UUID NOT NULL REFERENCES partner_certifications(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES partner_learning_modules(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    progress_percent INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(certification_id, module_id)
);

-- Partner Client Organizations (organizations managed by the partner)
CREATE TABLE IF NOT EXISTS partner_client_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL, -- References organizations table
    relationship_type VARCHAR(50) DEFAULT 'managed' CHECK (relationship_type IN ('managed', 'referred', 'supported')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'onboarding', 'inactive', 'churned')),
    onboarded_at TIMESTAMP WITH TIME ZONE,
    contract_value_annual DECIMAL(12,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(partner_org_id, organization_id)
);

-- Partner Projects (transformation projects managed by partner)
CREATE TABLE IF NOT EXISTS partner_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    client_org_id UUID REFERENCES partner_client_organizations(id) ON DELETE SET NULL,
    project_id UUID, -- References projects table
    name VARCHAR(255) NOT NULL,
    description TEXT,
    framework VARCHAR(50),
    status VARCHAR(50) DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
    progress_percent INTEGER DEFAULT 0,
    start_date DATE,
    target_end_date DATE,
    actual_end_date DATE,
    project_value DECIMAL(12,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Partner Licenses (license allocations for clients)
CREATE TABLE IF NOT EXISTS partner_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    client_org_id UUID REFERENCES partner_client_organizations(id) ON DELETE SET NULL,
    license_type VARCHAR(50) NOT NULL CHECK (license_type IN ('standard', 'professional', 'enterprise')),
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0.00,
    final_price DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'pending', 'expired', 'cancelled')),
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    auto_renew BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Partner Commissions (commission earnings tracking)
CREATE TABLE IF NOT EXISTS partner_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    client_org_id UUID REFERENCES partner_client_organizations(id) ON DELETE SET NULL,
    license_id UUID REFERENCES partner_licenses(id) ON DELETE SET NULL,
    commission_type VARCHAR(50) NOT NULL CHECK (commission_type IN ('referral', 'renewal', 'upsell', 'new_license', 'project')),
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
    period_start DATE,
    period_end DATE,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID,
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_reference VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Partner Invoices (invoices issued to partners)
CREATE TABLE IF NOT EXISTS partner_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    invoice_type VARCHAR(50) CHECK (invoice_type IN ('license', 'commission_payout', 'service', 'credit_note')),
    amount DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2) DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),
    notes TEXT,
    pdf_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Partner Resources (marketing materials, templates, etc.)
CREATE TABLE IF NOT EXISTS partner_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('documentation', 'marketing', 'case_study', 'template', 'training')),
    file_type VARCHAR(20),
    file_size_bytes BIGINT,
    file_url VARCHAR(500),
    thumbnail_url VARCHAR(500),
    is_featured BOOLEAN DEFAULT false,
    min_partner_tier VARCHAR(50) DEFAULT 'registered',
    download_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Partner Resource Downloads (tracking)
CREATE TABLE IF NOT EXISTS partner_resource_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES partner_resources(id) ON DELETE CASCADE,
    partner_org_id UUID NOT NULL REFERENCES partner_organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Partner Activity Log (audit trail)
CREATE TABLE IF NOT EXISTS partner_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_org_id UUID REFERENCES partner_organizations(id) ON DELETE SET NULL,
    user_id UUID,
    activity_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_partner_users_partner_org ON partner_users(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_partner_users_user ON partner_users(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_specializations_partner ON partner_specializations(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_partner_regions_partner ON partner_regions(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_partner_certifications_partner ON partner_certifications(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_partner_certifications_user ON partner_certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_client_orgs_partner ON partner_client_organizations(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_partner_projects_partner ON partner_projects(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_partner_licenses_partner ON partner_licenses(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner ON partner_commissions(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status);
CREATE INDEX IF NOT EXISTS idx_partner_invoices_partner ON partner_invoices(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_partner_invoices_status ON partner_invoices(status);
CREATE INDEX IF NOT EXISTS idx_partner_activity_log_partner ON partner_activity_log(partner_org_id);
CREATE INDEX IF NOT EXISTS idx_partner_activity_log_created ON partner_activity_log(created_at DESC);

-- Insert default learning modules
INSERT INTO partner_learning_modules (name, description, certification_type, module_order, duration_minutes, content_type) VALUES
    ('Platform Overview', 'Introduction to Consultinity platform features', 'foundation', 1, 30, 'video'),
    ('Navigation & UI', 'Learn to navigate the platform efficiently', 'foundation', 2, 20, 'interactive'),
    ('Project Setup', 'Setting up your first project', 'foundation', 3, 25, 'video'),
    ('Assessment Basics', 'Understanding assessment frameworks', 'foundation', 4, 35, 'video'),
    ('Partner Tools', 'Partner-specific tools and features', 'foundation', 5, 30, 'interactive'),
    ('ISO 21500 Fundamentals', 'Project management governance standard', 'pmo_standards', 1, 45, 'video'),
    ('PMBOK 7 Overview', 'PMI framework principles and domains', 'pmo_standards', 2, 50, 'video'),
    ('PRINCE2 Essentials', 'Process-based project management', 'pmo_standards', 3, 45, 'video'),
    ('PMO Integration', 'Integrating standards in Consultinity', 'pmo_standards', 4, 40, 'interactive'),
    ('Compliance Mapping', 'Mapping standards to assessments', 'pmo_standards', 5, 35, 'video'),
    ('Standards Quiz', 'Knowledge verification', 'pmo_standards', 6, 30, 'quiz'),
    ('PMO Best Practices', 'Advanced PMO techniques', 'pmo_standards', 7, 40, 'video'),
    ('Governance Framework', 'Building governance frameworks', 'pmo_standards', 8, 45, 'document'),
    ('AI Chat Assistant', 'Using AI-powered chat features', 'ai_modules', 1, 30, 'video'),
    ('AI Recommendations', 'Understanding AI suggestions', 'ai_modules', 2, 35, 'interactive'),
    ('AI Analytics', 'AI-powered analytics and insights', 'ai_modules', 3, 40, 'video'),
    ('AI Customization', 'Customizing AI behavior', 'ai_modules', 4, 30, 'interactive'),
    ('AI Ethics & Privacy', 'Responsible AI usage', 'ai_modules', 5, 25, 'document'),
    ('AI Integration', 'Integrating AI in client workflows', 'ai_modules', 6, 35, 'video'),
    ('DRD Framework Deep Dive', 'Digital Readiness Diagnostics', 'assessment_specialist', 1, 60, 'video'),
    ('SIRI Methodology', 'Smart Industry Readiness Index', 'assessment_specialist', 2, 55, 'video'),
    ('ADMA Framework', 'Advanced Manufacturing assessment', 'assessment_specialist', 3, 50, 'video'),
    ('CMMI Integration', 'Capability Maturity Model', 'assessment_specialist', 4, 55, 'video'),
    ('Lean 4.0 Principles', 'Lean manufacturing in Industry 4.0', 'assessment_specialist', 5, 45, 'video'),
    ('Multi-Framework Assessments', 'Combining multiple frameworks', 'assessment_specialist', 6, 50, 'interactive'),
    ('Report Generation', 'Creating professional assessment reports', 'assessment_specialist', 7, 40, 'video'),
    ('Client Presentation Skills', 'Presenting findings to clients', 'assessment_specialist', 8, 35, 'video'),
    ('Roadmap Development', 'Creating transformation roadmaps', 'assessment_specialist', 9, 45, 'interactive'),
    ('Case Study Analysis', 'Real-world case studies', 'assessment_specialist', 10, 50, 'document'),
    ('Assessment Workshop', 'Hands-on assessment practice', 'assessment_specialist', 11, 60, 'interactive'),
    ('Final Assessment Exam', 'Certification examination', 'assessment_specialist', 12, 90, 'quiz')
ON CONFLICT DO NOTHING;

-- Insert default partner resources
INSERT INTO partner_resources (title, description, category, file_type, is_featured, min_partner_tier) VALUES
    ('Partner Onboarding Guide', 'Complete guide for new partners', 'documentation', 'PDF', true, 'registered'),
    ('Consultinity Platform Overview', 'Comprehensive platform documentation', 'documentation', 'PDF', true, 'registered'),
    ('API Documentation', 'Technical API reference', 'documentation', 'Web', false, 'certified'),
    ('Integration Guide', 'System integration guidelines', 'documentation', 'PDF', false, 'registered'),
    ('Partner Logo Kit', 'Official partner logos and branding', 'marketing', 'ZIP', true, 'registered'),
    ('Sales Presentation Template', 'Customizable sales deck', 'marketing', 'PPTX', true, 'registered'),
    ('Product One-Pager', 'Quick product overview', 'marketing', 'PDF', true, 'registered'),
    ('Email Templates', 'Pre-designed email templates', 'marketing', 'ZIP', false, 'registered'),
    ('Nordic Manufacturing Case Study', 'Digital transformation success story', 'case_study', 'PDF', true, 'certified'),
    ('Baltic Energy Case Study', 'Industry 4.0 implementation', 'case_study', 'PDF', false, 'certified'),
    ('TechVentures Case Study', 'Lean manufacturing case', 'case_study', 'PDF', false, 'certified'),
    ('PMO Setup Checklist', 'Step-by-step PMO setup guide', 'template', 'XLSX', true, 'registered'),
    ('Assessment Report Template', 'Professional report template', 'template', 'DOCX', true, 'certified'),
    ('Roadmap Template', 'Transformation roadmap template', 'template', 'XLSX', false, 'registered'),
    ('Governance Framework Template', 'PMO governance documentation', 'template', 'PDF', false, 'certified')
ON CONFLICT DO NOTHING;
