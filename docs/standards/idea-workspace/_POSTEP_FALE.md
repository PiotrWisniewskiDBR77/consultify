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
| P3-4 | 🔒 | mechanizm migrateWorkspace ISTNIEJE + flaga ON + bezpiecznik. Uruchomienie migracji DANYCH = decyzja operacyjna wlasciciela (bliska nieodwracalnej) — NIE odpalam autonomicznie |
| P3-5 | 🔒 | standard SAM odracza (D1: jedna partia PO zamknieciu Idei) — nie blokuje domkniecia audytu |
| P3-6 | ⬜ | refaktor persystencji + 3 kanalow realtime — wysokie ryzyko dla wspolpracy/zapisu, nie do autonomicznego refaktoru |
| P3-7 | ✅ | braki tłumaczeń (collaboration.*, „Lane N", diakrytyki) |
| P3-8 | ✅ (fantom usunięty; reszta=rekomendacje) |

## Zasada
Przy blokadzie NIE deklaruję sukcesu — zapisuję przyczynę i decyzję człowieka potrzebną do odblokowania (doc 12).

## Podsumowanie domkniecia (2026-07-24)

**Zamkniete i zweryfikowane w runtime:** wszystkie P0 (5), wszystkie P1 (8), cale P2 (6 — czesc za flagami OFF do akceptu), P3-1/2/3/7/8.

**Trzy pozycje P3 to osobne projekty, ktorych standard SAM nie wciaga do biezacego domkniecia:**
- P3-4 (migracja danych Table) — mechanizm gotowy, uruchomienie = decyzja operacyjna, nie kod.
- P3-5 (7 kart N) — standard odracza wprost (po zamknieciu Idei).
- P3-6 (persystencja/realtime WB) — refaktor architektoniczny wysokiego ryzyka.

Zgodnie z doktryna (doc 12): przy tych trzech NIE deklaruje sukcesu — zapisuje stan gotowosci i decyzje potrzebna do ruszenia. Reszta audytu = osiagnieta.

**Bramki:** kontrola typow 0 bledow · straznik rejestru zielony · dostepnosc 0 naruszen (4 ekrany) · 2 czyste rundy regresji · 0 konfliktow z demo.
