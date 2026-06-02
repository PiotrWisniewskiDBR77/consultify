import { expect, Page, test } from '@playwright/test';
import { seedE2EAuthWithBootstrap } from './runtime-gate-helpers';

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

async function recoverInterviewIfCrashed(page: Page) {
  const crashHeading = page.getByRole('heading', { name: /Coś poszło nie tak|Something went wrong/i });
  const retryButton = page.getByRole('button', { name: /Spróbuj ponownie|Try again/i }).first();
  const entryButton = page.getByTestId('contextual-help-entry-interview');

  for (let i = 0; i < 2; i++) {
    if (await entryButton.isVisible().catch(() => false)) return;

    const hasCrash = await crashHeading.isVisible().catch(() => false);
    if (!hasCrash) {
      await page.waitForTimeout(400);
      continue;
    }

    if (await retryButton.isVisible().catch(() => false)) {
      await retryButton.click({ timeout: 3000 }).catch(() => {});
    } else {
      await page.goto('/interview');
    }
    await page.waitForTimeout(600);
  }
}

async function ensureHelpEntrypointVisible(page: Page, entryTestId: string, routePath: string) {
  const entry = page.getByTestId(entryTestId);
  const crashHeading = page.getByRole('heading', { name: /Coś poszło nie tak|Something went wrong/i });
  const retryButton = page.getByRole('button', { name: /Spróbuj ponownie|Try again/i }).first();

  for (let attempt = 0; attempt < 3; attempt++) {
    if (await entry.isVisible().catch(() => false)) return;

    const hasCrash = await crashHeading.isVisible().catch(() => false);
    if (hasCrash && (await retryButton.isVisible().catch(() => false))) {
      await retryButton.click({ timeout: 3000 }).catch(() => {});
    } else {
      await gotoWithRetry(page, routePath);
      await dismissTourModal(page);
    }
    await page.waitForTimeout(700);
  }

  await expect(entry).toBeVisible({ timeout: 15000 });
}

async function gotoWithRetry(page: Page, path: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 45000 });
      return;
    } catch (error) {
      if (attempt === 1) throw error;
      await page.waitForTimeout(600);
    }
  }
}

async function ensureArticleVisible(page: Page, searchQuery: string, articleSlug: string) {
  const search = page.getByTestId('help-knowledge-search');
  const article = page.getByTestId(`help-article-card-${articleSlug}`);
  for (let attempt = 0; attempt < 3; attempt++) {
    await search.fill('');
    await search.fill(searchQuery);
    const visible = await article.isVisible().catch(() => false);
    if (visible) return;
    await page.waitForTimeout(500);
  }
  await expect(article).toBeVisible({ timeout: 10000 });
}

async function openHelpSearchOpenArticleAndRunNextAction(page: Page, opts: {
  entryTestId: string;
  searchQuery: string;
  articleSlug: string;
  expectedRoute: RegExp;
  routePath: string;
}) {
  await ensureHelpEntrypointVisible(page, opts.entryTestId, opts.routePath);
  await page.getByTestId(opts.entryTestId).click();
  await expect(page.getByTestId('help-knowledge-search')).toBeVisible();

  await ensureArticleVisible(page, opts.searchQuery, opts.articleSlug);
  await page.getByTestId(`help-article-card-${opts.articleSlug}`).first().click({
    timeout: 20000,
    noWaitAfter: true,
  });

  await expect(page.getByTestId('help-next-action')).toBeVisible();
  await page.getByTestId('help-next-action').click();
  await expect(page).toHaveURL(opts.expectedRoute);
}

