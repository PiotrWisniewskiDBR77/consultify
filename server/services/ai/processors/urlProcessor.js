/**
 * URL Processor
 * 
 * Extracts text content from web pages using Cheerio for HTML parsing.
 * Supports static and JavaScript-rendered pages (with Puppeteer fallback).
 * 
 * Part of the Multimodal Content Ingestion System
 * 
 * @version 1.0.0
 */

const cheerio = require('cheerio');

// Common user agent to avoid bot detection
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Request timeout
const REQUEST_TIMEOUT = 30000;

/**
 * Process a URL and extract text content
 * 
 * @param {string} url - URL to process
 * @param {Object} options - Processing options
 * @param {boolean} options.renderJs - Use Puppeteer to render JavaScript
 * @param {boolean} options.includeLinks - Include links in output
 * @param {number} options.maxLength - Maximum content length
 * @returns {Promise<Object>} Extracted content with metadata
 */
async function process(url, options = {}) {
    const {
        renderJs = false,
        includeLinks = false,
        maxLength = 100000
    } = options;

    // Validate URL
    if (!isValidUrl(url)) {
        throw new Error('Invalid URL provided');
    }

    try {
        const startTime = Date.now();

        let html;
        if (renderJs) {
            html = await fetchWithPuppeteer(url);
        } else {
            html = await fetchWithFetch(url);
        }

        // Parse HTML with Cheerio
        const $ = cheerio.load(html);

        // Remove unwanted elements
        removeUnwantedElements($);

        // Extract metadata
        const title = extractTitle($);
        const description = extractDescription($);
        const author = extractAuthor($);
        const publishDate = extractPublishDate($);

        // Extract main content
        let content = extractMainContent($);

        // Include links if requested
        let links = [];
        if (includeLinks) {
            links = extractLinks($, url);
        }

        // Truncate if too long
        if (content.length > maxLength) {
            content = content.substring(0, maxLength) + '...[truncated]';
        }

        // Format output
        let text = '';
        if (title) {
            text += `# ${title}\n\n`;
        }
        if (author || publishDate) {
            const metaLine = [author, publishDate].filter(Boolean).join(' | ');
            text += `*${metaLine}*\n\n`;
        }
        if (description) {
            text += `> ${description}\n\n`;
        }
        text += content;

        if (includeLinks && links.length > 0) {
            text += '\n\n## Links\n';
            links.slice(0, 20).forEach(link => {
                text += `- [${link.text}](${link.href})\n`;
            });
        }

        const processingTime = Date.now() - startTime;

        return {
            text: text.trim(),
            html,
            metadata: {
                type: 'url',
                url,
                title,
                description,
                author,
                publishDate,
                renderedJs: renderJs,
                linkCount: links.length,
                characterCount: text.length,
                wordCount: countWords(text),
                processingTimeMs: processingTime
            },
            links
        };

    } catch (error) {
        console.error('[URLProcessor] Error processing URL:', error.message);
        
        if (error.message.includes('ENOTFOUND')) {
            throw new Error('URL not found. Please check the address.');
        }
        if (error.message.includes('403')) {
            throw new Error('Access denied. The website may block automated access.');
        }
        if (error.message.includes('timeout')) {
            throw new Error('Request timed out. The website may be slow or unavailable.');
        }
        
        throw new Error(`Failed to process URL: ${error.message}`);
    }
}

/**
 * Fetch URL content using fetch API
 */
async function fetchWithFetch(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            signal: controller.signal,
            redirect: 'follow'
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();

    } catch (error) {
        clearTimeout(timeout);
        throw error;
    }
}

/**
 * Fetch URL content using Puppeteer for JavaScript-heavy sites
 */
async function fetchWithPuppeteer(url) {
    let browser;
    
    try {
        // Dynamic import to avoid requiring puppeteer if not used
        const puppeteer = require('puppeteer');
        
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        await page.setViewport({ width: 1280, height: 800 });

        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: REQUEST_TIMEOUT
        });

        // Wait a bit for any lazy-loaded content
        await page.waitForTimeout(1000);

        const html = await page.content();
        await browser.close();

        return html;

    } catch (error) {
        if (browser) {
            await browser.close();
        }
        
        if (error.code === 'MODULE_NOT_FOUND') {
            console.warn('[URLProcessor] Puppeteer not installed, falling back to fetch');
            return fetchWithFetch(url);
        }
        
        throw error;
    }
}

/**
 * Remove unwanted elements from the DOM
 */
