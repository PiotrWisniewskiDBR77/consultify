#!/usr/bin/env python3
"""
seed-m16-demo.py — idempotentny seed danych M16 Finanse na demo.

Tworzy w pełni policzone dane, których brakowało (przyczyna 49 SKIP-ów kubełka A/D):
  - policzony model finansowy (events → compute → outputs + validations)
  - wycena DCF z sensitivity-matrix + tornado + comps (assumptions → peers → compute)
  - budżet v8 z liniami + scenariuszami + projekcją
  - enterprise budget z actuals (variance)
  - rekordy-jednorazówki do testów destrukcyjnych (delete/edit) — prefiks M16-THROWAWAY-

Idempotentny: rekordy seed mają prefiks tytułu "M16-SEED-" / "M16-THROWAWAY-".
Skrypt sprawdza istnienie po prefiksie i pomija ponowne tworzenie (poza compute, który odświeża).

Bezpieczeństwo: tylko demo.consultify.ai (caboose). NIE dotyka centerbeam/PROD.

Wymagane zmienne środowiskowe (fail-closed, brak wartości domyślnych):
  CONSULTIFY_BASE_URL       — np. https://demo.consultify.ai (NIGDY produkcja)
  CONSULTIFY_SEED_EMAIL     — konto seedujące
  CONSULTIFY_SEED_PASSWORD  — hasło do tego konta

Output: na końcu drukuje JSON manifest wszystkich ID do /tmp/m16_seed_manifest.json
        (konsumowany przez skrypt testów Fazy 2).

Użycie:  CONSULTIFY_BASE_URL=https://demo.consultify.ai \\
         CONSULTIFY_SEED_EMAIL=... CONSULTIFY_SEED_PASSWORD=... \\
         python3 scripts/seed-m16-demo.py
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error


def _require_env(name, hint):
    """Fail-closed: refuse to start rather than fall back to a baked-in value.

    Day-39 FIX-4. This file used to carry the owner's WORKING demo password in
    plain text, and the credential guard had it on its allowlist, so the one
    check that could have objected was told not to look.
    """
    value = os.environ.get(name, "").strip()
    if not value:
        print(f"[ODMOWA] Brak zmiennej srodowiskowej {name}. {hint}")
        sys.exit(2)
    return value


# Target and credentials come from the environment, never from this file.
# Defaulting BASE would put a remote host in the source; it has to be stated.
BASE = _require_env(
    "CONSULTIFY_BASE_URL",
    "Ustaw np. CONSULTIFY_BASE_URL=https://demo.consultify.ai (nigdy produkcja).",
).rstrip("/")
LOGIN = {
    "email": _require_env("CONSULTIFY_SEED_EMAIL", "Konto uzywane do seedowania danych M16."),
    "password": _require_env("CONSULTIFY_SEED_PASSWORD", "Haslo do tego konta."),
}
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

SEED = "M16-SEED-"
THROWAWAY = "M16-THROWAWAY-"


def req(method, path, token=None, body=None, timeout=120):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    r.add_header("User-Agent", UA)
    if token:
        r.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}
    except Exception as e:
        return 0, {"err": str(e)[:120]}


def login():
    st, d = req("POST", "/api/auth/login", body=LOGIN)
    token = d.get("token") or d.get("data", {}).get("token")
    if not token:
        print(f"❌ Login failed: {st} {d}")
        sys.exit(1)
    print(f"✅ Auth OK")
    return token


def step(label, ok):
    icon = "✅" if ok else "🔴"
    print(f"  {icon} {label}")
    return ok


def seed_model(token):
    """Policzony model: create → events → compute. Zwraca model_id."""
    print("\n── MODEL (policzony) ──")
    # idempotent: znajdź istniejący
    st, d = req("GET", "/api/v8/finance/models", token)
    models = d.get("data", {}).get("models", []) if st == 200 else []
    existing = next((m for m in models if str(m.get("name", "")).startswith(SEED)), None)
    if existing:
        mid = existing["id"]
        step(f"Model istnieje: {mid}", True)
    else:
        st, d = req("POST", "/api/v8/finance/models", token, {
            "name": f"{SEED}Computed Model",
            "startDate": "2025-01-01",
            "currency": "PLN",
            "horizonMonths": 24,
            "granularity": "monthly",
            "scenario": "base",
        })
        mid = d.get("data", {}).get("model", {}).get("id") or d.get("data", {}).get("id") or d.get("id")
        if not step(f"Create model → {mid}", bool(mid)):
            print(f"     resp: {st} {str(d)[:200]}")
            return None
        # eventy: przychód + koszty (żeby compute nie był zerowy)
        events = [
            {"eventType": "revenue", "name": "Sprzedaż AI", "amount": 1500000, "periodStart": "2025-01-01", "cfClassification": "operating", "recurrence": "monthly", "growthRate": 8},
            {"eventType": "cogs", "name": "COGS", "amount": 600000, "periodStart": "2025-01-01", "cfClassification": "operating", "recurrence": "monthly"},
            {"eventType": "opex", "name": "OPEX", "amount": 300000, "periodStart": "2025-01-01", "cfClassification": "operating", "recurrence": "monthly"},
            {"eventType": "capex_purchase", "name": "Maszyny", "amount": 800000, "periodStart": "2025-03-01", "cfClassification": "investing", "recurrence": "once"},
        ]
        for ev in events:
            est, _ = req("POST", f"/api/v8/finance/models/{mid}/events", token, ev)
            step(f"Event {ev['name']}: {est}", est in (200, 201))
    # compute (zawsze odśwież)
    cst, cd = req("POST", f"/api/v8/finance/models/{mid}/compute", token, {}, timeout=120)
    step(f"Compute model: {cst}", cst in (200, 201))
    return mid


def seed_valuation(token):
    """Wycena DCF z sensitivity+tornado+comps. Zwraca valuation_id."""
    print("\n── WYCENA (DCF + sensitivity + tornado + comps) ──")
    st, d = req("GET", "/api/economics/valuations", token)
    vals = d.get("valuations", d.get("data", {}).get("valuations", [])) if st == 200 else []
    existing = next((v for v in vals if str(v.get("title", "")).startswith(SEED)), None)
    if existing:
        vid = existing["id"]
        step(f"Wycena istnieje: {vid}", True)
    else:
        st, d = req("POST", "/api/economics/valuations", token, {
            "title": f"{SEED}DCF AI-readiness",
            "sourceType": "manual",
            "horizonYears": 5,
            "currency": "PLN",
        })
        vid = d.get("id") or d.get("data", {}).get("id") or d.get("valuation", {}).get("id")
        if not step(f"Create valuation → {vid}", bool(vid)):
            print(f"     resp: {st} {str(d)[:200]}")
            return None
    # assumptions z manualForecast (wymagane do compute), g<WACC
    ast, _ = req("PUT", f"/api/economics/valuations/{vid}/assumptions", token, {
        "waccPercent": 12,
        "terminalMethod": "gordon",
        "terminalGrowthPercent": 3,
        "netDebt": 0,
        "manualForecast": {"years": [
            {"year": 1, "fcff": 1000000, "revenue": 5000000, "ebitda": 1500000},
            {"year": 2, "fcff": 1200000, "revenue": 6000000, "ebitda": 1800000},
            {"year": 3, "fcff": 1450000, "revenue": 7200000, "ebitda": 2200000},
            {"year": 4, "fcff": 1700000, "revenue": 8500000, "ebitda": 2700000},
            {"year": 5, "fcff": 2000000, "revenue": 10000000, "ebitda": 3200000},
        ]},
    })
    step(f"Set assumptions (WACC 12% / g 3%): {ast}", ast in (200, 201))
    # peers (comps band)
    pst, _ = req("PUT", f"/api/economics/valuations/{vid}/peers", token, {
        "metric": "EV/EBITDA", "min": 6, "median": 8.5, "max": 11,
        "peerSet": [{"name": "Peer A", "notes": "SaaS, EU"}, {"name": "Peer B", "notes": "Comparable scale"}],
        "confidenceNote": "Public-multiples triangulation",
    })
    step(f"Set peers (2 comps): {pst}", pst in (200, 201))
    # compute (persistuje results.dcf/sensitivity/tornado/comps)
    cst, cd = req("POST", f"/api/economics/valuations/{vid}/compute", token, {}, timeout=120)
    step(f"Compute valuation: {cst}", cst in (200, 201))
    # weryfikacja results
    gst, gd = req("GET", f"/api/economics/valuations/{vid}", token)
    results = gd.get("results", gd.get("data", {}).get("results", {})) or {}
    has_dcf = bool(results.get("dcf"))
    has_sens = bool((results.get("sensitivity") or {}).get("matrix"))
    has_tor = bool(results.get("tornado"))
    step(f"results: dcf={has_dcf} sensitivity={has_sens} tornado={has_tor}", has_dcf and has_sens and has_tor)
    return vid


def seed_budget_v8(token):
    """Budżet v8 (economics) z liniami + scenariuszami + projekcją."""
    print("\n── BUDŻET v8 (linie + scenariusze + projekcja) ──")
    st, d = req("GET", "/api/economics/budgets", token)
    budgets = d.get("budgets", []) if st == 200 else []
    existing = next((b for b in budgets if str(b.get("title", "")).startswith(SEED)), None)
    if existing:
        bid = existing["id"]
        step(f"Budżet istnieje: {bid}", True)
    else:
        st, d = req("POST", "/api/economics/budgets", token, {
            "title": f"{SEED}FY25 Operating Budget",
            "periodStart": "2025-01-01",
            "periodEnd": "2025-12-31",
            "granularity": "monthly",
            "currency": "PLN",
        })
        bid = d.get("id") or d.get("budget", {}).get("id") or d.get("data", {}).get("id")
        if not step(f"Create budget → {bid}", bool(bid)):
            print(f"     resp: {st} {str(d)[:200]}")
            return None
    # pobierz linie + scenariusze
    gst, gd = req("GET", f"/api/economics/budgets/{bid}", token)
    body = gd.get("budget", gd) if isinstance(gd, dict) else {}
    lines = body.get("lines", gd.get("lines", []))
    scenarios = body.get("scenarios", gd.get("scenarios", []))
    # ustaw baseline na kilku liniach
    vals = {"REVENUE": 1200000, "COGS": 500000, "OPEX": 300000, "EBITDA": 400000}
    set_count = 0
    for ln in (lines or []):
        code = ln.get("line_code") or ln.get("lineCode") or ""
        if code in vals:
            lst, _ = req("PUT", f"/api/economics/budgets/{bid}/lines/{ln['id']}", token, {"baselineValue": vals[code]})
            if lst in (200, 201):
                set_count += 1
    step(f"Ustawiono baseline na {set_count} liniach", set_count > 0)
    # scenariusz Optimistic: adjustments + project
    opt = next((s for s in (scenarios or []) if str(s.get("scenario_type", s.get("scenarioType", ""))).lower() == "optimistic"), None)
    if opt:
        ast, _ = req("PUT", f"/api/economics/budgets/{bid}/scenarios/{opt['id']}/adjustments", token, {"revenueGrowth": 0.1, "costReduction": 0.05})
        step(f"Optimistic adjustments: {ast}", ast in (200, 201))
        prst, _ = req("POST", f"/api/economics/budgets/{bid}/scenarios/{opt['id']}/project", token, {})
        step(f"Optimistic project: {prst}", prst in (200, 201))
    return bid


def seed_enterprise_budget(token, model_id):
    """Enterprise budget (finance-v4) z actuals → variance."""
    print("\n── ENTERPRISE BUDGET (finance-v4 + actuals → variance) ──")
    if not model_id:
        step("Brak model_id — pomijam", False)
        return None
    st, d = req("GET", f"/api/finance-v4/models/{model_id}/budgets", token)
    budgets = d.get("budgets", []) if st == 200 else []
    existing = next((b for b in budgets if str(b.get("versionLabel", "")).startswith(SEED)), None)
    if existing:
        ebid = existing["id"]
        step(f"Enterprise budget istnieje: {ebid}", True)
    else:
        st, d = req("POST", f"/api/finance-v4/models/{model_id}/budgets", token, {
            "fiscalYear": 2025,
            "budgetType": "annual",
            "versionLabel": f"{SEED}v1",
            "plannedData": {"REVENUE": 1200000, "COGS": 500000, "OPEX": 300000},
        })
        ebid = d.get("id") or d.get("data", {}).get("id")
        if not step(f"Create enterprise budget → {ebid}", bool(ebid)):
            print(f"     resp: {st} {str(d)[:200]}")
            return None
    # actuals → variance
    ast, ad = req("POST", f"/api/finance-v4/budgets/{ebid}/actuals", token, {
        "actualData": {"REVENUE": 1100000, "COGS": 520000, "OPEX": 290000},
    })
    step(f"Set actuals (→ variance): {ast}", ast in (200, 201))
    return ebid


def seed_investment_analysis(token):
    """Analiza inwestycyjna (Investment tab) — idempotentna."""
    print("\n── ANALIZA INWESTYCYJNA (Investment tab) ──")
    st, d = req("GET", "/api/economics/analyses", token)
    analyses = d.get("analyses", d.get("data", {}).get("analyses", [])) if st == 200 else []
    existing = next((a for a in analyses if str(a.get("name", "")).startswith(SEED) and "Inwest" in str(a.get("name", ""))), None)
    if existing:
        aid = existing.get("id")
        step(f"Analiza inwest. istnieje: {aid}", True)
        return aid
    # utwórz investment_case
    st, d = req("POST", "/api/economics/analyses", token, {
        "name": f"{SEED}Analiza Inwestycyjna — Linia Prod",
        "analysisType": "investment_case",
    })
    aid = d.get("analysis", {}).get("id") or d.get("id") or d.get("data", {}).get("id")
    step(f"Utwórz analizę inwest.: {aid}", bool(aid))
    return aid


def seed_throwaways(token):
    """Rekordy-jednorazówki do testów destrukcyjnych (delete/edit)."""
    print("\n── REKORDY-JEDNORAZÓWKI (testy delete/edit) ──")
    ids = {}
    # model do delete
    st, d = req("POST", "/api/v8/finance/models", token, {
        "name": f"{THROWAWAY}Model DELETE", "startDate": "2025-01-01", "currency": "PLN",
        "horizonMonths": 12, "granularity": "monthly", "scenario": "base",
    })
    ids["model"] = d.get("data", {}).get("model", {}).get("id") or d.get("data", {}).get("id") or d.get("id")
    step(f"Throwaway model: {ids['model']}", bool(ids["model"]))
    # analiza do delete/edit
    st, d = req("POST", "/api/economics/analyses", token, {"name": f"{THROWAWAY}Analiza DELETE", "analysisType": "financial"})
    ids["analysis"] = d.get("analysis", {}).get("id")
    step(f"Throwaway analysis: {ids['analysis']}", bool(ids["analysis"]))
    # budżet do delete
    st, d = req("POST", "/api/economics/budgets", token, {
        "title": f"{THROWAWAY}Budżet DELETE", "periodStart": "2025-01-01", "periodEnd": "2025-12-31",
        "granularity": "monthly", "currency": "PLN",
    })
    ids["budget"] = d.get("id") or d.get("budget", {}).get("id") or d.get("data", {}).get("id")
    step(f"Throwaway budget: {ids['budget']}", bool(ids["budget"]))
    # wycena do delete
    st, d = req("POST", "/api/economics/valuations", token, {
        "title": f"{THROWAWAY}Wycena DELETE", "sourceType": "manual", "horizonYears": 3, "currency": "PLN",
    })
    ids["valuation"] = d.get("id") or d.get("data", {}).get("id")
    step(f"Throwaway valuation: {ids['valuation']}", bool(ids["valuation"]))
    return ids


def main():
    token = login()
    manifest = {"token_org": "a3e05d4a-5397-419d-b486-8e44366c0063"}
    manifest["model"] = seed_model(token)
    manifest["valuation"] = seed_valuation(token)
    manifest["budget_v8"] = seed_budget_v8(token)
    manifest["enterprise_budget"] = seed_enterprise_budget(token, manifest["model"])
    manifest["investment_analysis"] = seed_investment_analysis(token)
    manifest["throwaway"] = seed_throwaways(token)

    out = "/tmp/m16_seed_manifest.json"
    with open(out, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\n✅ Manifest zapisany: {out}")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
