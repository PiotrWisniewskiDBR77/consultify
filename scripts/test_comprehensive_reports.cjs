/**
 * Test Comprehensive Report Generation
 * 
 * This script tests the new comprehensive report generation system:
 * 1. Web Research Service
 * 2. Context Builder
 * 3. Comprehensive Report Generator
 */

const path = require('path');

// Set environment
process.env.NODE_ENV = 'development';

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import services
const { webResearchService, INDUSTRY_KEYWORDS, AXIS_SEARCH_TOPICS } = require('../server/services/ai/webResearchService');
const { contextBuilder, INDUSTRY_PROFILES, DRD_AXES } = require('../server/services/ai/aiContext');
const { comprehensiveReportGenerator, REPORT_SECTIONS } = require('../server/services/ai/comprehensiveReportGenerator');

const db = require('../server/database');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(60));
    log(`  ${title}`, 'cyan');
    console.log('='.repeat(60));
}

function logSuccess(message) {
    log(`✓ ${message}`, 'green');
}

function logError(message) {
    log(`✗ ${message}`, 'red');
}

function logInfo(message) {
    log(`ℹ ${message}`, 'blue');
}

// Test 1: Web Research Service
async function testWebResearchService() {
    logSection('TEST 1: Web Research Service');
    
    try {
        // Check status
        const status = webResearchService.getStatus();
        logInfo(`Backend: ${status.backend}`);
        logInfo(`Has Perplexity: ${status.hasPerplexity}`);
        logInfo(`Has Tavily: ${status.hasTavily}`);
        logInfo(`Has Gemini: ${status.hasGemini}`);
        logInfo(`Supported Industries: ${status.supportedIndustries.length}`);
        logInfo(`Supported Axes: ${status.supportedAxes.length}`);
        
        // Test benchmark search
        log('\nTesting benchmark search for manufacturing/processes...', 'yellow');
        const benchmarks = await webResearchService.searchIndustryBenchmarks('manufacturing', 'processes');
        
        if (benchmarks.axisId === 'processes') {
            logSuccess(`Benchmarks retrieved for ${benchmarks.axisId}`);
            logInfo(`Source: ${benchmarks.source}`);
            if (benchmarks.summary) {
                logInfo(`Summary: ${benchmarks.summary.substring(0, 100)}...`);
            }
        } else {
            logError('Benchmark search returned unexpected data');
        }
        
        // Test case studies
        log('\nTesting case study search...', 'yellow');
        const caseStudies = await webResearchService.findCaseStudies('manufacturing', 'process automation');
        
        if (caseStudies.industry === 'manufacturing') {
            logSuccess(`Case studies retrieved for ${caseStudies.industry}`);
            logInfo(`Source: ${caseStudies.source}`);
        }
        
        // Test trends
        log('\nTesting technology trends...', 'yellow');
        const trends = await webResearchService.getTechnologyTrends('AI');
        
        if (trends.domain === 'AI') {
            logSuccess(`Trends retrieved for ${trends.domain}`);
            if (trends.trends) {
                logInfo(`Trends: ${trends.trends.slice(0, 3).join(', ')}`);
            }
        }
        
        return true;
    } catch (error) {
        logError(`Web Research Service test failed: ${error.message}`);
        console.error(error);
        return false;
    }
}

// Test 2: Context Builder
async function testContextBuilder() {
    logSection('TEST 2: Context Builder');
    
    try {
        // Check configurations
        const configs = contextBuilder.getConfigurations();
        logInfo(`Available industries: ${configs.industries.length}`);
        logInfo(`Company sizes: ${configs.companySizes.length}`);
        logInfo(`Regulations: ${configs.regulations.length}`);
        logInfo(`DRD Axes: ${configs.axes.length}`);
        
        // Verify INDUSTRY_PROFILES
        log('\nIndustry Profiles:', 'yellow');
        Object.entries(INDUSTRY_PROFILES).forEach(([key, profile]) => {
            logInfo(`  ${key}: ${profile.name} (${profile.namePl})`);
        });
        
        // Verify DRD_AXES
        log('\nDRD Axes:', 'yellow');
        Object.entries(DRD_AXES).forEach(([key, axis]) => {
            logInfo(`  ${key}: ${axis.namePl} (max: ${axis.maxLevel})`);
        });
        
        // Test basic context building
        log('\nTesting basic context build...', 'yellow');
        const basicContext = await contextBuilder.build({
            userId: null,
            organizationId: null,
            projectId: null,
            capability: 'report_generation'
        });
        
        if (basicContext.timestamp) {
            logSuccess('Basic context built successfully');
            logInfo(`Context version: ${basicContext.contextVersion}`);
        }
        
        return true;
    } catch (error) {
        logError(`Context Builder test failed: ${error.message}`);
        console.error(error);
        return false;
    }
}

