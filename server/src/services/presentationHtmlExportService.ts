/**
 * HTML5 Interactive Export Service — exports a presentation deck as a
 * self-contained single-page HTML file with IntersectionObserver animations,
 * keyboard navigation, and responsive design.
 */

import logger from '../utils/Logger.js';

interface ExportCard {
  card_id: string;
  title: string;
  header_footer?: {
    confidentiality?: string;
    pageNumber?: number;
    totalPages?: number;
    footerText?: string;
    showPageNumbers?: boolean;
  };
  blocks: {
    block_id: string;
    type: string;
    content: Record<string, unknown>;
  }[];
  background: { type: string; value?: string };
  animations: { entrance: string; block_stagger: boolean };
}

interface ExportDeck {
  title: string;
  cards: ExportCard[];
  theme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    textPrimary: string;
    textSecondary: string;
    heading: string;
  };
}

/**
 * Generate a standalone HTML5 file from a deck.
 * The output is a single .html file with embedded CSS/JS — no external dependencies.
 */
export function generateInteractiveHtml(deck: ExportDeck): string {
  const cardsHtml = deck.cards
    .map((card, index) => renderCardHtml(card, index, deck.theme))
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(deck.title)}</title>
<style>
${getEmbeddedCSS(deck.theme)}
</style>
</head>
<body>
<div id="deck-container">
  <div id="progress-bar"><div id="progress-fill"></div></div>
  <div id="slides-wrapper">
    ${cardsHtml}
  </div>
  <nav id="controls">
    <button id="prev-btn" onclick="navigate(-1)" aria-label="Previous">&larr;</button>
    <span id="slide-counter">1 / ${deck.cards.length}</span>
    <button id="next-btn" onclick="navigate(1)" aria-label="Next">&rarr;</button>
  </nav>
</div>
<script>
${getEmbeddedJS(deck.cards.length)}
</script>
</body>
</html>`;
}

function renderCardHtml(card: ExportCard, index: number, theme: ExportDeck['theme']): string {
  const bgStyle = getCardBgCSS(card.background, theme);
  const blocksHtml = card.blocks.map((block) => renderBlockHtml(block, theme)).join('\n');
  const footer = card.header_footer
    ? `<footer class="slide-footer"><span>${escapeHtml(String(card.header_footer.confidentiality || 'internal')).toUpperCase()}</span><span>${escapeHtml(String(card.header_footer.footerText || 'Consultify'))}</span>${card.header_footer.showPageNumbers !== false ? `<span>${card.header_footer.pageNumber || index + 1} / ${card.header_footer.totalPages || ''}</span>` : ''}</footer>`
    : '';

  return `<section class="slide" data-index="${index}" data-entrance="${card.animations.entrance}" data-stagger="${card.animations.block_stagger}" style="${bgStyle}">
  <div class="slide-content">
    ${blocksHtml}
  </div>
  ${footer}
</section>`;
}

function renderBlockHtml(
  block: { type: string; content: Record<string, unknown> },
  theme: ExportDeck['theme']
): string {
  const c = block.content;
  switch (block.type) {
    case 'heading':
      return `<h2 class="block block-heading animate-block" style="color:${theme.heading}">${escapeHtml(String(c.text || ''))}</h2>`;
    case 'paragraph':
      return `<p class="block block-paragraph animate-block" style="color:${theme.textPrimary}">${escapeHtml(String(c.text || ''))}</p>`;
    case 'bullet_list':
    case 'numbered_list': {
      const tag = block.type === 'numbered_list' ? 'ol' : 'ul';
      const items = (c.items as string[]) || [];
      return `<${tag} class="block block-list animate-block" style="color:${theme.textPrimary}">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</${tag}>`;
    }
    case 'kpi_widget':
      return `<div class="block block-kpi animate-block">
  <div class="kpi-value" style="color:${theme.primary}" data-count="${c.value}">${escapeHtml(String(c.value || '0'))}</div>
  <div class="kpi-label" style="color:${theme.textSecondary}">${escapeHtml(String(c.label || ''))}</div>
