# Formuła treści: Wnioski i Inicjatywy — kanon jakości „McKinsey-grade" (SSOT)

> Jeden, klient-agnostyczny standard + procedura, wg której powstaje i jest akceptowana **każda** karta
> Wniosku (insightu) i Inicjatywy w Consultify — dla Apatora i każdego kolejnego klienta.
> Towarzyszy `docs/initiatives/INITIATIVE_FORMULA.md` (doktryna: MECE · charter+WBS · Kaplan–Norton ·
> baseline→target · falsyfikowalna teza). **Status: wersja 1.1, do zatwierdzenia przez CTO.**
>
> Dokument ma trzy części:
> **A. STANDARD** (co musi być — pełne wymogi 100%) ·
> **B. FORMUŁA** (jak to powstaje i jest akceptowane — procedura + walidatory + prompty) ·
> **C. WZORCE** (przykłady gold-standard + anty-wzorce).

---

# CZĘŚĆ A — STANDARD (Definition of Done, pełne wymogi 100%)

## A0. Zasady nadrzędne (obowiązują KAŻDĄ rubrykę)
1. **Język: polski** dla całej prozy widocznej dla użytkownika. Wyjątki: §A5.
2. **Answer-first (piramida Minto):** pierwsze zdanie niesie konkluzję, nie wstęp.
3. **Ugruntowanie (lineage):** każda teza ma dowód (H#, dokument, sesja, dane); brak dowodu → jawnie oznaczona jako hipoteza z limitem pewności.
4. **Konkret nad ogólnikiem:** liczby, role, procesy, nazwy zamiast frazesów.
5. **Kwantyfikacja z jawnymi założeniami** (§A7); brak danych → „do ustalenia" + gdzie/kiedy.
6. **Uczciwa niepewność:** spory/rozjazdy/braki są nazwane, nie wygładzone.
7. **MECE:** brak nakładania i luk — w karcie i w portfelu.

## A1. Reguła pustych rubryk
- **Wymagane (W)** — zawsze wypełnione.
- **Warunkowe (WAR) / Opcjonalne (OPC)** — mogą być puste, ale **każda pusta nosi jednozdaniowe uzasadnienie**: `— Pominięto: <powód>`.
- Zapis uzasadnienia: wniosek → `missing_data`; inicjatywa → sekcja `## Uzasadnienia pominięć` w `description`.
- **Zakaz wypełniaczy** (ogólnik/placeholder udający treść) = rubryka NIEZALICZONA.

## A2. WNIOSEK — per rubryka
| Rubryka | Status | Minimum ilościowe | Kryteria jakościowe (zaliczenie) | Pustka |
|---|---|---|---|---|
| Tytuł | W | ≤ 14 słów | action-title, niesie konkluzję | nigdy |
| Podsumowanie (executive_summary) | W | 3–5 zdań / 60–130 słów | answer-first + so-what + poziom pewności | nigdy |
| Motywy (themes) | W | min 3 (3–6); opis ≥3 zd./≥50 słów | action-title + ≥1 evidence_ref + strength; cross-role → perspective_labels | nigdy |
| Problemy (issues) | W | min 2 (2–5) | severity + ≥1 evidence_ref + „dlaczego ważne" | nigdy |
| Szanse (opportunities) | WAR | 2–4 jeśli są | impact + ≥1 evidence_ref; konkretna | „— Pominięto: …" |
| Sygnały (signals) | WAR | 1–4 jeśli są napięcia | ujmuje tension/gap/contradiction/emerging | „— Pominięto: …" |
| Mapa dowodów (evidence_map) | W (gdy są refy) | ≥1 na każdy ref (cel ≥4) | answer_snippet ≤120 zn. realny; linked_themes/issues | tylko gdy 0 dowodów (zła jakość materiału) |
| Braki danych (missing_data) | W | min 2 | konkretne dane/pytania; tu trafiają uzasadnienia pominięć | nigdy |
| Jakość materiału (material_quality) | W | KOMPLET podpól (§A6.2) | score uczciwy; ≥1 limitation/missing_voice/followup | nigdy |
| Rozjazdy (divergence) | WAR | gdy jest spór | divergence_note: kto-vs-kto i o co | bez sporu — brak adnotacji |
| Opis (content, md) | W | 350–700 słów | sekcje: Obserwacja → Mechanizm → Dowody → Wpływ → Rozjazdy → Rekomendacja | nigdy |

## A3. INICJATYWA — per rubryka
| Rubryka | Status | Minimum | Kryteria jakościowe | Pustka |
|---|---|---|---|---|
| Tytuł | W | ≤14 słów | action-title oddający zmianę | nigdy |
| Problem (problem_statement) | W | 120–250 słów | przyczyny ŹRÓDŁOWE, ugruntowane | nigdy |
| Teza (hypothesis) | W | 1–3 zdania | „Jeśli X, to Y(mierzalne) bo Z" | nigdy |
| Streszczenie (summary) | W | 40–90 słów | czym jest + jaki efekt | nigdy |
| Opis/business case (description) | W | 400–750 słów | 6 sekcji (§A3.1) | nigdy |
| Wartość (business_value) | W | 2–3 zdania | mapuje na value-driver + wartość | nigdy |
| Sizing + ROI (market_context) | W | rząd wielkości + ROI + założenia | kwota/%/dni + logika ROI; enabler → proxy | enabler: „— Sizing pośredni: …" |
| Rezultaty (deliverables) | W | min 4 | konkretne, rzeczownikowe | nigdy |
| Kryteria sukcesu (success_criteria) | W | min 4 | mierzalne/obserwowalne, spójne z KPI | nigdy |
| Zakres (scope_in) | W | min 3 | jednoznaczne | nigdy |
| Poza zakresem (scope_out) | W | min 3 | MECE, z odwołaniami do innych inicjatyw | nigdy |
| Kryteria zatrzymania (kill_criteria) | W | min 2 | konkretny warunek stop | nigdy |
| KPI | W | min 2, ≥1 primary | baseline→target + kierunek + jednostka; brak baseline → „do ustalenia" + powód | nigdy |
| Kamienie milowe (milestones) | W | min 3 | fazowane 0–3/3–6/6–12 + data + opis; **przed startem programu dozwolone daty relatywne** (np. „Tyg. 1–2 od startu") w nazwie/opisie zamiast `target_date` | nigdy |
| RAID | W | ≥2 RISK +≥1 ASSUMPTION +≥1 DEPENDENCY | probability+impact+mitigation_plan+response_strategy | nigdy |
| RACI | W | 1 A +1 R +≥1 C/I | realne role; jeden Accountable | nigdy |
| Lineage (source_type+source_id) | W | komplet | powiązanie ze źródłem lub `manual`+powód | nigdy |
| Metadane (value_driver, impact, effort, confidence, horyzont, budżet) | W | komplet | z dozwolonych zakresów, spójne z sizingiem | nigdy |
| Zależności (depends_on) | WAR | gdy istnieją | inicjatywy, bez których ta nie ma sensu | „— Pominięto: niezależna" |

**A3.1. Sekcje opisu inicjatywy:** `## Kontekst i uzasadnienie` · `## Co robimy` · `## Dlaczego teraz` · `## Wartość i sizing` · `## Jak zmierzymy sukces` · `## Ryzyka kluczowe` · `## Uzasadnienia pominięć` (jeśli dotyczy).

## A4. Bramka Definition of Done
Karta ZALICZONA, gdy ŁĄCZNIE: (1) 100% rubryk W spełnia minimum + jakość; (2) każda pusta WAR/OPC ma uzasadnienie; (3) ≥80% tez/motywów ugruntowane dowodem; (4) cała proza PL; (5) brak wypełniaczy. **Wskaźnik kompletności ≥ 90/100** — inaczej karta wraca z listą braków (§B4 scoring).

## A5. Słownik terminów nietłumaczonych
Akronimy/metodyki: SIPOC, FLOWCHART, RACI, RAID, KPI, SLA, OTIF, TTO, TTR, NPS, MECE, PMO, WBS, CAPEX, OPEX, ROI. Nazwy własne/produkty/segmenty: nazwa klienta, marki, SCADA, OSD, OSP, PSE itp. Tokeny systemowe (w bazie, nie jako proza): statusy, raci_type (R/A/C/I), direction, type RAID — w UI z polskimi etykietami. **Reszta — wyłącznie po polsku**, w tym `limitations`, `missing_voices`, `recommended_followups`.

## A6. Anty-wzorce (automatyczny FAIL)
1. Proza po angielsku poza słownikiem §A5.
2. Teza nie-falsyfikowalna („poprawimy efektywność") — brak „Jeśli…to…bo" z mierzalnym Y.
3. KPI bez baseline→target lub bez kierunku; cel bez jednostki.
4. „Cel −35%" bez podanego baseline ani adnotacji „do ustalenia".
5. RAID bez wymaganego miksu typów lub bez mitigation_plan.
6. scope_out bez rozgraniczenia MECE (brak odwołań do innych inicjatyw).
7. Pusta rubryka WAR/OPC bez `— Pominięto:`.
8. Twierdzenie bez dowodu podane jako fakt (zamiast hipoteza + limit pewności).
9. Sizing bez jawnych założeń („przyniesie miliony").
10. **A6.2 — material_quality NIEKOMPLETNY** (brak podpola, którego oczekuje renderer): MUSI zawierać komplet pól, jakich używa `InsightViewer` (m.in. score, posture, coverage, missing_voices[], limitations[], recommended_followups[] oraz pola pokrycia ról/działów, jeśli renderer ich używa). Niekompletny obiekt = ryzyko crashu UI → twardy FAIL. (Patrz: incydent 2026-06-09.)

## A7. Zasady kwantyfikacji i sizingu
- Każdy sizing podaje: **wielkość (zł/%/dni/szt.) + jawne założenie + horyzont**. Np. „założenie: 5–10% sprzedaży blokowane przez wąskie gardło → ~3–6,5 mln zł/rok; ROI ~5x".
- Brak danych do liczby → KPI/baseline oznaczone **„do ustalenia (N…)"** z procesem, który je ustanowi. Nigdy nie zmyślamy baseline.
- ROI jako krotność lub % z podaną logiką; enabler → wartość pośrednia + proxy (np. „% zrealizowanego portfela").

## A8. Zasady ugruntowania
- Każdy motyw/problem/teza wskazuje `evidence_ref` (H#, nazwa dokumentu, sesja).
- Cytat/parafraza w `evidence_map` ≤120 znaków, wierny źródłu.
- Brak fabrykacji: jeśli dane nie istnieją — `missing_data` + niższy `material_quality.score`, a nie wymyślona liczba.

---

# CZĘŚĆ B — FORMUŁA (procedura powtarzalna, każdy klient)

## B1. Pipeline (jeden bieg na kartę)
```
ŹRÓDŁO  →  GENERACJA  →  SAMOKONTROLA (walidatory B3)  →  RECENZJA PASS/FAIL (B4)
        →  POPRAWKI do ≥90/100  →  PUBLIKACJA + dowód renderu (zrzut)
```
Reguła: **żadna karta nie trafia do UI bez przejścia walidatorów B3 i recenzji B4.** Po publikacji — wizualne potwierdzenie renderu (reguła „verify before claiming").

## B2. Wejścia wymagane przed generacją
1. **Źródło/dowód:** wniosek źródłowy + evidence (H#/dokumenty/sesje) — lineage obowiązkowy.
2. **Kontekst organizacji:** branża, value-drivery, cele, ograniczenia, słownik terminów klienta (§A5 rozszerzony per klient).
3. **Siatka istniejących inicjatyw** (MECE-check): czy nowa karta nie nachodzi / czy domyka lukę.
Bez kompletu B2 → generacja się nie zaczyna (zabija karty-sieroty i nakładki).

## B3. Walidatory maszynowe (sprawdzalne automatycznie — „formuła" akceptacji)
Każda pozycja = warunek PASS/FAIL, możliwy do zakodowania (lint treści).

**Wspólne:** `lang_pl` (0 angielskich słów w prozie poza §A5) · `no_filler` (brak placeholderów) · `empty_fields_justified` (każda pusta WAR/OPC ma `— Pominięto:`).

**Wniosek:**
| Walidator | Warunek |
|---|---|
| `summary_len` | 60 ≤ słowa ≤ 130 i zdania ≥ 3 |
| `themes_count` | ≥ 3 |
| `theme_desc_len` | każdy motyw: słowa ≥ 50 |
| `theme_evidence` | każdy motyw: evidence_refs ≥ 1 |
| `issues_count` | ≥ 2; każdy ma severity + evidence_refs ≥ 1 |
| `evidence_map_cover` | ≥ 1 wpis na każdy użyty evidence_ref; snippet ≤ 120 zn. |
| `missing_data_count` | ≥ 2 |
| `material_quality_complete` | komplet podpól wg A6.2 (twardy) |
| `content_len` | 350 ≤ słowa ≤ 700 |
| `content_sections` | obecne nagłówki: Obserwacja, Mechanizm…, Dowody, Wpływ, Rekomendacja |

**Inicjatywa:**
| Walidator | Warunek |
|---|---|
| `problem_len` | 120 ≤ słowa ≤ 250 |
| `hypothesis_format` | pasuje do `/Jeśli .+ to .+ (bo|ponieważ) .+/i` |
| `description_len` | 400 ≤ słowa ≤ 750 |
| `description_sections` | 6 sekcji wg A3.1 |
| `sizing_present` | market_context zawiera liczbę + założenie + ROI |
| `deliverables_count` | ≥ 4 |
| `success_count` | ≥ 4 |
| `scope_in_count` / `scope_out_count` | ≥ 3 / ≥ 3 |
| `scope_out_mece` | ≥ 1 scope_out odwołuje się do innej inicjatywy |
| `kill_count` | ≥ 2 |
| `kpi_baseline_target` | KPI ≥ 2; ≥1 primary; każdy target≠null; baseline≠null LUB opis zawiera „do ustalenia" |
| `milestones_count` | ≥ 3, każdy z datą `target_date` LUB relatywnym oznaczeniem fazy w nazwie/opisie (Dni/Tyg./Mies. + liczba) — relatywne dozwolone tylko przed startem programu; po starcie kamienie dostają daty kalendarzowe |
| `raid_mix` | RISK ≥ 2 ∧ ASSUMPTION ≥ 1 ∧ DEPENDENCY ≥ 1; każdy ma probability+impact+mitigation_plan |
| `raci_min` | 1×A ∧ 1×R ∧ ≥1×(C∨I) |
| `lineage` | source_type+source_id (lub manual+powód) |

## B4. Recenzja PASS/FAIL + scoring
Po przejściu B3 — recenzja jakościowa (druga para oczu / agent-recenzent) wg A2/A3:
- Każda rubryka W: **2 pkt** (jakość) · WAR/OPC zaliczona lub uzasadniona: **1 pkt**.
- Dodatkowo: ugruntowanie ≥80% (**+}**), MECE OK (**+**), język PL (**+**), brak anty-wzorców A6 (**+**).
- **Skala 0–100; próg PASS ≥ 90.** Wynik recenzji: `PASS` / `FAIL + lista konkretnych braków`.
- Recenzent jest **adversarialny**: domyślnie szuka powodu do FAIL (ungrounded claim, vague KPI, filler, EN-proza), nie do PASS.

## B5. Reużywalny prompt GENERACYJNY (szablon, klient-agnostyczny)
```
Jesteś partnerem konsultingowym poziomu McKinsey. Tworzysz JEDNĄ kartę {{TYP: wniosek|inicjatywa}}
dla klienta {{KLIENT}} ({{KONTEKST_ORG}}). Standard: docs/standards/CARD_CONTENT_FORMULA.md.
Reguły bezwzględne: język POLSKI (poza słownikiem §A5); answer-first; ugruntowanie w dowodach
{{EVIDENCE: H#/dokumenty/sesje}}; konkret + kwantyfikacja z jawnymi założeniami; MECE wobec siatki
{{ISTNIEJĄCE_INICJATYWY}}; NIE zmyślaj danych (brak → „do ustalenia" + missing_data).
Wypełnij KAŻDĄ rubrykę do minimum i kryteriów z §A2/§A3. Rubryki świadomie puste → „— Pominięto: <powód>".
Inicjatywa: teza w formacie „Jeśli X, to Y(mierzalne) bo Z"; KPI baseline→target; RAID ≥2R+1A+1D;
material_quality KOMPLETNY (§A6.2). Zwróć WYŁĄCZNIE obiekt JSON wg kontraktu pól.
Na końcu sam przejdź walidatory §B3 i zaznacz, które przeszły.
```

## B6. Reużywalny prompt RECENZENCKI (szablon)
```
Jesteś adversarialnym recenzentem jakości wg docs/standards/CARD_CONTENT_FORMULA.md.
Oceń kartę {{KARTA_JSON}}. Najpierw uruchom walidatory §B3 (PASS/FAIL każdy). Potem oceń jakościowo
§A2/§A3 i policz wynik §B4 (0–100). Szukaj powodów do FAIL: EN-proza, teza nie-falsyfikowalna,
KPI bez baseline→target, RAID bez miksu, sizing bez założeń, filler, pusta rubryka bez uzasadnienia,
material_quality niekompletny. Zwróć: {score, verdict: PASS|FAIL, failedValidators[], qualityGaps[],
fixes[]}. PASS tylko gdy score ≥ 90 i 0 twardych FAIL.
```

## B7. Role i własność
- **Generator** (agent/konsultant) — tworzy kartę wg B5.
- **Recenzent** (drugi agent/osoba) — B6, adversarialnie; nie może być tym samym bytem co generator w tej samej turze.
- **Akceptujący** (PM/PMO/CTO) — zatwierdza PASS i publikację.
- **Dowód:** po publikacji — zrzut renderu karty (verify-before-claiming).

## B8. Wersjonowanie i rozszerzanie per klient
- Ten plik = SSOT. Zmiana progów/minimów = bump wersji + wpis w changelogu.
- Per klient dodaje się **tylko**: rozszerzenie słownika §A5 (marki/segmenty), zestaw value-driverów i cele strategiczne (do B2). Reszta standardu jest wspólna.

---

# CZĘŚĆ C — Wzorce

## C1. Anty-wzorce → poprawne (skrót)
| Źle | Dobrze |
|---|---|
| „Poprawimy obsługę klienta." | „Jeśli wdrożymy SLA i triage S/M/L, to mediana lead-time spadnie do ≤5 dni w 6 mies., bo każde zapytanie wejdzie w mierzony przepływ." |
| KPI: „OTIF: 90%" | KPI: „OTIF uruchomień: baseline do ustalenia (N4) → cel 90%, kierunek wzrost" |
| Ryzyko: „opór organizacji" | RAID RISK: „Opór wobec ESZ; prob. HIGH; impact HIGH; mitygacja: sponsor + szybkie wygrane; strategy MITIGATE" |
| scope_out: „inne tematy" | scope_out: „Triage i SLA → N12; narzędzie CRM → N5" |

## C2. Gold-standard
Wzorcową kartę (1 wniosek + 1 inicjatywa spełniające 100%) dołączymy po przebudowie treści Elkomtechu —
pierwsza karta, która przejdzie B3+B4 z wynikiem ≥90, staje się przykładem referencyjnym w tym dokumencie.

---

## Changelog
- **v1.1 (2026-06-10):** decyzja CTO — milestones mogą mieć daty relatywne (Dni/Tyg./Mies. od startu) zamiast `target_date`, dopóki program nie wystartował; po starcie wymagana konwersja na daty kalendarzowe (§A3 + walidator `milestones_count`).
- **v1.0 (2026-06-09):** pierwszy kanon — standard A + formuła B + wzorce C. Do zatwierdzenia przez CTO.