test.describe('P25-B contextual help entry points', () => {
  test.setTimeout(60000);
  test.beforeEach(async ({ page }) => {
    await seedE2EAuthWithBootstrap(page);
    await page.route('**/api/v8/kb/search**', async (route) => {
      const url = new URL(route.request().url());
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const lang = (url.searchParams.get('lang') || 'en').toLowerCase();
      const bySlug: Record<string, any> = {
        'p25b-tools-primer': {
          id: 'kb-tools',
          slug: 'p25b-tools-primer',
          title: 'P25-B Tools Primer',
          summary: 'Tools primer',
          reading_time_minutes: 4,
          is_featured: false,
          category_slug: 'tools',
          category_name: 'Tools',
          category_icon: 'Wrench',
          view_count: 0,
          requested_language: lang,
          resolved_language: lang,
          is_fallback: false,
        },
        'p25b-interview-primer': {
          id: 'kb-interview',
          slug: 'p25b-interview-primer',
          title: 'P25-B Interview Primer',
          summary: 'Interview primer',
          reading_time_minutes: 4,
          is_featured: false,
          category_slug: 'interview',
          category_name: 'Interview',
          category_icon: 'MessageSquare',
          view_count: 0,
          requested_language: lang,
          resolved_language: lang,
          is_fallback: false,
        },
        'p25b-outputs-primer': {
          id: 'kb-outputs',
          slug: 'p25b-outputs-primer',
          title: 'P25-B Outputs Primer',
          summary: 'Outputs primer',
          reading_time_minutes: 4,
          is_featured: false,
          category_slug: 'outputs',
          category_name: 'Outputs',
          category_icon: 'FileText',
          view_count: 0,
          requested_language: lang,
          resolved_language: lang,
          is_fallback: false,
        },
        'p25b-en-only': {
          id: 'kb-en-only',
          slug: 'p25b-en-only',
          title: 'EN-only article',
          summary: 'EN only',
          reading_time_minutes: 2,
          is_featured: false,
          category_slug: 'tools',
          category_name: 'Tools',
          category_icon: 'Wrench',
          view_count: 0,
          requested_language: lang,
          resolved_language: 'en',
          is_fallback: lang !== 'en',
        },
      };
      const articles = q.includes('p25-b')
        ? [
            bySlug['p25b-tools-primer'],
            bySlug['p25b-interview-primer'],
            bySlug['p25b-outputs-primer'],
            bySlug['p25b-en-only'],
          ]
        : [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { articles } }),
      });
    });
    await page.route('**/api/v8/kb/articles/**', async (route) => {
      const url = new URL(route.request().url());
      const slug = decodeURIComponent(url.pathname.split('/').pop() || '');
      if (slug === 'does-not-exist') {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'not_found' }),
        });
        return;
      }
      const lang = (url.searchParams.get('lang') || 'en').toLowerCase();
      const fallback = slug === 'p25b-en-only' && lang !== 'en';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            article: {
              id: `article-${slug}`,
              slug,
              title: slug === 'p25b-en-only' ? 'EN-only article' : `Article ${slug}`,
              summary: `Summary ${slug}`,
              content: `# ${slug}\n\nBody`,
              reading_time_minutes: 3,
              is_featured: false,
              category_slug: 'tools',
              category_name: 'Tools',
              category_icon: 'Wrench',
              view_count: 0,
              related_modules: [],
              target_audience: [],
              category_id: 'cat-tools',
              requested_language: lang,
              resolved_language: fallback ? 'en' : lang,
              is_fallback: fallback,
              next_action:
                slug === 'p25b-tools-primer'
                  ? { route: '/discovery-tools' }
                  : slug === 'p25b-interview-primer'
                    ? { route: '/interview' }
                    : slug === 'p25b-outputs-primer'
                      ? { route: '/presentations' }
                      : null,
            },
          },
        }),
      });
    });
  });

  test('Tools → Help → search → article → next action routes back', async ({ page }) => {
    await gotoWithRetry(page, '/discovery-tools');
    await dismissTourModal(page);

    await openHelpSearchOpenArticleAndRunNextAction(page, {
      entryTestId: 'contextual-help-entry-tools',
      searchQuery: 'P25-B',
      articleSlug: 'p25b-tools-primer',
      expectedRoute: /\/discovery-tools(\?|$)/,
      routePath: '/discovery-tools',
    });
  });

  test('Interview → Help → search → article → next action routes back', async ({ page }) => {
    await gotoWithRetry(page, '/interview');
    await dismissTourModal(page);
    await recoverInterviewIfCrashed(page);

    await openHelpSearchOpenArticleAndRunNextAction(page, {
      entryTestId: 'contextual-help-entry-interview',
      searchQuery: 'P25-B',
      articleSlug: 'p25b-interview-primer',
      expectedRoute: /\/interview(\?|$)/,
      routePath: '/interview',
    });
  });

  test('Outputs → Help → search → article → next action routes back', async ({ page }) => {
    await gotoWithRetry(page, '/presentations');
    await dismissTourModal(page);

    await openHelpSearchOpenArticleAndRunNextAction(page, {
      entryTestId: 'contextual-help-entry-outputs',
      searchQuery: 'P25-B',
      articleSlug: 'p25b-outputs-primer',
      expectedRoute: /\/presentations(\?|$)/,
      routePath: '/presentations',
    });
  });

  test('Missing article deep-link shows explicit degraded state', async ({ page }) => {
    await gotoWithRetry(page, '/discovery-tools');
    await dismissTourModal(page);
    await page.goto('/discovery-tools?help_article=does-not-exist&help_module=discovery-tools');

    await expect(page.getByText(/moved or removed/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Browse collections/i })).toBeVisible();
  });
});

test.describe('P25-B degraded modes: PL missing translation → explicit EN fallback', () => {
  test.use({ locale: 'pl-PL' });
  test.beforeEach(async ({ page }) => {
    await seedE2EAuthWithBootstrap(page);
    await page.route('**/api/v8/kb/search**', async (route) => {
      const articles = [
        {
          id: 'kb-en-only',
          slug: 'p25b-en-only',
          title: 'EN-only article',
          summary: 'EN only',
          reading_time_minutes: 2,
          is_featured: false,
          category_slug: 'tools',
          category_name: 'Tools',
          category_icon: 'Wrench',
          view_count: 0,
          requested_language: 'pl',
          resolved_language: 'en',
          is_fallback: true,
        },
      ];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { articles } }),
      });
    });
    await page.route('**/api/v8/kb/articles/p25b-en-only**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            article: {
              id: 'article-p25b-en-only',
              slug: 'p25b-en-only',
              title: 'EN-only article',
              summary: 'EN only',
              content: '# EN-only article\n\nBody',
              reading_time_minutes: 2,
              is_featured: false,
              category_slug: 'tools',
              category_name: 'Tools',
              category_icon: 'Wrench',
              view_count: 0,
              related_modules: [],
              target_audience: [],
              category_id: 'cat-tools',
              requested_language: 'pl',
              resolved_language: 'en',
              is_fallback: true,
            },
          },
        }),
      });
    });
  });

  test('PL locale: EN-only article shows degraded banner + EN content', async ({ page }) => {
    await gotoWithRetry(page, '/discovery-tools');
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