</div>`;
    case 'metric_strip': {
      const metrics = (c.metrics as { label: string; value: string }[]) || [];
      return `<div class="block block-metric-strip animate-block">${metrics.map((m) => `<div class="metric"><span class="metric-value" style="color:${theme.primary}">${escapeHtml(m.value)}</span><span class="metric-label" style="color:${theme.textSecondary}">${escapeHtml(m.label)}</span></div>`).join('')}</div>`;
    }
    case 'callout':
      return `<div class="block block-callout animate-block" style="border-left:3px solid ${theme.accent};background:${theme.surface};padding:12px 16px;border-radius:8px"><p style="color:${theme.textPrimary}">${escapeHtml(String(c.text || ''))}</p></div>`;
    case 'smart_layout': {
      const items = (c.items as Array<{ title?: string; description?: string }>) || [];
      return `<div class="block block-smart-layout animate-block">${items.map((item) => `<div class="smart-card" style="border-left:3px solid ${theme.accent};background:${theme.surface}"><strong style="color:${theme.heading}">${escapeHtml(String(item.title || ''))}</strong><p style="color:${theme.textSecondary}">${escapeHtml(String(item.description || ''))}</p></div>`).join('')}</div>`;
    }
    case 'timeline_block': {
      const items = (c.items as Array<{ date?: string; title?: string; description?: string }>) || [];
      return `<div class="block block-timeline animate-block">${items.map((item) => `<div class="timeline-item"><span style="color:${theme.accent}">${escapeHtml(String(item.date || ''))}</span><strong style="color:${theme.heading}">${escapeHtml(String(item.title || ''))}</strong><p style="color:${theme.textSecondary}">${escapeHtml(String(item.description || ''))}</p></div>`).join('')}</div>`;
    }
    case 'table': {
      const headers = (c.headers as string[]) || [];
      const rows = (c.rows as unknown[][]) || [];
      return `<table class="block block-table animate-block"><thead><tr>${headers.map((header) => `<th style="color:${theme.heading}">${escapeHtml(String(header))}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td style="color:${theme.textPrimary}">${escapeHtml(String(cell ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    case 'image':
      return `<div class="block block-image animate-block"><img src="${escapeHtml(String(c.src || c.url || ''))}" alt="${escapeHtml(String(c.alt || ''))}" style="max-width:100%;border-radius:8px"></div>`;
    case 'divider':
      return `<hr class="block block-divider animate-block" style="border-color:${theme.textSecondary}30">`;
    default:
      return `<div class="block animate-block" style="color:${theme.textSecondary}">[${block.type}]</div>`;
  }
}

function getCardBgCSS(bg: { type: string; value?: string }, theme: ExportDeck['theme']): string {
  switch (bg.type) {
    case 'color':
      return `background-color:${bg.value || theme.background}`;
    case 'gradient':
      return `background:${bg.value || `linear-gradient(135deg,${theme.primary},${theme.secondary})`}`;
    case 'image':
      return `background-image:url(${bg.value});background-size:cover;background-position:center`;
    default:
      return `background-color:${theme.surface}`;
  }
}

function getEmbeddedCSS(theme: ExportDeck['theme']): string {
  return `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:${theme.background};overflow:hidden;height:100vh}
#deck-container{position:relative;width:100%;height:100vh;overflow:hidden}
#progress-bar{position:fixed;top:0;left:0;right:0;height:3px;background:${theme.textSecondary}20;z-index:100}
#progress-fill{height:100%;background:${theme.primary};transition:width .3s ease;width:0}
#slides-wrapper{width:100%;height:100%;scroll-snap-type:y mandatory;overflow-y:auto;scroll-behavior:smooth}
.slide{min-height:100vh;scroll-snap-align:start;display:flex;align-items:center;justify-content:center;padding:60px 80px;position:relative}
.slide-footer{position:absolute;left:80px;right:80px;bottom:28px;display:flex;justify-content:space-between;gap:16px;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:${theme.textSecondary};opacity:.72}
.slide-content{max-width:960px;width:100%;display:flex;flex-direction:column;gap:16px}
.block-heading{font-size:2.5rem;font-weight:700;line-height:1.2}
.block-paragraph{font-size:1.1rem;line-height:1.7;opacity:.85}
.block-list{font-size:1rem;line-height:1.8;padding-left:24px}
.block-list li{margin-bottom:4px}
.block-kpi{text-align:center;padding:16px}
.kpi-value{font-size:3rem;font-weight:800}
.kpi-label{font-size:.9rem;margin-top:4px}
.block-metric-strip{display:flex;gap:32px;justify-content:center}
.metric{text-align:center}
.metric-value{display:block;font-size:1.8rem;font-weight:700}
.metric-label{display:block;font-size:.8rem;margin-top:2px}
.block-image{text-align:center}
.block-divider{border:none;border-top:1px solid;margin:8px 0}
#controls{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:16px;background:${theme.surface}ee;backdrop-filter:blur(8px);padding:8px 20px;border-radius:40px;box-shadow:0 4px 20px rgba(0,0,0,.1);z-index:100}
#controls button{background:none;border:none;font-size:1.2rem;cursor:pointer;padding:4px 8px;color:${theme.textPrimary};border-radius:8px;transition:.2s}
#controls button:hover{background:${theme.primary}20}
#slide-counter{font-size:.85rem;color:${theme.textSecondary};min-width:60px;text-align:center}
.animate-block{opacity:0;transform:translateY(20px);transition:opacity .5s ease,transform .5s ease}
.animate-block.visible{opacity:1;transform:translateY(0)}
@media(max-width:768px){.slide{padding:30px 24px}.block-heading{font-size:1.8rem}.kpi-value{font-size:2.2rem}.block-metric-strip{flex-wrap:wrap;gap:16px}}
`;
}

function getEmbeddedJS(totalSlides: number): string {
  return `
(function(){
  var current=0,total=${totalSlides};
  var wrapper=document.getElementById('slides-wrapper');
  var counter=document.getElementById('slide-counter');
  var progressFill=document.getElementById('progress-fill');

  function updateUI(){
    counter.textContent=(current+1)+' / '+total;
    progressFill.style.width=((current+1)/total*100)+'%';
  }

  function navigate(dir){
    current=Math.max(0,Math.min(total-1,current+dir));
    var slide=document.querySelectorAll('.slide')[current];
    if(slide)slide.scrollIntoView({behavior:'smooth'});
    updateUI();
  }
  window.navigate=navigate;

  // IntersectionObserver for block animations
  var observer=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        var blocks=entry.target.querySelectorAll('.animate-block');
        var stagger=entry.target.dataset.stagger==='true';
        blocks.forEach(function(block,i){
          setTimeout(function(){block.classList.add('visible')},stagger?i*150:0);
        });

        // Update current slide index
        var idx=parseInt(entry.target.dataset.index);
        if(!isNaN(idx)){current=idx;updateUI()}
      }
    });
  },{threshold:0.3});

  document.querySelectorAll('.slide').forEach(function(s){observer.observe(s)});

  // Keyboard navigation
  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowDown'||e.key==='ArrowRight'||e.key===' '){e.preventDefault();navigate(1)}
    if(e.key==='ArrowUp'||e.key==='ArrowLeft'){e.preventDefault();navigate(-1)}
    if(e.key==='Home'){e.preventDefault();current=0;navigate(0)}
    if(e.key==='End'){e.preventDefault();current=total-1;navigate(0)}
  });

  // Count-up animation for KPI values
  var kpiObserver=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting&&!entry.target.dataset.counted){
        entry.target.dataset.counted='true';
        var target=parseFloat(entry.target.dataset.count);
        if(isNaN(target))return;
        var start=performance.now();
        var duration=1200;
        (function tick(now){
          var progress=Math.min((now-start)/duration,1);
          var eased=1-Math.pow(1-progress,3);
          entry.target.textContent=Math.round(target*eased).toLocaleString();
          if(progress<1)requestAnimationFrame(tick);
          else entry.target.textContent=entry.target.dataset.count;
        })(start);
      }
    });
  },{threshold:0.5});

  document.querySelectorAll('[data-count]').forEach(function(el){kpiObserver.observe(el)});

  updateUI();
})();
`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Export a deck as a standalone interactive HTML5 file.
 */
export async function exportDeckAsHtml(deck: ExportDeck): Promise<Buffer> {
  try {
    const html = generateInteractiveHtml(deck);
    return Buffer.from(html, 'utf-8');
  } catch (error) {
    logger.error('[HtmlExport] Failed to generate HTML', { error });
    throw error;
  }
}
