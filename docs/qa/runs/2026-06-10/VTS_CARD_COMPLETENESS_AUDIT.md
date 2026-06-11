# Audyt kompletności kart VTS — wnioski (10) + inicjatywy (15)

**Data:** 2026-06-10 · **Standard:** `docs/standards/CARD_CONTENT_FORMULA.md` v1.1 (walidatory §B3 + reguły §A2/§A3/§A6)
**Aktualizacja 2026-06-10:** decyzja CTO — program nie wystartował, więc daty milestones pozostają **relatywne** (standard v1.1 + walidator zaktualizowane). Po ponownym biegu `milestones_count` = **0/15 FAIL** (poprzednio 15/15).
**Źródło danych:** PROD Railway (centerbeam), org `vts` — tabele `interview_insights`, `initiatives` + dzieci (`initiative_kpis`, `initiative_milestones`, `raid_items`, `initiative_stakeholders`, `initiative_dependencies`)
**Artefakty:** `vts-card-audit-validator.cjs` (kod walidatora), `vts-card-audit-raw.json` (pełne wyniki per karta per walidator)

## Werdykt

**NIE-GOTOWE do zatwierdzenia wg bramki §A4** — ale stan jest dobry merytorycznie: komplet 10 wniosków
i 15 inicjatyw istnieje, treść jest ugruntowana (evidence_refs, sizing z założeniami, „do ustalenia"
zamiast zmyślonych liczb), a braki są w większości **systemowe i tanie do naprawienia hurtem**.
Żadna karta nie przechodzi dziś §B3 w 100%; najlepsze inicjatywy (IN5, IN8, IN10, IN12, IN4) są
o 2–3 systemowe poprawki od PASS.

## Braki TWARDE (blokują DoD — do naprawy przed recenzją §B4)

| # | Brak | Zakres | Szczegół |
|---|---|---|---|
| 1 | `success_criteria = []` | **IN1, IN2, IN3** | Pusta rubryka W (min 4). Najpoważniejszy pojedynczy brak. |
| 2 | RAID bez probability/impact | **26 pozycji w 11 inicjatywach** | Miks typów (R≥2,A≥1,D≥1) wszędzie OK, mitigation_plan wszędzie jest. Braki to prob/impact: na RISK-ach realnie w **IN2 (1×), IN14 (2×)**; reszta to ASSUMPTION/DEPENDENCY/ISSUE (standard §A3 formalnie wymaga także tam). |
| 3 | KPI bez targetu / baseline | **IN1, IN2, IN6, IN10, IN14** | 5 KPI z `target=null`, 4 bez baseline i bez „do ustalenia" w opisie. Uwaga semantyczna: baseline=0 przy KPI typu „śr. czas obsługi → −30" (IN10) to ukryty brak baseline (anty-wzorzec §A6.4). |
| 4 | Encje HTML w polach | **IN1, IN2, IN3** | `&quot; &amp; &lt;` w problem_statement/listach. UI ma fallback `decodeHtmlEntities` na problem_statement, ale pozycje list (np. „R&amp;D", „&lt;10 przepływów") mogą renderować się surowo — dane do odkodowania u źródła. |

> ~~Milestones bez `target_date` (15/15)~~ — **ROZSTRZYGNIĘTE 2026-06-10**: program nie wystartował,
> daty relatywne („Tyg. 1–2", „+30 dni od startu") są dozwolone do startu programu (standard v1.1).
> Wszystkie 65 kamieni ma poprawne fazy relatywne — 0/15 FAIL. Po starcie programu: konwersja na daty kalendarzowe.

## Braki SYSTEMOWE (rozjazd generator ↔ standard — decyzja: poprawić karty czy standard)

