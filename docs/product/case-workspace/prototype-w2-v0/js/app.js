/*
 * Case Workspace prototype — shared behaviour.
 * NON-PRODUCTION. Pure client-side state switching for internal review /
 * screenshot capture; no network calls, no real data.
 */
(function () {
  "use strict";

  function qp(name, fallback) {
    var v = new URLSearchParams(window.location.search).get(name);
    return v === null ? fallback : v;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelectorAll("[data-proto-theme-btn]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.protoThemeBtn === theme);
    });
  }

  function applyState(state) {
    document.body.setAttribute("data-state", state);
    document.querySelectorAll("[data-proto-state-btn]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.protoStateBtn === state);
    });
  }

  var graphApi = null;

  // Graf mierzy się poprawnie dopiero gdy jest WIDOCZNY (ukryty ma offsetWidth 0),
  // więc każde pokazanie zakładki/widoku wymusza ponowne dopasowanie.
  function refitGraph() {
    if (graphApi) window.setTimeout(graphApi.fit, 0);
  }

  function applyTab(tab) {
    if (!tab) return;
    document.body.setAttribute("data-tab", tab);
    document.querySelectorAll("[data-tab-btn]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.tabBtn === tab);
    });
    document.querySelectorAll("[data-tab-panel]").forEach(function (panel) {
      panel.style.display = panel.dataset.tabPanel === tab ? "" : "none";
    });
    refitGraph();
  }

  function applyPlanView(view) {
    if (!view) return;
    document.body.setAttribute("data-plan-view", view);
    document.querySelectorAll("[data-plan-view-btn]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.planViewBtn === view);
    });
    document.querySelectorAll("[data-plan-view-panel]").forEach(function (panel) {
      panel.style.display = panel.dataset.planViewPanel === view ? "" : "none";
    });
    refitGraph();
  }

  /* ------------------------------------------------------------------ *
   * GRAF PLANU (widok Ekspercki) — zoom / „Dopasuj do widoku".
   * Wybór z DECISIONS pkt 1: kontener ze scrollem + CSS transform scale.
   * Wymóg bezpieczeństwa: NIE wolno rzucić błędem przy pustym grafie ani
   * przy 1 węźle — stąd każde dzielenie jest osłonięte, a brak węzłów
   * kończy się cichym scale=1 (a nie NaN/Infinity na transformie).
   * ------------------------------------------------------------------ */
  var GRAPH_MIN = 0.45;
  var GRAPH_MAX = 2;

  function initGraph(root) {
    var viewport = root.querySelector("[data-graph-viewport]");
    var sizer = root.querySelector("[data-graph-sizer]");
    var stage = root.querySelector("[data-graph-stage]");
    if (!viewport || !sizer || !stage) return null;

    var label = root.querySelector("[data-graph-scale-label]");
    var scale = 1;

    function naturalSize() {
      var prev = stage.style.transform;
      stage.style.transform = "none";
      var w = stage.offsetWidth || stage.scrollWidth || 0;
      var h = stage.offsetHeight || stage.scrollHeight || 0;
      stage.style.transform = prev;
      return { w: w, h: h };
    }

    function clamp(v) {
      if (typeof v !== "number" || !isFinite(v) || v <= 0) return 1;
      return Math.min(GRAPH_MAX, Math.max(GRAPH_MIN, v));
    }

    function apply(next) {
      scale = clamp(next);
      var n = naturalSize();
      stage.style.transform = scale === 1 ? "none" : "scale(" + scale + ")";
      // sizer musi nieść PRZESKALOWANY rozmiar, inaczej po zmniejszeniu
      // zostaje martwy pas scrolla (transform nie zmienia layoutu).
      sizer.style.width = n.w ? Math.round(n.w * scale) + "px" : "auto";
      sizer.style.height = n.h ? Math.round(n.h * scale) + "px" : "auto";
      if (label) label.textContent = Math.round(scale * 100) + "%";
      root.setAttribute("data-graph-scale", String(scale));
    }

    function availableWidth() {
      var cs = window.getComputedStyle(viewport);
      var pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      return (viewport.clientWidth || 0) - pad;
    }

    // Auto-dopasowanie NIE schodzi poniżej progu czytelności — inaczej na
    // telefonie graf „mieści się" w 47% i staje się nieczytelną plamą.
    // Poniżej progu zostawiamy czytelną skalę + scroll we własnej ramce,
    // a pełny przegląd daje JAWNE kliknięcie „Dopasuj do widoku".
    var AUTOFIT_FLOOR = 0.75;

    function fit(explicit) {
      // pusty graf / brak węzłów -> nic do dopasowania, ale też ZERO błędu
      if (!stage.querySelector(".graph-node")) { apply(1); return; }
      var n = naturalSize();
      var avail = availableWidth();
      if (!n.w || n.w <= 0 || avail <= 0) { apply(1); return; }
      var target = Math.min(1, avail / n.w);
      if (explicit !== true) target = Math.max(target, AUTOFIT_FLOOR);
      apply(target);
    }

    root.querySelectorAll("[data-graph-zoom]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var step = parseFloat(btn.getAttribute("data-graph-zoom"));
        apply(scale + (isFinite(step) ? step : 0));
      });
    });
    root.querySelectorAll("[data-graph-fit]").forEach(function (btn) {
      btn.addEventListener("click", function () { fit(true); });
    });
    root.querySelectorAll("[data-graph-reset]").forEach(function (btn) {
      btn.addEventListener("click", function () { apply(1); });
    });

    var t = null;
    window.addEventListener("resize", function () {
      window.clearTimeout(t);
      t = window.setTimeout(fit, 150);
    });

    fit();
    return { fit: fit, apply: apply };
  }

  /* ------------------------------------------------------------------ *
   * Pasek zakładek ze scrollem — jawna afordancja zamiast ucinania.
   * ------------------------------------------------------------------ */
  function initTabScroll(wrap) {
    var track = wrap.querySelector("[data-tabscroll-track]");
    if (!track) return;

    function sync() {
      var max = track.scrollWidth - track.clientWidth;
      if (max <= 2) { wrap.setAttribute("data-overflow", "none"); return; }
      if (track.scrollLeft <= 1) wrap.setAttribute("data-overflow", "start");
      else if (track.scrollLeft >= max - 1) wrap.setAttribute("data-overflow", "end");
      else wrap.setAttribute("data-overflow", "middle");
    }

    track.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    wrap.querySelectorAll("[data-tabscroll-nudge]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var dir = parseFloat(btn.getAttribute("data-tabscroll-nudge")) || 1;
        track.scrollLeft += dir * Math.max(120, track.clientWidth * 0.6);
        window.setTimeout(sync, 250);
      });
    });

    // Aktywna zakładka zawsze w polu widzenia — przesuwamy WYŁĄCZNIE poziom
    // tego paska. (scrollIntoView przewijał także CAŁĄ stronę w pionie i przy
    // 320px chował Menu 1 pod przyklejonym paskiem prototypu.)
    var active = track.querySelector(".is-active");
    if (active) {
      var left = active.offsetLeft;
      var right = left + active.offsetWidth;
      if (right > track.scrollLeft + track.clientWidth) track.scrollLeft = right - track.clientWidth;
      else if (left < track.scrollLeft) track.scrollLeft = left;
    }
    sync();
  }

  function setUrlParam(name, value) {
    var url = new URL(window.location.href);
    url.searchParams.set(name, value);
    window.history.replaceState({}, "", url);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var theme = qp("theme", "dark");
    var state = qp("state", "default");
    var tab = qp("tab", document.body.getAttribute("data-default-tab") || null);
    var planView = qp("view", document.body.getAttribute("data-default-plan-view") || null);

    applyTheme(theme);
    applyState(state);
    applyTab(tab);
    applyPlanView(planView);

    document.querySelectorAll("[data-proto-theme-btn]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyTheme(btn.dataset.protoThemeBtn);
        setUrlParam("theme", btn.dataset.protoThemeBtn);
      });
    });
    document.querySelectorAll("[data-proto-state-btn]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyState(btn.dataset.protoStateBtn);
        setUrlParam("state", btn.dataset.protoStateBtn);
      });
    });
    document.querySelectorAll("[data-tab-btn]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyTab(btn.dataset.tabBtn);
        setUrlParam("tab", btn.dataset.tabBtn);
      });
    });
    document.querySelectorAll("[data-plan-view-btn]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyPlanView(btn.dataset.planViewBtn);
        setUrlParam("view", btn.dataset.planViewBtn);
      });
    });

    // accordion sections in right panel
    document.querySelectorAll(".acc-header").forEach(function (header) {
      header.addEventListener("click", function () {
        header.closest(".acc-section").classList.toggle("is-open");
      });
    });

    // right panel drawer toggle (narrow viewports)
    document.querySelectorAll("[data-panel-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var panel = document.querySelector(".right-panel");
        if (panel) panel.classList.toggle("is-open");
      });
    });

    // graf planu + paski zakładek ze scrollem
    document.querySelectorAll("[data-graph]").forEach(function (root) {
      graphApi = initGraph(root) || graphApi;
    });
    document.querySelectorAll("[data-tabscroll]").forEach(initTabScroll);

    // Na wąskim ekranie preview startuje ZAMKNIĘTY (lista jest ekranem
    // głównym); otwiera go dopiero wybór wiersza, zamyka jawny powrót.
    var bodyRow = document.querySelector(".body-row");
    if (bodyRow && window.innerWidth <= 1024) bodyRow.classList.add("preview-closed");

    // row click -> open preview (list screen)
    document.querySelectorAll("[data-row-select]").forEach(function (row) {
      row.addEventListener("click", function (e) {
        if (e.target.closest("[data-no-select]")) return;
        document.querySelectorAll("[data-row-select]").forEach(function (r) {
          r.classList.remove("is-selected");
        });
        row.classList.add("is-selected");
        document.querySelectorAll("[data-preview-for]").forEach(function (p) {
          p.style.display = p.dataset.previewFor === row.dataset.rowSelect ? "" : "none";
        });
        if (bodyRow) bodyRow.classList.remove("preview-closed");
      });
    });

    // jawny, zawsze widoczny powrót z preview do listy (mobile)
    document.querySelectorAll("[data-preview-close]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (bodyRow) bodyRow.classList.add("preview-closed");
      });
    });

    // deliverable open -> mock "return to case" transition
    document.querySelectorAll("[data-open-deliverable]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var overlay = document.getElementById("deliverable-overlay");
        if (overlay) overlay.style.display = "flex";
      });
    });
    document.querySelectorAll("[data-return-to-case]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var overlay = document.getElementById("deliverable-overlay");
        if (overlay) overlay.style.display = "none";
      });
    });
  });
})();
