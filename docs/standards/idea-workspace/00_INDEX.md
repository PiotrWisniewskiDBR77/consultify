# Standard docelowy — Idea Workspace (2026-07-23)

Standard opisuje **stan docelowy** czterech reprezentacji jednej Idei: Mind Map · Whiteboard · Process Flow · Table. Nie jest opisem dzisiejszego kodu — tam, gdzie odnosi się do kodu, pisze wprost „dziś: … → docelowo: …". Jest kryterium odbioru, nie inspiracją.

## Jak czytać

Zacznij od rozdziału 01 (model i cztery zasady nadrzędne). Rozdział 02 to mechanizm, który te zasady egzekwuje maszynowo. Rozdziały 03–11 opisują kolejne powierzchnie ekranu. Rozdział 12 mówi, w jakiej kolejności to wdrażamy i kiedy praca jest skończona.

W razie sprzeczności między rozdziałami **wygrywa rozdział 01**.

| # | Rozdział | O czym |
|---|---|---|
| 01 | [Model i zasady](01_MODEL_I_ZASADY.md) | czym jest Idea, cztery zasady Z1–Z4, 10 zakresów akcji, co wspólne a co specyficzne |
| 02 | [Rejestr akcji](02_REJESTR_AKCJI.md) | `ActionRegistry` — jedna deklaracja akcji na cały system; jak wymusza Z1/Z3/Z4 |
| 03 | [Architektura ekranu](03_ARCHITEKTURA_EKRANU.md) | 8 warstw ekranu, co która może i czego nie może zawierać, stany akcji, tooltipy, stany puste |
| 04 | [Menu 1](04_MENU_1.md) | tożsamość Idei: breadcrumb, nazwa, etap, stany zapisu, konflikt, Teresa, Konwertuj, kebab |
| 05 | [Menu 3](05_MENU_3.md) | akcje aktualnej reprezentacji — układ per reprezentacja, „Więcej" |
| 06 | [Lewy rail](06_LEWY_RAIL.md) | narzędzia edycji; lista zakazów; data-rail Tabeli |
| 07 | [Prawy panel](07_PRAWY_PANEL.md) | wspólny kanon 5 zakładek (Przegląd·Właściwości·Powiązania·Komentarze·Historia) + język wizualny |
| 08 | [Menu kontekstowe](08_MENU_KONTEKSTOWE.md) | tło · element · krawędź · kontener; pasek zaznaczenia |
| 09 | [AI i Teresa](09_AI_I_TERESA.md) | model propozycji (podgląd → akceptuj/odrzuć → historia → cofnij); sterowanie rozmową |
| 10 | [Konwersja / Eksport / Import / Szablony](10_KONWERSJA_EKSPORT_IMPORT_SZABLONY.md) | Convert ≠ Export; historia konwersji; guard-raile importu |
| 11 | [Specyfikacje narzędzi](11_SPECYFIKACJE_NARZEDZI.md) | co każda z 4 reprezentacji ma własnego — i dlaczego |
| 12 | [Backlog i odbiór](12_BACKLOG_I_ODBIOR.md) | P0–P3, kolejność wdrożenia, twarde bramki odbioru |
| 13 | [Migracja nawigacji 2026-08-09](13_MIGRACJA_NAWIGACJI_2026-08-09.md) | decyzja właścicielska: lewy panel informacji, prawy rail narzędzi, globalna Teresa; program N0–N10 |

## Materiały pomocnicze (nie są standardem)

| Plik | Rola |
|---|---|
| [`_KONTRAKT_REDAKCYJNY.md`](_KONTRAKT_REDAKCYJNY.md) | słownik i zasady pisania; decyzje właściciela D1–D6 |
| [`_RDZEN_STANDARDU_4_ZASADY_2026-07-23.md`](_RDZEN_STANDARDU_4_ZASADY_2026-07-23.md) | pierwotny rdzeń — treść przeniesiona do 01 i 02 |
| [`_DECYZJE_I_KANON_WSPOLNY_2026-07-23.md`](_DECYZJE_I_KANON_WSPOLNY_2026-07-23.md) | uzgodnienie wspólnego kanonu panelu (D1) |
| [`_CROSSCHECK_OPENAI_VS_AUDYT_2026-07-23.md`](_CROSSCHECK_OPENAI_VS_AUDYT_2026-07-23.md) | zestawienie standardu zewnętrznego z audytem kodu |
| [`_DRAFT_STANDARD_STRUKTURA_2026-07-23.md`](_DRAFT_STANDARD_STRUKTURA_2026-07-23.md) | szkielet struktury z etapu draftu |

## Źródła

- **Audyt kompletności kodu:** [`docs/audits/idea-workspace-completeness-2026-07-23/`](../../audits/idea-workspace-completeness-2026-07-23/) — 11 plików, stan faktyczny akcji/menu/endpointów.
- **Standard zewnętrzny (OpenAI):** [`docs/idea-workspace-target-standard-2026-07-23/`](../../idea-workspace-target-standard-2026-07-23/) — 14 plików.
- **Powierzchnie zweryfikowane wzrokiem:** `Harvard/wdrozenie-100/_RAIL_LEWY_*`, `_KONTEKST_*`, `_MENU3_*`, `_PRAWY_PANEL_IDEE_*`.

## Oznaczenia w tekście

`⟦DO USTALENIA⟧` — punkt nierozstrzygnięty w żadnym ze źródeł. Zgodnie z kontraktem redakcyjnym (reguła 6) **nie zgadujemy**; taki punkt wymaga decyzji, zanim wejdzie do implementacji.

## Stan wdrożenia

Postęp i dowody prowadzi rozdział 12. Zrealizowane pozycje P0 są opisane w commitach na gałęzi `odbior/lokalny-2026-07-23`, a dowody wizualne leżą w `artifacts/idea-workspace-qa/`.
