# Postęp domykania audytu — fale

Źródło prawdy dla pętli „domknij wszystko z audytu". Aktualizowane po każdej fali.
Gałąź `odbior/lokalny-2026-07-23`. Nic nie idzie na demo.

## Legenda
✅ zamknięte i zweryfikowane w runtime · 🔄 w toku · ⏳ czeka · 🔒 zablokowane (decyzja/skala) · ⬜ nietknięte

## P0 — integralność danych
| ID | Stan | Nota |
|---|---|---|
| P0-1 | ✅ | historia konwersji, migracja na staging, sprawdzona API |
| P0-2 | ✅ | guard import, flaga ON |
| P0-3 | ✅ | jedna baza, brak duplikacji |
| P0-4 | ✅ | prawy panel przełącza treść |
| P0-5 | ✅ | stan widoku lokalny |

## P1 — martwe kliknięcia i zakres
| ID | Stan | Nota |
|---|---|---|
| P1-1 | ✅ | martwe kliki powłoki |
| P1-2 | ✅ | „Utwórz z mapy" usunięte (Menu 3 z rejestru) |
| P1-3 | ✅ | martwe eventy add-edge/link-artifact |
| P1-4 | ✅ | Przepływ: Wklej/Delete-krawędź/Wstaw-między |
| P1-5 | ✅ | AI Generators WB wołają model |
| P1-6 | ✅ (flaga OFF) | Table: autofill/odświeżanie nadpisują bez podglądu → model propozycji |
| P1-7 | ✅ | Raport/Prezentacja z Eksportu → Konwersja |
| P1-8 | ✅ | rail nie zasłania pasków |

## P2 — powłoka i panel
| ID | Stan | Nota |
|---|---|---|
| P2-1 | ✅ (stan konfliktu jawny; readonly=backend) | Menu 1 wg rozdz. 04 (stany zapisu + standard konfliktu) |
| P2-2 | ✅ | Menu 3 renderuje się z rejestru |
| P2-3 | ✅ (flaga OFF; K2 minimapa-ikona otwarte) | przełącznik reprezentacji → prawy dolny róg (D2); minimapa ikoną |
| P2-4 | ✅ (flaga OFF; Z2 karty) | prawy panel: 5 zakładek wg rozdz. 07 + język wizualny (Z2 „wsiowo") |
| P2-5 | ✅ (część; Table data-rail flaga OFF; rail-mode WB/PF otwarte) |
| P2-6 | ✅ | WB+MM+PF menu krawędzi, menu komórki Tabeli |

## P3 — dług i sprzątanie
| ID | Stan | Nota |
|---|---|---|
| P3-1 | ✅ (part; kpi-typy zostawione świadomie) | martwy kod bez UI (tbl_autofill/refresh/link, wb_group/distribute, IdeaCanvasDiscovery, handleGenerateCanvasAI, typy kpi_*) |
| P3-2 | ✅ (part; export-csv/facylitacja mają testy — decyzja) | martwe endpointy (cluster/outcome, v8/mindmap/*, develop SSE, export-csv, facylitacja end/outcomes) |
| P3-3 | ✅ | useIdeasToolContextMenu — martwy mechanizm menu |
| P3-4 | 🔒 | Table legacy → P15 + migracja danych — osobny projekt (D5), duża migracja |
| P3-5 | 🔒 | 7 kart N na kanon panelu (D1) — „jedną partią PO zamknięciu Idei" (jawnie odroczone) |
| P3-6 | ⬜ | persystencja Whiteboardu na wspólny silnik; 3 kanały realtime |
| P3-7 | ✅ | braki tłumaczeń (collaboration.*, „Lane N", diakrytyki) |
| P3-8 | ✅ (fantom usunięty; reszta=rekomendacje) |

## Zasada
Przy blokadzie NIE deklaruję sukcesu — zapisuję przyczynę i decyzję człowieka potrzebną do odblokowania (doc 12).
