/**
 * K6 Load Testing Suite for AI Features
 * 
 * Tests AI endpoints under load to verify:
 * - Response times stay within SLOs (P95 < 2s, P99 < 5s)
 * - System handles 50 concurrent requests
 * - Circuit breakers function correctly
 * - Memory management under stress
 * 
 * Run with: k6 run tests/performance/k6-ai-load-test.js
 * 
 * Part of Enterprise AI Readiness - Phase 5: Load Testing
 * 
 * @version 1.0.0
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5001';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';

// Custom metrics
const aiResponseTime = new Trend('ai_response_time_ms');
const aiSuccessRate = new Rate('ai_success_rate');
const aiErrorCount = new Counter('ai_error_count');
const aiCircuitBreakerTriggers = new Counter('ai_circuit_breaker_triggers');
const aiTokenUsage = new Trend('ai_token_usage');
const activeConnections = new Gauge('active_connections');

// Test data
const testPrompts = new SharedArray('prompts', function() {
    return [
        'What are the key metrics for this project?',
        'Generate a risk analysis for the current phase',
        'Summarize the project status in 3 bullet points',
        'What tasks are overdue and need attention?',
        'Recommend next steps for the initiative',
        'Analyze the budget variance for Q4',
        'Compare Agile vs Waterfall for this project type',
        'What are the top 5 risks I should monitor?',
        'Create a brief stakeholder update',
        'Explain the current phase gate requirements'
    ];
});

// ============================================================================
// Test Configuration Options
// ============================================================================

export const options = {
    scenarios: {
        // Scenario 1: Ramp-up to 50 concurrent users
        load_test: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 10 },   // Ramp up to 10 users
                { duration: '1m', target: 25 },    // Ramp up to 25 users
                { duration: '2m', target: 50 },    // Ramp up to 50 users
                { duration: '3m', target: 50 },    // Stay at 50 users
                { duration: '1m', target: 25 },    // Ramp down to 25
                { duration: '30s', target: 0 },    // Ramp down to 0
            ],
            gracefulRampDown: '30s',
        },
        
        // Scenario 2: Spike test
        spike_test: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '10s', target: 10 },   // Baseline
                { duration: '10s', target: 100 },  // Spike to 100 users
                { duration: '30s', target: 100 },  // Hold spike
                { duration: '10s', target: 10 },   // Return to baseline
            ],
            startTime: '8m', // Start after load test
            gracefulRampDown: '10s',
        },
        
        // Scenario 3: Stress test
        stress_test: {
            executor: 'constant-arrival-rate',
            rate: 100, // 100 requests per second
            timeUnit: '1s',
            duration: '2m',
            preAllocatedVUs: 50,
            maxVUs: 100,
            startTime: '12m', // Start after spike test
        }
    },
    
    thresholds: {
        // Response time SLOs
        'ai_response_time_ms': ['p(95)<2000', 'p(99)<5000'],
        'http_req_duration': ['p(95)<3000', 'p(99)<6000'],
        
        // Success rate SLOs
        'ai_success_rate': ['rate>0.95'],
        'http_req_failed': ['rate<0.05'],
        
        // Error thresholds
        'ai_error_count': ['count<100'],
        'ai_circuit_breaker_triggers': ['count<10'],
    },
    
    // Output configuration
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ============================================================================
// Helper Functions
// ============================================================================

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
    };
}

function getRandomPrompt() {
    return testPrompts[Math.floor(Math.random() * testPrompts.length)];
}

function checkResponse(res, name) {
    const success = check(res, {
        [`${name}: status is 200`]: (r) => r.status === 200,
        [`${name}: response has data`]: (r) => r.body && r.body.length > 0,
        [`${name}: no error in response`]: (r) => {
            try {
                const body = JSON.parse(r.body);
                return !body.error;
            } catch {
                return true;
            }
        },
    });
    
    aiSuccessRate.add(success ? 1 : 0);
    
    if (!success) {
        aiErrorCount.add(1);
        
        // Check for circuit breaker
        if (res.body && res.body.includes('circuit')) {
            aiCircuitBreakerTriggers.add(1);
        }
    }
    
    return success;
}

// ============================================================================
// Test Scenarios
// ============================================================================

export default function() {
    // Update active connections gauge
    activeConnections.add(1);
    
    group('AI Chat Endpoint', function() {
        const startTime = Date.now();
        
        const payload = JSON.stringify({
            message: getRandomPrompt(),
            history: [],
            context: {
                screenContext: 'project_dashboard',
                projectId: 'test-project-id'
            }
        });
        
        const res = http.post(`${BASE_URL}/api/ai/chat`, payload, {
            headers: getHeaders(),
            timeout: '30s',
        });
        
        const duration = Date.now() - startTime;
        aiResponseTime.add(duration);
        
        checkResponse(res, 'AI Chat');
        
        // Extract token usage if available
        try {
            const body = JSON.parse(res.body);
            if (body.tokenCount) {
                aiTokenUsage.add(body.tokenCount);
            }
        } catch {}
    });
    
    sleep(1); // Think time between requests
    
    group('AI Memory Metrics', function() {
        const res = http.get(`${BASE_URL}/api/ai/memory/metrics?period=7`, {
            headers: getHeaders(),
            timeout: '10s',
        });
        
        checkResponse(res, 'Memory Metrics');
    });
    
    sleep(0.5);
    
    group('AI Health Check', function() {
        const res = http.get(`${BASE_URL}/api/ai/health`, {
            headers: getHeaders(),
            timeout: '5s',
        });
        
        check(res, {
            'Health check status is 200': (r) => r.status === 200,
            'Health check returns healthy': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body.status === 'healthy' || body.healthy === true;
                } catch {
                    return false;
                }
            },
        });
    });
    
    sleep(0.5);
    
    group('Pending Actions', function() {
        const res = http.get(`${BASE_URL}/api/ai/actions/pending`, {
            headers: getHeaders(),
            timeout: '10s',
        });
        
        checkResponse(res, 'Pending Actions');
    });
    
    activeConnections.add(-1);
    
    sleep(Math.random() * 2); // Random think time 0-2 seconds
}

// ============================================================================
// Streaming Endpoint Test
// ============================================================================

export function streamingTest() {
    group('AI Streaming Chat', function() {
        const startTime = Date.now();
        
        const payload = JSON.stringify({
            message: getRandomPrompt(),
            history: [],
            context: {
                screenContext: 'project_dashboard'
            }
        });
        
        // Note: k6 doesn't natively support SSE well, so we test the endpoint exists
        const res = http.post(`${BASE_URL}/api/ai/chat/stream`, payload, {
            headers: {
                ...getHeaders(),
                'Accept': 'text/event-stream',
            },
            timeout: '60s',
        });
        
        const duration = Date.now() - startTime;
        aiResponseTime.add(duration);
        
        check(res, {
            'Streaming status is 200': (r) => r.status === 200,
            'Streaming returns event stream': (r) => 
                r.headers['Content-Type'] && 
                r.headers['Content-Type'].includes('text/event-stream'),
        });
    });
}

// ============================================================================
// Setup and Teardown
// ============================================================================

export function setup() {
    console.log('🚀 Starting AI Load Test Suite');
    console.log(`Base URL: ${BASE_URL}`);
    
    // Verify server is up
    const healthRes = http.get(`${BASE_URL}/api/ai/health`, {
        headers: getHeaders(),
        timeout: '5s',
    });
    
    if (healthRes.status !== 200) {
        console.error('❌ Server health check failed. Ensure server is running.');
        throw new Error('Server not available');
    }
    
    console.log('✅ Server is healthy, starting tests...');
    
    return {
        startTime: new Date().toISOString(),
    };
}

export function teardown(data) {
    console.log('🏁 Load Test Complete');
    console.log(`Started: ${data.startTime}`);
    console.log(`Ended: ${new Date().toISOString()}`);
}

// ============================================================================
// Summary Handler
// ============================================================================

export function handleSummary(data) {
    const summary = {
        timestamp: new Date().toISOString(),
        metrics: {
            aiResponseTime: {
                avg: data.metrics.ai_response_time_ms?.values?.avg || 0,
                p95: data.metrics.ai_response_time_ms?.values['p(95)'] || 0,
                p99: data.metrics.ai_response_time_ms?.values['p(99)'] || 0,
            },
            successRate: data.metrics.ai_success_rate?.values?.rate || 0,
            errorCount: data.metrics.ai_error_count?.values?.count || 0,
            circuitBreakerTriggers: data.metrics.ai_circuit_breaker_triggers?.values?.count || 0,
            httpDuration: {
                avg: data.metrics.http_req_duration?.values?.avg || 0,
                p95: data.metrics.http_req_duration?.values['p(95)'] || 0,
                p99: data.metrics.http_req_duration?.values['p(99)'] || 0,
            },
            totalRequests: data.metrics.http_reqs?.values?.count || 0,
        },
        thresholds: data.thresholds,
        passedAllThresholds: Object.values(data.thresholds || {}).every(t => t.ok),
    };
    
    // Generate report
    const reportLines = [
        '═══════════════════════════════════════════════════════════════',
        '                 AI LOAD TEST SUMMARY REPORT                   ',
        '═══════════════════════════════════════════════════════════════',
        '',
        `📊 AI Response Times:`,
        `   • Average: ${summary.metrics.aiResponseTime.avg.toFixed(0)}ms`,
        `   • P95: ${summary.metrics.aiResponseTime.p95.toFixed(0)}ms ${summary.metrics.aiResponseTime.p95 < 2000 ? '✅' : '❌'}`,
        `   • P99: ${summary.metrics.aiResponseTime.p99.toFixed(0)}ms ${summary.metrics.aiResponseTime.p99 < 5000 ? '✅' : '❌'}`,
        '',
        `📈 Success Rate: ${(summary.metrics.successRate * 100).toFixed(2)}% ${summary.metrics.successRate > 0.95 ? '✅' : '❌'}`,
        `❌ Error Count: ${summary.metrics.errorCount}`,
        `🔌 Circuit Breaker Triggers: ${summary.metrics.circuitBreakerTriggers}`,
        '',
        `🌐 HTTP Metrics:`,
        `   • Total Requests: ${summary.metrics.totalRequests}`,
        `   • Avg Duration: ${summary.metrics.httpDuration.avg.toFixed(0)}ms`,
        `   • P95 Duration: ${summary.metrics.httpDuration.p95.toFixed(0)}ms`,
        `   • P99 Duration: ${summary.metrics.httpDuration.p99.toFixed(0)}ms`,
        '',
        `🎯 Overall Result: ${summary.passedAllThresholds ? '✅ PASSED' : '❌ FAILED'}`,
        '',
        '═══════════════════════════════════════════════════════════════',
    ];
    
    console.log(reportLines.join('\n'));
    
    return {
        'stdout': reportLines.join('\n'),
        'ai-load-test-results.json': JSON.stringify(summary, null, 2),
    };
}