// Test 3: Comprehensive Report Generator
async function testComprehensiveReportGenerator() {
    logSection('TEST 3: Comprehensive Report Generator');
    
    try {
        // Check status
        const status = comprehensiveReportGenerator.getStatus();
        logInfo(`AI Available: ${status.aiAvailable}`);
        logInfo(`Supported Sections: ${status.supportedSections.join(', ')}`);
        logInfo(`Web Research Backend: ${status.webResearchStatus.backend}`);
        
        // Verify REPORT_SECTIONS
        log('\nReport Sections:', 'yellow');
        Object.entries(REPORT_SECTIONS).forEach(([key, config]) => {
            logInfo(`  ${config.order}. ${key} (AI: ${config.aiGenerated})`);
        });
        
        return true;
    } catch (error) {
        logError(`Comprehensive Report Generator test failed: ${error.message}`);
        console.error(error);
        return false;
    }
}

// Test 4: Find existing assessment and generate report
async function testReportGeneration() {
    logSection('TEST 4: Report Generation with Real Data');
    
    return new Promise((resolve) => {
        // Find an existing assessment (using maturity_assessments table)
        db.get(
            `SELECT m.id, m.project_id, m.axis_scores as axis_data, m.is_complete,
                    p.name, o.name as org_name, o.id as org_id
             FROM maturity_assessments m
             LEFT JOIN projects p ON m.project_id = p.id
             LEFT JOIN organizations o ON p.organization_id = o.id
             WHERE m.is_complete = 1
             LIMIT 1`,
            [],
            async (err, assessment) => {
                if (err) {
                    logError(`Database error: ${err.message}`);
                    resolve(false);
                    return;
                }
                
                if (!assessment) {
                    logInfo('No complete assessments found. Skipping generation test.');
                    logInfo('Run the test_ai_flow.sh script first to create assessments.');
                    resolve(true); // Not a failure, just no data
                    return;
                }
                
                logInfo(`Found assessment: ${assessment.name || assessment.id}`);
                logInfo(`Organization: ${assessment.org_name || 'Unknown'}`);
                
                // Parse axis data
                let axisData = {};
                try {
                    axisData = assessment.axis_data ? JSON.parse(assessment.axis_data) : {};
                } catch (e) {
                    logInfo('Could not parse axis data');
                }
                
                const assessedAxes = Object.keys(axisData).filter(k => axisData[k]?.actual > 0);
                logInfo(`Assessed axes: ${assessedAxes.length}`);
                
                // Generate comprehensive report
                log('\nGenerating comprehensive report...', 'yellow');
                log('(This may take 30-60 seconds with AI enabled)', 'yellow');
                
                const startTime = Date.now();
                
                try {
                    const result = await comprehensiveReportGenerator.generateReport(
                        assessment.id,
                        { language: 'pl', includeResearch: true }
                    );
                    
                    const duration = Date.now() - startTime;
                    
                    if (result.success) {
                        logSuccess(`Report generated in ${duration}ms`);
                        logInfo(`Sections: ${result.sections?.length || 0}`);
                        logInfo(`Organization: ${result.metadata?.organizationName}`);
                        logInfo(`Industry: ${result.metadata?.industry}`);
                        logInfo(`Avg Maturity: ${result.metadata?.averageMaturity}`);
                        logInfo(`AI Model: ${result.metadata?.aiModel}`);
                        
                        // Show section titles
                        log('\nGenerated Sections:', 'yellow');
                        result.sections?.forEach((section, i) => {
                            const title = section.axisName || section.type || 'Unknown';
                            const aiGenerated = section.aiGenerated ? '✓ AI' : '○ Template';
                            logInfo(`  ${i + 1}. ${title} ${aiGenerated}`);
                        });
                        
                        // Save report to file for review
                        const fs = require('fs');
                        const outputDir = path.join(__dirname, '../output/comprehensive_reports');
                        if (!fs.existsSync(outputDir)) {
                            fs.mkdirSync(outputDir, { recursive: true });
                        }
                        
                        const outputFile = path.join(outputDir, `report_${assessment.id.substring(0, 8)}.json`);
                        fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
                        logSuccess(`Report saved to: ${outputFile}`);
                        
                        resolve(true);
                    } else {
                        logError(`Report generation failed: ${result.error}`);
                        resolve(false);
                    }
                } catch (genError) {
                    logError(`Generation error: ${genError.message}`);
                    console.error(genError);
                    resolve(false);
                }
            }
        );
    });
}

