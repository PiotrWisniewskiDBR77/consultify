import { expect, Page, test } from '@playwright/test';

async function dismissTourModal(page: Page) {
  const skipTour = page.getByRole('button', { name: /Skip tour|Pomiń/i }).first();
  const consultantCard = page.getByRole('button', { name: /Consultant|Konsultant/i }).first();
  const welcomeTitle = page.getByText(/Welcome to Consultinity|Witamy w Consultinity/i);

  for (let i = 0; i < 12; i++) {
    const hasSkip = await skipTour.isVisible().catch(() => false);
    const hasWelcome = await welcomeTitle.isVisible().catch(() => false);

    if (hasSkip) await skipTour.click({ timeout: 1500, force: true }).catch(() => {});
    if (hasWelcome) await consultantCard.click({ timeout: 1500, force: true }).catch(() => {});

    await page.keyboard.press('Escape').catch(() => {});

    const stillVisible =
      (await skipTour.isVisible().catch(() => false)) ||
      (await welcomeTitle.isVisible().catch(() => false));
    if (!stillVisible) return;
    await page.waitForTimeout(200);
  }
}

async function openHelpSearchOpenArticleAndRunNextAction(page: Page, opts: {
  entryTestId: string;
  searchQuery: string;
  articleSlug: string;
  expectedRoute: RegExp;
}) {
  await page.getByTestId(opts.entryTestId).click();
  await expect(page.getByTestId('help-knowledge-search')).toBeVisible();

  await page.getByTestId('help-knowledge-search').fill(opts.searchQuery);
  await expect(page.getByTestId(`help-article-card-${opts.articleSlug}`)).toBeVisible();
  await page.getByTestId(`help-article-card-${opts.articleSlug}`).click();

  await expect(page.getByTestId('help-next-action')).toBeVisible();
  await page.getByTestId('help-next-action').click();
  await expect(page).toHaveURL(opts.expectedRoute);
}

test.describe('P25-B contextual help entry points', () => {
  test.setTimeout(60000);

  test('Tools → Help → search → article → next action routes back', async ({ page }) => {
    await page.goto('/discovery-tools');
    await dismissTourModal(page);

    await openHelpSearchOpenArticleAndRunNextAction(page, {
      entryTestId: 'contextual-help-entry-tools',
      searchQuery: 'P25-B',
      articleSlug: 'p25b-tools-primer',
      expectedRoute: /\/discovery-tools(\?|$)/,
    });
  });

  test('Interview → Help → search → article → next action routes back', async ({ page }) => {
    await page.goto('/interview');
    await dismissTourModal(page);

    await openHelpSearchOpenArticleAndRunNextAction(page, {
      entryTestId: 'contextual-help-entry-interview',
      searchQuery: 'P25-B',
      articleSlug: 'p25b-interview-primer',
      expectedRoute: /\/interview(\?|$)/,
    });
  });

  test('Outputs → Help → search → article → next action routes back', async ({ page }) => {
    await page.goto('/presentations');
    await dismissTourModal(page);

    await openHelpSearchOpenArticleAndRunNextAction(page, {
      entryTestId: 'contextual-help-entry-outputs',
      searchQuery: 'P25-B',
      articleSlug: 'p25b-outputs-primer',
      expectedRoute: /\/presentations(\?|$)/,
    });
  });

  test('Missing article deep-link shows explicit degraded state', async ({ page }) => {
    await page.goto('/discovery-tools');
    await dismissTourModal(page);
    await page.goto('/discovery-tools?help_article=does-not-exist&help_module=discovery-tools');

    await expect(page.getByText(/Article not found/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Search help/i })).toBeVisible();
  });
});

test.describe('P25-B degraded modes: PL missing translation → explicit EN fallback', () => {
  test.use({ locale: 'pl-PL' });

  test('PL locale: EN-only article shows degraded banner + EN content', async ({ page }) => {
    await page.goto('/discovery-tools');
    await dismissTourModal(page);

    await page.getByTestId('contextual-help-entry-tools').click();
    await expect(page.getByTestId('help-knowledge-search')).toBeVisible();

    await page.getByTestId('help-knowledge-search').fill('P25-B');
    await expect(page.getByTestId('help-article-card-p25b-en-only')).toBeVisible();
    await page.getByTestId('help-article-card-p25b-en-only').click();

    await expect(page.getByText('Brak wersji PL — wyświetlamy EN')).toBeVisible();
    await expect(page.getByText(/EN-only article/i).first()).toBeVisible();
  });
});

