#!/usr/bin/env node
/**
 * Migration Coverage Test Script
 * 
 * Measures migration coverage and generates HTML report
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const serverDir = path.join(projectRoot, 'server');
const srcDir = path.join(serverDir, 'src');
const reportsDir = path.join(projectRoot, 'tests', 'migration', 'reports');

async function generateCoverageReport() {
    console.log('📊 Generating migration coverage report...\n');

    // Load all reports
    const structuralReport = JSON.parse(
        fs.readFileSync(path.join(reportsDir, 'structural-report.json'), 'utf-8')
    );
    const importsReport = JSON.parse(
        fs.readFileSync(path.join(reportsDir, 'imports-report.json'), 'utf-8')
    );
    const duplicatesReport = JSON.parse(
        fs.readFileSync(path.join(reportsDir, 'duplicates-report.json'), 'utf-8')
    );

    const coverage = {
        timestamp: new Date().toISOString(),
        structural: {
            coverage: structuralReport.stats.coverage,
            migratedFiles: structuralReport.stats.migratedFiles,
            missingMigrations: structuralReport.stats.missingMigrations
        },
        imports: {
            totalIssues: importsReport.total_issues,
            filesWithIssues: importsReport.issues.length
        },
        duplicates: {
            total: duplicatesReport.summary.total,
            withCommonFunctions: duplicatesReport.summary.withCommonFunctions
        },
        overall: {
            status: structuralReport.stats.coverage >= 80 && importsReport.total_issues < 100 ? 'good' : 'needs_attention',
            score: calculateScore(structuralReport, importsReport, duplicatesReport)
        }
    };

    // Generate HTML report
    const html = generateHTMLReport(coverage, structuralReport, importsReport, duplicatesReport);
    const htmlPath = path.join(reportsDir, 'migration-report.html');
    fs.writeFileSync(htmlPath, html);

    // Save JSON
    const jsonPath = path.join(reportsDir, 'migration-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(coverage, null, 2));

    console.log('✅ Coverage report generated:');
    console.log(`   HTML: ${htmlPath}`);
    console.log(`   JSON: ${jsonPath}`);
    console.log(`\n📊 Overall Score: ${coverage.overall.score}/100`);
    console.log(`   Status: ${coverage.overall.status}`);
}

function calculateScore(structural, imports, duplicates) {
    let score = 100;
    
    // Structural coverage (40 points)
    score -= (100 - structural.stats.coverage) * 0.4;
    
    // Import issues (30 points)
    score -= Math.min(imports.total_issues * 0.3, 30);
    
    // Duplicates (30 points)
    score -= Math.min(duplicates.summary.total * 0.5, 30);
    
    return Math.max(0, Math.round(score));
}

function generateHTMLReport(coverage, structural, imports, duplicates) {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Migration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        h1 { color: #333; }
        .score { font-size: 48px; font-weight: bold; color: ${coverage.overall.score >= 80 ? '#4CAF50' : '#FF9800'}; }
        .section { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 4px; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; }
        .metric-label { font-weight: bold; color: #666; }
        .metric-value { font-size: 24px; color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #4CAF50; color: white; }
        .good { color: #4CAF50; }
        .warning { color: #FF9800; }
        .error { color: #f44336; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Migration Test Report</h1>
        <p>Generated: ${coverage.timestamp}</p>
        
        <div class="section">
            <h2>Overall Score</h2>
            <div class="score">${coverage.overall.score}/100</div>
            <p>Status: <span class="${coverage.overall.status === 'good' ? 'good' : 'warning'}">${coverage.overall.status}</span></p>
        </div>

        <div class="section">
            <h2>Structural Coverage</h2>
            <div class="metric">
                <div class="metric-label">Coverage</div>
                <div class="metric-value">${coverage.structural.coverage.toFixed(2)}%</div>
            </div>
            <div class="metric">
                <div class="metric-label">Migrated Files</div>
                <div class="metric-value">${coverage.structural.migratedFiles}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Missing Migrations</div>
                <div class="metric-value">${coverage.structural.missingMigrations}</div>
            </div>
        </div>

        <div class="section">
            <h2>Import/Export Issues</h2>
            <div class="metric">
                <div class="metric-label">Total Issues</div>
                <div class="metric-value">${coverage.imports.totalIssues}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Files with Issues</div>
                <div class="metric-value">${coverage.imports.filesWithIssues}</div>
            </div>
        </div>

        <div class="section">
            <h2>Duplicates</h2>
            <div class="metric">
                <div class="metric-label">Potential Duplicates</div>
                <div class="metric-value">${coverage.duplicates.total}</div>
            </div>
            <div class="metric">
                <div class="metric-label">With Common Functions</div>
                <div class="metric-value">${coverage.duplicates.withCommonFunctions}</div>
            </div>
        </div>

        <div class="section">
            <h2>Recommendations</h2>
            <ul>
                ${coverage.structural.missingMigrations > 0 ? '<li>Complete missing migrations</li>' : ''}
                ${coverage.imports.totalIssues > 50 ? '<li>Fix import/export issues</li>' : ''}
                ${coverage.duplicates.total > 0 ? '<li>Review and remove duplicate files</li>' : ''}
                ${coverage.overall.score >= 80 ? '<li class="good">Migration looks good! Consider removing old .js files.</li>' : ''}
            </ul>
        </div>
    </div>
</body>
</html>`;
}

generateCoverageReport()
    .then(() => {
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
    });