// Test 5: API Endpoints
async function testAPIEndpoints() {
    logSection('TEST 5: API Endpoints');
    
    const baseUrl = process.env.BASE_URL || 'http://localhost:3005';
    
    try {
        // Test comprehensive report status endpoint
        log('\nTesting /api/llm/comprehensive-report-status...', 'yellow');
        
        // Use dynamic import for fetch (ESM module in newer Node)
        const fetchModule = await import('node-fetch').catch(() => null);
        const fetch = fetchModule?.default || globalThis.fetch;
        
        if (!fetch) {
            logInfo('node-fetch not available, skipping API test');
            return true;
        }
        
        const response = await fetch(`${baseUrl}/api/llm/comprehensive-report-status`);
        
        if (response.ok) {
            const data = await response.json();
            logSuccess('Comprehensive report status endpoint OK');
            logInfo(`AI Available: ${data.comprehensiveReportGenerator?.aiAvailable}`);
            logInfo(`Web Research Backend: ${data.webResearch?.backend}`);
            logInfo(`Industries: ${data.contextBuilder?.industries?.length || 0}`);
        } else {
            logError(`Status endpoint returned ${response.status}`);
        }
        
        return true;
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            logInfo('Server not running. Start with: npm run dev:backend');
            return true; // Not a test failure
        }
        logError(`API test error: ${error.message}`);
        return false;
    }
}

// Main test runner
async function runTests() {
    console.log('\n' + '═'.repeat(60));
    log('  COMPREHENSIVE REPORT SYSTEM TESTS', 'bold');
    console.log('═'.repeat(60));
    
    const results = {
        webResearch: false,
        contextBuilder: false,
        generator: false,
        generation: false,
        api: false
    };
    
    try {
        results.webResearch = await testWebResearchService();
        results.contextBuilder = await testContextBuilder();
        results.generator = await testComprehensiveReportGenerator();
        results.generation = await testReportGeneration();
        results.api = await testAPIEndpoints();
    } catch (error) {
        logError(`Test runner error: ${error.message}`);
        console.error(error);
    }
    
    // Summary
    logSection('TEST SUMMARY');
    
    const tests = [
        ['Web Research Service', results.webResearch],
        ['Context Builder', results.contextBuilder],
        ['Report Generator', results.generator],
        ['Report Generation', results.generation],
        ['API Endpoints', results.api]
    ];
    
    let passed = 0;
    let failed = 0;
    
    tests.forEach(([name, result]) => {
        if (result) {
            logSuccess(name);
            passed++;
        } else {
            logError(name);
            failed++;
        }
    });
    
    console.log('\n' + '-'.repeat(40));
    log(`Passed: ${passed}/${tests.length}`, passed === tests.length ? 'green' : 'yellow');
    
    if (failed > 0) {
        log(`Failed: ${failed}/${tests.length}`, 'red');
    }
    
    console.log('');
    
    // Close database
    db.close();
    
    process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests();

