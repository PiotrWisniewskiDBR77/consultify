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

  function applyTab(tab) {
    if (!tab) return;
    document.body.setAttribute("data-tab", tab);
    document.querySelectorAll("[data-tab-btn]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.tabBtn === tab);
    });
    document.querySelectorAll("[data-tab-panel]").forEach(function (panel) {
      panel.style.display = panel.dataset.tabPanel === tab ? "" : "none";
    });
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
