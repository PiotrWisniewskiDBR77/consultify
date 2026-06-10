# Benchmark — raport nocnej dystylacji (2026-06-09 → 06-10)

> Stan dla Piotra na rano. TL;DR: **16/16 briefów istnieje**, ale **macOS odciął dostęp do dysku
> w połowie sesji**, więc ~połowa briefów jest oparta na sitemap+wiedzy, nie na realnej treści
> scrapów. **Żaden surowy plik nie został usunięty** — `Softs` nietknięty (nadal ~34 GB).

## ⚠️ Blocker, który zdominował noc: macOS Full Disk Access
W trakcie sesji proces powłoki (Bash) stracił dostęp do całego `~/Documents`
(`Operation not permitted`), a pod koniec blokada zaczęła obejmować też narzędzie odczytu.
To NIE jest błąd kodu — to uprawnienie systemowe.

**Fix (1 minuta, Ty):** System Settings → Privacy & Security → **Full Disk Access**
→ włącz dla aplikacji hosta (Terminal / iTerm / VS Code / app Claude) → zrestartuj ją.
Po tym da się dokończyć dystylację z realnej treści + dograć zrzuty + posprzątać surowiec.

## Stan briefów (grounding)

| Brief | Grounding | Zrzuty | Uwaga |
|---|---|---|---|
| ✅ notes-notebooks | **scrape (realny)** | **3** | Notion: bloki, Teamspaces, bazy — waliduje nasz overhaul notatnika |
| ✅ presentations | **scrape (realny)** | **4** | Gamma API + MCP, Beautiful.ai Smart Slides, Pitch |
| ✅ projects-initiatives | **scrape (realny)** | **3** | Linear/ClickUp/Monday; model Initiative→Project→Issue |
| 🟡 tables | częściowy (Coda openapi + Airtable inv.) | 0 | mocny sygnał API; zrzuty do dograniа |
| 🟡 chat-and-ai | częściowy (Kimi opisany) | 0 | 5 zrzutów Kimi widzianych, nieskopiowane (blok) |
| 🟡 surveys-interview | częściowy (inwentarz) | 0 | Typeform/Qualtrics/SM |
| 🟡 calendar-meeting | częściowy (Google extr.) | 0 | reszta API z wiedzy |
| 🟡 whiteboard | częściowy (nav tldraw) | 0 | pilot — feature-surface OK |
| ⚪ kpi-insights | wiedza | 0 | brief odtworzony — re-dystylacja |
| ⚪ process-flow | wiedza+sitemap | 0 | Lucid SDK nazwy plików zebrane |
| ⚪ mind-map | wiedza+sitemap | 0 | |
| ⚪ knowledge-base | wiedza | 0 | pełny blok dostępu |
| ⚪ integrations | wiedza+sitemap | 0 | sitemap Workato/Mule/Boomi bogaty |
| ⚪ enterprise-aip | wiedza+sitemap | 0 | sitemap 646 URL Palantir |
| ⚪ realtime-collab | wiedza (architektura) | 0 | OK — to brief decyzyjny, treść stabilna |
| ⚪ financial-analysis | wiedza (speculative) | 0 | patrz Apiary niżej |

Legenda: ✅ gotowe i ugruntowane · 🟡 użyteczne, do dogrania na realnej treści · ⚪ do re-dystylacji.

## 🔎 Znaleziska — źródła błędnie oznaczone / puste (do sprzątania w Softs)
- `0 Ankiety/Qualtrics 2` → to faktycznie **Typeform**, nie Qualtrics.
- `0 Projekty/Monday help.zip` → to faktycznie **Notion API**.
- `0 Projekty/Monday support.zip` → to faktycznie **Evernote**.
- `0 synchronizacja/Boomi2` → **pusty** (same assety).
- `0 Kalendarz/GOOGLE CALENDAR` → **pusty** (0 plików).
- `0 Analiza finansowa/Apiary.zip` → to **Apiary.io (API design)**, NIE narzędzie finansowe — wyłączyć z tego modułu.
- `0 Ankiety/Surveymonkey 1/www` → JS-shell; wartość jest w `developer.surveymonkey.com`.

## Co zostało zrobione wcześniej (trwałe)
- Faza 1 sprzątania: **−3,5 GB** (kopie językowe PDF, ciężkie GIF-y, 156 katalogów trackerów) — `Softs/_AUDIT/08_DELETED_LOG.txt`.
- Manifesty audytu: `Softs/_AUDIT/`. Ważna korekta: **59/60 ZIP-ów to jedyna kopia** — rozpakować, nie kasować.

## Rekomendowane następne kroki (po przywróceniu dostępu)
1. Re-dystylacja 8 briefów ⚪ z realnej treści (mam dla każdego gotowy plan + sitemap).
2. Dograć zrzuty do 🟡 (Kimi, Databox, Typeform, tldraw…).
3. Dopiero wtedy agresywne sprzątanie surowca (→ Kosz), cel 34 GB → kilkaset MB.
4. Posprzątać błędnie oznaczone/puste źródła z listy wyżej.

**Nie usunąłem nic z surowca — czekam, aż briefy będą realnie ugruntowane.**
