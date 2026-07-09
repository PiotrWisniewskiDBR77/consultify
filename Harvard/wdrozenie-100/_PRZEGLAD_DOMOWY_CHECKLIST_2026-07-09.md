# PRZEGLĄD DOMOWY — checklist (wklej sobie, klikaj po kolei)

> demo.consultify.ai · zaloguj się normalnie · Ctrl/Cmd+Shift+R jeśli coś nie odświeżone.
> Dla każdego ekranu: obejrzyj dark+light, powiedz „promuj / popraw X / cofnij".

## CZĘŚĆ A — domyślnie WIDOCZNE (bez linków, po prostu wejdź)

| # | Ekran | Co sprawdzić | Kontekst |
|---|-------|--------------|----------|
| 1 | **Initiative** (dowolna) | Primary CTA w nagłówku (przejście stanu) — czy działa, czy nie zawija się | A3, wpięte do NModeHeader |
| 2 | **Mind Map** | Prawy panel bez ściśnięcia; otwórz Insight/Decision z linku (jeśli są powiązane) i sprawdź że kafelki statystyk się nie ściskają | A2 fix + A1 polish |
| 3 | **Insight** (Interview → dowolny) | Prawy panel (Akcje/Właściwości/Powiązania/Komentarze/Historia), primary CTA | A1 |
| 4 | **Decision** (My Work → Decisions) | Prawy panel, primary „Zatwierdź", nagłówek się nie przelewa | A1 |
| 5 | **Idea Table** (My Work → Ideas → Table) | **Prawy klik na wierszu** → menu Edytuj/Dodaj notatkę/Powiel/Usuń — nowa funkcja, sprawdź czy działa i czy „Powiel wiersz" faktycznie klonuje | quick-wins |
| 6 | **Deck** (Materiały → Prezentacje → dowolny) | Nagłówek: status „Saving/Saved" + pill draft/generated widoczne (nie schowane w Historii) | quick-wins |
| 7 | **Deck → prawy klik na slajdzie w nawigatorze** | Nowa pozycja „Przenieś ▸" (na górę/dół/pozycja) | quick-wins |
| 8 | **Prezentacje** (Materiały → Prezentacje, ekran generatora) | **CAŁA NOWA POWŁOKA** (ExecutiveModuleShell) — Export PPTX jako primary, nawigator slajdów z lewej, activity po prawej. To była praca równoległej sesji nocnej — obejrzyj krytycznie, może być surowe | flaga flip ON dziś |
| 9 | **Tabele** (Materiały → Tabele) | **CAŁA NOWA POWŁOKA** (ExecutiveModuleShell) — jak wyżej | flaga flip ON dziś |

## CZĘŚĆ B — ZA FLAGĄ (dopisz do URL, Enter, obejrzyj — NIE promowane, świadomie ostrożnie)

| # | Ekran | URL-dopisek | Dlaczego wciąż OFF |
|---|-------|-------------|---------------------|
| 10 | **Mind Map — nowa powłoka canvas** | `?ff_melsCanvas=1` | Rdzeń Ideas (ocena 90+) — nie chciałem ryzykować regresji bez Twojego oka |
| 11 | **Mind Map — skonsolidowany panel** | `?ff_melsMindmapPanel=1` | jw. — jeden ArtifactRightPanel zamiast 3 legacy paneli |

**Werdykt per ekran 10-11 decyduje: zostać na legacy, czy flip domyślnie ON.**

## CZĘŚĆ C — wyrównanie kontraktu (w toku, wynik dojdzie do checklisty / dashboardu)
Deck: zbiorczy panel „Powiązania". Word: link do rodzica w Powiązaniach. Notatnik: audit AI w zaznaczeniu. Status w `_STATUS_3_FILARY.html` po scaleniu.

## CZĘŚĆ D — NIE dotykane w tej fali (świadomie)
- Kolorystyka/crimson-sweep — osobny etap na koniec (Twoja decyzja 07-08).
- Landing — osobny etap (Twój werdykt 07-09: prod delikatniejszy).
- Excel-grid — decyzja D-EXCEL: Idea Table = powłoka, nie budujemy.
- Silnik B2 (Teresa→WorkbookGeneratorService) — osobny tor, nie powłoka.

## Jak wydawać werdykt (żeby było szybkie)
Dla każdego numeru: **✅ promuj** (zostaje jak jest) / **✏️ popraw: <co>** / **⏸ cofnij flagę** (wracamy do legacy). Wklej mi to jako listę numer→werdykt, ja rozdzielę na zadania dla robotników.
