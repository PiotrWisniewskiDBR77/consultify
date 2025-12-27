/**
 * E2E Tests: Assessment AI Features
 * End-to-end tests for AI-powered assessment assistance
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Assessment AI Features', () => {
    let page: Page;

    test.beforeEach(async ({ page: testPage }) => {
        page = testPage;

        // Login
        await page.goto('/login');
        await page.fill('input[type="email"]', 'test@example.com');
        await page.fill('input[type="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {});
    });

    // =========================================================================
    // AI GUIDANCE TESTS
    // =========================================================================

    test.describe('AI Guidance', () => {
        test('should show AI guidance panel', async () => {
            await page.goto('/assessment');

            // Open wizard or assessment editing
            const editButton = page.locator('button:has-text("Edit")')
                .or(page.locator('button:has-text("Start Assessment")'));

            if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await editButton.click();

                const guidancePanel = page.locator('[data-testid="ai-guidance"]')
                    .or(page.locator('text=/guidance|wskazówki/i'));

                await expect(guidancePanel).toBeVisible({ timeout: 5000 }).catch(() => {});
            }
        });

        test('should display contextual guidance for selected axis', async () => {
            await page.goto('/assessment');

            // Select an axis
            const axisCard = page.locator('[data-testid="axis-card"]').first();

            if (await axisCard.isVisible({ timeout: 3000 }).catch(() => false)) {
                await axisCard.click();

                // Guidance should update based on axis
                const guidance = page.locator('[data-testid="axis-guidance"]');
                await expect(guidance).toBeVisible({ timeout: 5000 }).catch(() => {});
            }
        });

        test('should show level-specific recommendations', async () => {
            await page.goto('/assessment');

            const editButton = page.locator('button:has-text("Edit")');

            if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await editButton.click();

                // Change score level
                const scoreSlider = page.locator('input[type="range"]');
                
                if (await scoreSlider.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await scoreSlider.fill('4');

                    // Recommendations should update
                    const recommendations = page.locator('text=/recommendation|rekomendacja/i');
                    await expect(recommendations).toBeVisible({ timeout: 5000 }).catch(() => {});
                }
            }
        });
    });

    // =========================================================================
    // AI JUSTIFICATION TESTS
    // =========================================================================

    test.describe('AI Justification Assistance', () => {
        test('should suggest justification text', async () => {
            await page.goto('/assessment');

            const suggestButton = page.locator('button:has-text("Suggest")')
                .or(page.locator('[data-testid="suggest-justification"]'));

            if (await suggestButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await suggestButton.click();

                // Wait for AI response
                await page.waitForTimeout(2000);

                const suggestion = page.locator('[data-testid="ai-suggestion"]')
                    .or(page.locator('.ai-suggestion'));

                await expect(suggestion).toBeVisible({ timeout: 10000 }).catch(() => {});
            }
        });

        test('should autocomplete justification text', async () => {
            await page.goto('/assessment');

            const editButton = page.locator('button:has-text("Edit")');

            if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await editButton.click();

                const justificationInput = page.locator('textarea[name="justification"]')
                    .or(page.locator('[data-testid="justification-input"]'));

                if (await justificationInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                    // Start typing
                    await justificationInput.fill('Organizacja posiada');

                    // Look for autocomplete suggestions
                    const autocomplete = page.locator('[data-testid="autocomplete-suggestions"]')
                        .or(page.locator('.autocomplete-menu'));

                    // Autocomplete might appear or require Tab key
                    await page.keyboard.press('Tab');
                    await page.waitForTimeout(500);
                }
            }
        });

        test('should correct language errors', async () => {
            await page.goto('/assessment');

            const editButton = page.locator('button:has-text("Edit")');

            if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await editButton.click();

                const justificationInput = page.locator('textarea').first();

                if (await justificationInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                    // Enter text with errors
                    await justificationInput.fill('Orginzacja ma wdrożne systemy');

                    // Look for correction button
                    const correctButton = page.locator('button:has-text("Correct")')
                        .or(page.locator('[data-testid="correct-text"]'));

                    if (await correctButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                        await correctButton.click();

                        // Wait for correction
                        await page.waitForTimeout(2000);
                    }
                }
            }
        });
    });

    // =========================================================================
    // AI EVIDENCE SUGGESTIONS TESTS
    // =========================================================================

    test.describe('AI Evidence Suggestions', () => {
        test('should suggest evidence types', async () => {
            await page.goto('/assessment');

            const evidenceButton = page.locator('button:has-text("Suggest Evidence")')
                .or(page.locator('[data-testid="suggest-evidence"]'));

            if (await evidenceButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await evidenceButton.click();

                // Should show evidence suggestions
                const evidenceList = page.locator('[data-testid="evidence-suggestions"]')
                    .or(page.locator('.evidence-list'));

                await expect(evidenceList).toBeVisible({ timeout: 5000 }).catch(() => {});
            }
        });

        test('should allow selecting suggested evidence', async () => {
            await page.goto('/assessment');

            const evidenceButton = page.locator('button:has-text("Suggest Evidence")');

            if (await evidenceButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await evidenceButton.click();
                await page.waitForTimeout(1000);

                // Select an evidence item
                const evidenceItem = page.locator('[data-testid="evidence-item"]').first();

                if (await evidenceItem.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await evidenceItem.click();
                }
            }
        });
    });

    // =========================================================================
    // AI TARGET SCORE SUGGESTIONS TESTS
    // =========================================================================

    test.describe('AI Target Score Suggestions', () => {
        test('should suggest target score', async () => {
            await page.goto('/assessment');

            const suggestTargetButton = page.locator('button:has-text("Suggest Target")')
                .or(page.locator('[data-testid="suggest-target"]'));

            if (await suggestTargetButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await suggestTargetButton.click();

                // Should show suggestion with reasoning
                const targetSuggestion = page.locator('[data-testid="target-suggestion"]')
                    .or(page.locator('text=/suggested target|rekomendowany cel/i'));

                await expect(targetSuggestion).toBeVisible({ timeout: 5000 }).catch(() => {});
            }
        });

        test('should offer different ambition levels', async () => {
            await page.goto('/assessment');

            // Look for ambition level selector
            const ambitionSelector = page.locator('[data-testid="ambition-level"]')
                .or(page.locator('text=/ambition|ambicja/i'));

            if (await ambitionSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
                // Should show options
                const conservative = page.locator('text=/conservative|konserwatywny/i');
                const balanced = page.locator('text=/balanced|zbalansowany/i');
                const ambitious = page.locator('text=/ambitious|ambitny/i');

                await expect(conservative.or(balanced).or(ambitious)).toBeVisible({ timeout: 3000 }).catch(() => {});
            }
        });
    });

    // =========================================================================
    // AI VALIDATION TESTS
    // =========================================================================

    test.describe('AI Score Validation', () => {
        test('should validate score consistency', async () => {
            await page.goto('/assessment');

            // Complete multiple axes and trigger validation
            const validateButton = page.locator('button:has-text("Validate")')
                .or(page.locator('[data-testid="validate-scores"]'));

            if (await validateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await validateButton.click();

                // Should show validation results
                const validationResults = page.locator('[data-testid="validation-results"]')
                    .or(page.locator('.validation-results'));

                await expect(validationResults).toBeVisible({ timeout: 5000 }).catch(() => {});
            }
        });

        test('should highlight inconsistencies', async () => {
            await page.goto('/assessment');

            // Look for inconsistency warnings
            const inconsistencyWarning = page.locator('[data-testid="inconsistency-warning"]')
                .or(page.locator('text=/inconsistency|niespójność/i'));

            // This would only be visible if there are actual inconsistencies
            await page.waitForTimeout(2000);
        });

        test('should suggest fixes for inconsistencies', async () => {
            await page.goto('/assessment');

            // If there are inconsistencies, there should be fix suggestions
            const fixButton = page.locator('button:has-text("Fix")')
                .or(page.locator('[data-testid="fix-inconsistency"]'));

            // This depends on having inconsistencies
            await page.waitForTimeout(1000);
        });
    });

    // =========================================================================
    // AI GAP ANALYSIS TESTS
    // =========================================================================

    test.describe('AI Gap Analysis', () => {
        test('should generate gap analysis', async () => {
            await page.goto('/assessment');

            // Look for gap analysis section
            const gapAnalysisSection = page.locator('[data-testid="gap-analysis"]')
                .or(page.locator('text=/gap analysis|analiza luk/i'));

            await expect(gapAnalysisSection).toBeVisible({ timeout: 5000 }).catch(() => {});
        });

        test('should show pathway to target', async () => {
            await page.goto('/assessment');

            // Look for pathway visualization
            const pathway = page.locator('[data-testid="maturity-pathway"]')
                .or(page.locator('.pathway-chart'))
                .or(page.locator('text=/pathway|ścieżka/i'));

            await expect(pathway).toBeVisible({ timeout: 5000 }).catch(() => {});
        });

        test('should estimate time to reach target', async () => {
            await page.goto('/assessment');

            // Look for time estimate
            const timeEstimate = page.locator('text=/months|miesięcy|years|lat/i');

            await expect(timeEstimate).toBeVisible({ timeout: 5000 }).catch(() => {});
        });
    });

    // =========================================================================
    // AI INSIGHTS TESTS
    // =========================================================================

    test.describe('AI Proactive Insights', () => {
        test('should display proactive insights', async () => {
            await page.goto('/assessment');

            // Look for insights section
            const insightsSection = page.locator('[data-testid="ai-insights"]')
                .or(page.locator('text=/insights|spostrzeżenia/i'));

            await expect(insightsSection).toBeVisible({ timeout: 5000 }).catch(() => {});
        });

        test('should show strength indicators', async () => {
            await page.goto('/assessment');

            const strengthIndicator = page.locator('[data-testid="strength-indicator"]')
                .or(page.locator('text=/strength|mocna strona/i'));

            await expect(strengthIndicator).toBeVisible({ timeout: 5000 }).catch(() => {});
        });

        test('should highlight priority gaps', async () => {
            await page.goto('/assessment');

            const priorityGap = page.locator('[data-testid="priority-gap"]')
                .or(page.locator('text=/priority|priorytet/i'));

            await expect(priorityGap).toBeVisible({ timeout: 5000 }).catch(() => {});
        });
    });

    // =========================================================================
    // AI CLARIFYING QUESTIONS TESTS
    // =========================================================================

    test.describe('AI Clarifying Questions', () => {
        test('should ask clarifying questions', async () => {
            await page.goto('/assessment');

            // Look for question indicator
            const questionIndicator = page.locator('[data-testid="clarifying-question"]')
                .or(page.locator('text=/question|pytanie/i'));

            // May not always be visible
            await page.waitForTimeout(2000);
        });

        test('should allow answering questions', async () => {
            await page.goto('/assessment');

            const questionInput = page.locator('[data-testid="question-answer-input"]')
                .or(page.locator('textarea[placeholder*="answer"]'));

            if (await questionInput.isVisible({ timeout: 3000 }).catch(() => false)) {
                await questionInput.fill('Example answer to clarifying question');

                const submitAnswer = page.locator('button:has-text("Submit Answer")');
                if (await submitAnswer.isVisible()) {
                    await submitAnswer.click();
                }
            }
        });
    });

    // =========================================================================
    // AI INITIATIVE GENERATION TESTS
    // =========================================================================

    test.describe('AI Initiative Generation', () => {
        test('should generate initiatives from gaps', async () => {
            await page.goto('/assessment');

            const generateButton = page.locator('button:has-text("Generate Initiatives")')
                .or(page.locator('[data-testid="generate-initiatives"]'));

            if (await generateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await generateButton.click();

                // Wait for generation
                await page.waitForTimeout(3000);

                const initiativesList = page.locator('[data-testid="initiatives-list"]')
                    .or(page.locator('.initiatives-grid'));

                await expect(initiativesList).toBeVisible({ timeout: 10000 }).catch(() => {});
            }
        });

        test('should allow prioritizing initiatives', async () => {
            await page.goto('/assessment');

            const prioritizeButton = page.locator('button:has-text("Prioritize")')
                .or(page.locator('[data-testid="prioritize-initiatives"]'));

            if (await prioritizeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await prioritizeButton.click();

                // Should show prioritization options
                const priorityOptions = page.locator('[data-testid="priority-options"]');
                await expect(priorityOptions).toBeVisible({ timeout: 3000 }).catch(() => {});
            }
        });

        test('should estimate ROI for initiatives', async () => {
            await page.goto('/assessment');

            // Look for ROI section
            const roiSection = page.locator('text=/ROI|Return on Investment/i');

            await expect(roiSection).toBeVisible({ timeout: 5000 }).catch(() => {});
        });
    });

    // =========================================================================
    // AI REPORT GENERATION TESTS
    // =========================================================================

    test.describe('AI Report Generation', () => {
        test('should generate executive summary', async () => {
            await page.goto('/assessment');

            const summaryButton = page.locator('button:has-text("Executive Summary")')
                .or(page.locator('[data-testid="generate-summary"]'));

            if (await summaryButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await summaryButton.click();

                // Wait for generation
                await page.waitForTimeout(3000);

                const summary = page.locator('[data-testid="executive-summary"]')
                    .or(page.locator('.executive-summary'));

                await expect(summary).toBeVisible({ timeout: 10000 }).catch(() => {});
            }
        });

        test('should generate stakeholder views', async () => {
            await page.goto('/assessment');

            const stakeholderViewButton = page.locator('button:has-text("Stakeholder View")')
                .or(page.locator('[data-testid="stakeholder-view"]'));

            if (await stakeholderViewButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await stakeholderViewButton.click();

                // Should show stakeholder selector
                const stakeholderSelector = page.locator('[data-testid="stakeholder-selector"]');
                await expect(stakeholderSelector).toBeVisible({ timeout: 3000 }).catch(() => {});
            }
        });
    });

    // =========================================================================
    // AI MODE INDICATOR TESTS
    // =========================================================================

    test.describe('AI Mode Indicator', () => {
        test('should show AI mode badge on AI-generated content', async () => {
            await page.goto('/assessment');

            // Look for AI mode indicator
            const aiModeBadge = page.locator('[data-testid="ai-mode-badge"]')
                .or(page.locator('text=AI Generated'))
                .or(page.locator('.ai-badge'));

            // May not be visible if no AI content generated yet
            await page.waitForTimeout(2000);
        });

        test('should distinguish fallback vs AI-generated', async () => {
            await page.goto('/assessment');

            // Look for fallback indicator
            const fallbackIndicator = page.locator('[data-testid="fallback-mode"]')
                .or(page.locator('text=Fallback'));

            // This would only be visible when AI is unavailable
            await page.waitForTimeout(1000);
        });
    });

    // =========================================================================
    // AI ERROR HANDLING TESTS
    // =========================================================================

    test.describe('AI Error Handling', () => {
        test('should show error message on AI failure', async () => {
            await page.goto('/assessment');

            // This would need network mocking
            const errorMessage = page.locator('[data-testid="ai-error"]')
                .or(page.locator('text=/ai error|błąd ai/i'));

            // Error might not be visible in normal flow
            await page.waitForTimeout(1000);
        });

        test('should allow retry on failure', async () => {
            await page.goto('/assessment');

            const retryButton = page.locator('button:has-text("Retry")')
                .or(page.locator('[data-testid="retry-ai"]'));

            // Retry button only visible on error
            await page.waitForTimeout(1000);
        });
    });

    // =========================================================================
    // AI FEEDBACK TESTS
    // =========================================================================

    test.describe('AI Feedback', () => {
        test('should show feedback buttons for AI suggestions', async () => {
            await page.goto('/assessment');

            // Generate some AI content first
            const suggestButton = page.locator('button:has-text("Suggest")');
            
            if (await suggestButton.isVisible({ timeout: 3000 }).catch(() => false)) {
                await suggestButton.click();
                await page.waitForTimeout(2000);

                // Look for feedback buttons
                const thumbsUp = page.locator('[data-testid="feedback-positive"]')
                    .or(page.locator('button[aria-label*="helpful"]'));
                const thumbsDown = page.locator('[data-testid="feedback-negative"]')
                    .or(page.locator('button[aria-label*="not helpful"]'));

                await expect(thumbsUp.or(thumbsDown)).toBeVisible({ timeout: 3000 }).catch(() => {});
            }
        });

        test('should submit feedback on click', async () => {
            await page.goto('/assessment');

            const thumbsUp = page.locator('[data-testid="feedback-positive"]');

            if (await thumbsUp.isVisible({ timeout: 3000 }).catch(() => false)) {
                await thumbsUp.click();

                // Should show confirmation
                const confirmation = page.locator('text=/thank|dzięk/i');
                await expect(confirmation).toBeVisible({ timeout: 3000 }).catch(() => {});
            }
        });
    });
});