| # | Rozjazd | Zakres | Szczegół |
|---|---|---|---|
| 6 | Sekcje `content` wniosków | **10/10** | Karty używają spójnego, ale innego zestawu: `Teza / Co widzimy / Dlaczego tak jest / Dowody / Implikacje dla zarządu / Kwantyfikacja i sizing / Rekomendowany ruch / Rozjazdy…`. Standard §A2 wymaga: `Obserwacja / Mechanizm / Dowody / Wpływ / Rozjazdy / Rekomendacja`. Mapowanie 1:1 istnieje — przemianować nagłówki hurtem ALBO zaktualizować §A2 (zestaw kart jest moim zdaniem lepszy). |
| 7 | `content` za długi | **10/10** (790–1146 słów) | Limit §A2: 350–700. Przekroczenie 13–64%. |
| 8 | `executive_summary` za długie | **8/10** (147–164 słów) | Limit: 60–130. |
| 9 | `description` inicjatyw za długie | **7/15** (775–1144 słów) | Limit: 400–750. Sekcje 6/6 wszędzie OK. |
| 10 | `depends_on` niezmaterializowane | **13/15** | Zależności SĄ w prozie (RAID DEPENDENCY, scope_out „→ IN7/IN13/IN14"), ale tabela `initiative_dependencies` pusta — graf zależności w UI będzie pusty. |

## Braki DROBNE

- **Tytuły > 14 słów:** I2 (16), I6 (16), I9 (17).
- **Snippety evidence_map > 120 znaków:** I3, I4, I5 — po 1 szt.
- **Summary inicjatyw nad limitem 90 słów:** IN7 (92), IN9 (98) — marginalne.
- **scope_out bez jawnego odwołania MECE:** IN11 (jedyna).

## Fałszywe alarmy walidatora (zweryfikowane ręcznie — NIE są brakami)

- `lang_pl` (I6, I10, IN15): trigger to „Human-in-the-Loop (HITL)" — termin metodyczny, do dopisania
  do słownika §A5 per-klient VTS (razem z: Voice of Market, Control Tower, Data Backbone, BOM, PLM, RCA, FDR).
- `sizing_present` (IN2, IN3, IN13): to poprawny **sizing pośredni enablera** z jawnymi założeniami
  i logiką EV — zgodny z wyjątkiem §A3 („— Sizing pośredni"); heurystyka szukała słowa „ROI".
- `material_quality`: wszystkie 10 wniosków ma komplet podpól (w tym role_coverage/department_coverage);
  kształt aliasowy `score/posture/coverage` jest normalizowany przez guard w InsightViewer (incydent 2026-06-09 odrobiony).

## Co działa dobrze (potwierdzone)

- Komplet ilościowy: 10 wniosków (status `completed`) + 15 inicjatyw (status `DRAFT` — spójne z „niezatwierdzone").
- Wszystkie wnioski: themes ≥3 z evidence_refs i opisami ≥50 słów, issues ≥2 z severity, missing_data ≥2,
  evidence_map pokrywa wszystkie użyte refy, opportunities/signals wypełnione.
- Wszystkie inicjatywy: hypothesis w formacie „Jeśli→to→bo" (falsyfikowalne), problem_statement
  w strukturze {symptom, rootCause, costOfInaction} 120–250 słów, deliverables ≥4, scope_in/out ≥3,
  kill_criteria ≥2, RACI komplet (1A+R+C/I), lineage 15/15 (`interview_insight` → vts_w2_I#),
  scope_out z odwołaniami MECE (14/15).
- Brak zmyślonych liczb — konsekwentne „do ustalenia" + proces pomiaru (zgodnie z §A7/§A8).

## Rekomendowana kolejność naprawy (1 przebieg hurtowy)

1. Dopisać success_criteria do IN1/IN2/IN3 (twardy brak W).
2. ~~Daty milestones~~ — ROZSTRZYGNIĘTE (relatywne do startu programu, standard v1.1).
3. Uzupełnić prob/impact w 26 pozycjach RAID (priorytet: RISKi IN2, IN14).
4. Domknąć 9 KPI (target/baseline lub „do ustalenia" w opisie).
5. Odkodować encje HTML w IN1/IN2/IN3.
6. Zmaterializować depends_on w `initiative_dependencies` (13/15).
7. Decyzja CTO (otwarta): limity długości + nazwy sekcji content (poprawka kart albo bump standardu do v1.2).
8. Rozszerzyć słownik §A5 o terminy VTS.
9. Po naprawach: ponowny bieg walidatora + recenzja §B4 + dowód renderu (verify-before-claiming).
