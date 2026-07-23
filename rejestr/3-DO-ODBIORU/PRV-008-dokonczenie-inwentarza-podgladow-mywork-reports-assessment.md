---
id: PRV-008
tytul: Dokończenie inwentarza podglądów — MyWork, Reports, Assessment
typ: analiza
waga: srednia
obszar: PRV
stan: do-odbioru
wlasciciel: piotr
blokuje: [PRV-009]
zablokowane_przez: []
zrodlo: "_REJESTR_ZYWY.md / _RAPORT.md, 20-21.07"
stare_id: A2b
utworzone: 2026-07-21
---

## 1. PROBLEM

Analiza PRV-007 zostawiła 9 plików niezbadanych. Zadanie miało je uzupełnić.

## 2. PRZYCZYNA

Nie dotyczy — analiza.

**★ Przesłanka zadania okazała się nieaktualna.** Zadanie brzmiało „scalić raporty cząstkowe, które wróciły osobno". Sprawdzenie (`git log --all --diff-filter=A -- "**/_ANALIZA*"`, `git rev-list --all --objects | grep -i ANALIZA`, worktree `.worktrees/a2-preview-inventory`) wykazało, że **żaden osobny raport cząstkowy nie istnieje w repo, nigdzie**. Zakres zmienił się ze „scal" na „zrób od zera".

## 3. ROZWIĄZANIE

Przeanalizować brakujące pliki tą samą metodą co PRV-007 (7 stref vs kanon §7.3, dowód plik:linia) i dopisać do tego samego dokumentu.

## 4. KRYTERIUM ODBIORU

**Dokument, nie ekran.** Zamknięte, gdy sekcja „niezbadane" w `_ANALIZA_A2_INWENTARZ_PREVIEW.md` jest pusta albo zawiera wyłącznie pliki świadomie wyłączone z zakresu, z podanym powodem.

## 5. DOWODY

- Gałąź `claude/a2-inwentarz-preview`, commit `bf2f61feb6`. Pokrycie 15 → 25 plików (26 ekranów/tabów)
- Grupa 4 (MyWork): DecisionPreviewPanel, FocusView, InboxContent, MyProjects ×2 instancje
- Grupa 5 (Assessment/Reports): AssessmentHub ×3 taby, AssessmentTable, BlockTypesManager, TemplatesManager, OutputsAggregateTabContent, PresentationsTabContent, ReportsTabContent
- **Nowe ustalenie:** `DecisionPreviewPanel.tsx` — plik cytowany jako wzorzec w `StandardPreview.tsx:6` — ma ten sam defekt duplikatu „Open" co ekrany, które miał wzorować → zadanie PRV-003
- **Nowe ustalenie:** `OutputsAggregateTabContent.tsx` dostarcza pełny dowód dla PRV-002/PRV-003
- 3 pozytywne wzorce bez defektu: TemplatesManager, PresentationsTabContent, ReportsTabContent
- Weryfikacja przez `git show origin/demo:<ścieżka>` na 13 cytowanych plikach
- **Bez zrzutu ekranu — to analiza dokumentu, dowód = plik:linia**

## 6. DZIENNIK

**2026-07-21** — ❌ **Przesłanka zadania obalona:** „raporty cząstkowe wróciły osobno i trzeba je scalić". Nie istnieją. Zapisane, żeby nikt ich nie szukał ponownie.

**2026-07-21** — zmigrowane do rejestru ze źródła A2b.
