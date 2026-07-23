---
id: ART-016
tytul: Raport zgodności treści kart z formułą
typ: analiza
waga: wysoka
obszar: ART
stan: do-odbioru
wlasciciel: piotr
blokuje: [ART-015]
zablokowane_przez: []
zrodlo: "_RAPORT.md PEŁNY INWENTARZ / _REJESTR_ZYWY.md, 20-21.07"
stare_id: A6
utworzone: 2026-07-21
---

## 1. PROBLEM

Nie było wiadomo, ile kart w systemie spełnia formułę treści, a ile jest wypełnionych byle jak.

## 2. PRZYCZYNA

Nie dotyczy — analiza.

## 3. ROZWIĄZANIE

Uruchomić walidator na żywych danych i policzyć.

## 4. KRYTERIUM ODBIORU

**Dokument z liczbami, nie ekran.** Zamknięte, gdy zdecydujesz, co robimy z wynikiem — bo wynik jest zły i wymaga Twojej decyzji, nie tylko przyjęcia do wiadomości.

## 5. DOWODY

Realne uruchomienie `cardContentFormulaValidator.ts` (walidator z origin/demo, przez `tsx`) na **żywych kartach z bazy demo Railway**.

**Insight: 19/19 FAIL (0% przechodzi).** Próg PASS = score ≥ 90. Zakres wyników: 0-68.
Najczęstsze naruszenia: `title_is_thesis` 53× (tytuł-temat zamiast tezy) · `theme_desc_len` 40× · `opp_measurable` 31× (szansa bez liczby) · `signal_desc_len` 29× · `lang_pl` 17× (angielskie zdania w polu polskim).
5 najgorszych (score 0) to karty testowe/QA. **Ale nawet 6 kart „atelier--insight--*" (demo-showcase, mają wyglądać najlepiej) ma 12-68 — żadna nie przechodzi.**

**Initiative: 176/176 FAIL — z istotnym zastrzeżeniem metodologicznym.**
3 kody (`kpi_baseline_target`, `raid_mix`, `milestones_count`) wychodzą 100% FAIL, bo te dane żyją w osobnych tabelach (`initiative_kpis`, `initiative_milestones`), których zapytanie nie joinowało — **to fałszywy pozytyw zapytania, nie luka treści.**
Po odrzuceniu tych 3 kodów luka nadal jest duża: `hypothesis_present` 142/176 (81%) · `deliverables_count`/`success_count` 140/176 · `scope_out_mece` 139/176 · `roi_sizing` 129/176 · `owner_assigned` 120/176 · `problem_present` 114/176 · `lang_pl` 54/176.
5 najgorszych to auto-generowane karty SWOT („Defense: use strengths as a shield against threats" itd.) — **tytuły i treść po angielsku** mimo `lang_pl` w formule, zero scope/deliverables/kill criteria. Jeden generator, nigdy nie dopracowany do formuły.

## 6. DZIENNIK

**2026-07-21** — analiza wykonana na żywej bazie.

**2026-07-21** — ⚠️ **Sam autor oznaczył fałszywy pozytyw** w wynikach Initiative (3 kody liczone bez joinów). Zapisane, żeby nikt nie cytował „176/176" jako czystego wyniku.

**2026-07-21** — zmigrowane ze źródła A6. **Do rozstrzygnięcia przez Piotra: co robimy z 195 kartami poniżej progu** — poprawiamy, oznaczamy, czy obniżamy próg. Bez tej decyzji ART-015 (bramka) nie może ruszyć.
