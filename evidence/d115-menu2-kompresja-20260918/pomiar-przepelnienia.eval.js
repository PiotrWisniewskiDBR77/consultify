(() => {
  // D-115 / DEC-675 — pomiar przepełnienia Menu 2 przy zwężonej powłoce.
  // Viewport zostaje 1280 (media queries widzą `xl`, NIE `xl2`), a zwężamy
  // TYLKO kontener ekranu, bo w prawdziwej aplikacji ~64 px zabiera lewa
  // szyna. Harness dev-render nie ma szyny, więc bez tego zawężenia defekt
  // się nie odtwarza (przy 1280 wszystko się mieści).
  const host = document.querySelector('[data-testid="z27-inicjatywy-skrzynka"]');
  if (!host) return { BLAD: 'brak hosta z27-inicjatywy-skrzynka' };
  const before = { width: host.style.width, maxWidth: host.style.maxWidth };
  const out = { viewport: window.innerWidth, hosty: {} };
  for (const w of [1100, 1150, 1216, 1280]) {
    host.style.width = w + 'px';
    host.style.maxWidth = w + 'px';
    void host.offsetWidth;
    const tablist = host.querySelector('[role="tablist"]');
    const seg = host.querySelector('[data-testid="initiatives-archive-scope"]');
    const row = host.querySelector('[data-testid="module-nav-main-row"]');
    const ucinane = [];
    if (tablist) {
      tablist.querySelectorAll('[role="tab"]').forEach((tab) => {
        // sr-only jest 1px z definicji — to nie jest ucięcie.
        if ((tab.className || '').includes('sr-only')) return;
        if (tab.scrollWidth - tab.clientWidth > 0) {
          ucinane.push(tab.tagName + ':' + Math.round(tab.scrollWidth - tab.clientWidth));
        }
      });
    }
    out.hosty[w] = {
      tabOverflow: tablist ? tablist.scrollWidth - tablist.clientWidth : null,
      segOverflow: seg ? seg.scrollWidth - seg.clientWidth : null,
      segRight: seg ? Math.round(seg.getBoundingClientRect().right) : null,
      rowRight: row ? Math.round(row.getBoundingClientRect().right) : null,
      ucinaneEtykiety: ucinane,
    };
  }
  host.style.width = before.width;
  host.style.maxWidth = before.maxWidth;
  return out;
})()