function removeUnwantedElements($) {
    // Remove scripts, styles, and other non-content elements
    const selectorsToRemove = [
        'script',
        'style',
        'noscript',
        'iframe',
        'svg',
        'nav',
        'footer',
        'header',
        'aside',
        '[role="banner"]',
        '[role="navigation"]',
        '[role="complementary"]',
        '[role="contentinfo"]',
        '.advertisement',
        '.ad',
        '.ads',
        '.social-share',
        '.comments',
        '.sidebar',
        '.menu',
        '.nav',
        '.footer',
        '.header',
        '#comments',
        '#sidebar',
        '#footer',
        '#header',
        '#nav',
        '.cookie-notice',
        '.popup',
        '.modal'
    ];

    selectorsToRemove.forEach(selector => {
        $(selector).remove();
    });
}

/**
 * Extract page title
 */
function extractTitle($) {
    // Try various title sources
    const sources = [
        $('meta[property="og:title"]').attr('content'),
        $('meta[name="twitter:title"]').attr('content'),
        $('h1').first().text(),
        $('title').text()
    ];

    for (const source of sources) {
        if (source && source.trim()) {
            return source.trim();
        }
    }

    return null;
}

/**
 * Extract page description
 */
function extractDescription($) {
    const sources = [
        $('meta[name="description"]').attr('content'),
        $('meta[property="og:description"]').attr('content'),
        $('meta[name="twitter:description"]').attr('content')
    ];

    for (const source of sources) {
        if (source && source.trim()) {
            return source.trim();
        }
    }

    return null;
}

/**
 * Extract author information
 */
function extractAuthor($) {
    const sources = [
        $('meta[name="author"]').attr('content'),
        $('meta[property="article:author"]').attr('content'),
        $('[rel="author"]').text(),
        $('.author').first().text(),
        $('[itemprop="author"]').text()
    ];

    for (const source of sources) {
        if (source && source.trim()) {
            return source.trim();
        }
    }

    return null;
}

/**
 * Extract publish date
 */
function extractPublishDate($) {
    const sources = [
        $('meta[property="article:published_time"]').attr('content'),
        $('meta[name="publish-date"]').attr('content'),
        $('time[datetime]').attr('datetime'),
        $('[itemprop="datePublished"]').attr('content')
    ];

    for (const source of sources) {
        if (source) {
            try {
                const date = new Date(source);
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            } catch (e) {
                // Continue to next source
            }
        }
    }

    return null;
}

/**
 * Extract main content from the page
 */
function extractMainContent($) {
    // Try to find the main content area
    const contentSelectors = [
        'article',
        '[role="main"]',
        'main',
        '.post-content',
        '.article-content',
        '.entry-content',
        '.content',
        '#content',
        '.post',
        '.article'
    ];

    for (const selector of contentSelectors) {
        const content = $(selector).first();
        if (content.length > 0) {
            const text = cleanText(content.text());
            if (text.length > 200) { // Minimum content threshold
                return text;
            }
        }
    }

    // Fallback to body
    return cleanText($('body').text());
}

/**
 * Extract links from the page
 */
function extractLinks($, baseUrl) {
    const links = [];
    const seen = new Set();

    $('a[href]').each((_, el) => {
        let href = $(el).attr('href');
        const text = $(el).text().trim();

        if (!href || !text || text.length < 2) return;

        // Resolve relative URLs
        try {
            href = new URL(href, baseUrl).href;
        } catch (e) {
            return; // Invalid URL
        }

        // Skip internal anchors, javascript, mailto, etc.
        if (href.startsWith('#') || 
            href.startsWith('javascript:') || 
            href.startsWith('mailto:') ||
            href.startsWith('tel:')) {
            return;
        }

        // Skip duplicates
        if (seen.has(href)) return;
        seen.add(href);

        links.push({
            href,
            text: text.substring(0, 100) // Limit text length
        });
    });

    return links;
}

/**
 * Clean extracted text
 */
function cleanText(text) {
    return text
        .replace(/\s+/g, ' ')           // Normalize whitespace
        .replace(/\n{3,}/g, '\n\n')     // Max 2 newlines
        .replace(/[^\S\n]+/g, ' ')      // Normalize spaces
        .trim();
}

/**
 * Validate URL format
 */
function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch (e) {
        return false;
    }
}

/**
 * Count words in text
 */
function countWords(text) {
    if (!text) return 0;
    return text
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0)
        .length;
}

/**
 * Check if URL is likely to need JavaScript rendering
 */
function needsJsRendering(url) {
    const jsHeavySites = [
        'twitter.com',
        'x.com',
        'facebook.com',
        'instagram.com',
        'linkedin.com',
        'reddit.com',
        'tiktok.com'
    ];

    try {
        const hostname = new URL(url).hostname;
        return jsHeavySites.some(site => hostname.includes(site));
    } catch (e) {
        return false;
    }
}

module.exports = {
    process,
    fetchWithFetch,
    fetchWithPuppeteer,
    isValidUrl,
    needsJsRendering,
    extractTitle,
    extractDescription,
    extractMainContent,
    cleanText
};

