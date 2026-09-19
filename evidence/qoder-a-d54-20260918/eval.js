(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rows = Array.from(document.querySelectorAll('tbody tr'));
  if (!rows.length) return 'NO_ROWS';
  const firstCellText = (rows[0].textContent || '').slice(0, 60);
  rows[0].click();
  let alert = null;
  for (let i = 0; i < 60; i++) {
    await sleep(200);
    const cands = Array.from(document.querySelectorAll('[role="alert"]'));
    alert = cands.find((a) => /gates/i.test(a.textContent || '')) || null;
    if (alert) break;
  }
  if (!alert) {
    const all = Array.from(document.querySelectorAll('[role="alert"]')).map((a) => (a.textContent || '').slice(0, 60));
    return 'NO_ALERT row=' + firstCellText + ' alerts=' + JSON.stringify(all);
  }
  const cs = getComputedStyle(alert);
  let bgEl = alert;
  let bg = 'rgba(0, 0, 0, 0)';
  while (bgEl) {
    const b = getComputedStyle(bgEl).backgroundColor;
    if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) { bg = b; break; }
    bgEl = bgEl.parentElement;
  }
  const parse = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const L1 = lum(parse(cs.color));
  const L2 = lum(parse(bg));
  const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  return JSON.stringify({
    text: (alert.textContent || '').slice(0, 80),
    cls: alert.className,
    color: cs.color,
    bg,
    contrast: Math.round(ratio * 100) / 100,
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  });
})()
