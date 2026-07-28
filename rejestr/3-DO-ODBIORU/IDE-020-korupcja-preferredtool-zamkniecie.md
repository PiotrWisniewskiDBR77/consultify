---
id: IDE-020
tytul: Korupcja Ideas/preferredTool — ZAMKNIĘCIE incydentu (dane naprawione + test regresyjny)
typ: zadanie
waga: krytyczna
obszar: IDE
stan: do-odbioru
wlasciciel: piotr
blokuje: []
zablokowane_przez: []
zrodlo: "Piotr 2026-07-24: domknij temat KRYTYCZNEJ korupcji Ideas/preferredTool — które rekordy, czy naprawione, jaki test zabezpiecza"
utworzone: 2026-07-24
---

## 1. PROBLEM

Idea typu Tabela/Przepływ/Tablica otwarta **z listy** (URL bez sluga narzędzia) renderowała się jako mapa myśli, a autosave zapisywał wtedy `preferredTool:'mindmap'` — **nadpisując w bazie prawdziwy typ Idei**. Korupcja danych, nie tylko błąd widoku.

## 2. PRZYCZYNA

Regresja po naprawie P0-5. `src/components/MyWork/IdeaMapWorkspace.tsx`, `hydrate()` (~:1546): usunięto fallback na `mapRes.map.preferredTool` i nic nie dano w zamian. Łańcuch: `initialTool` (ze sluga) → `localStorage` per idea → **NIC** → zostawał domyślny `'mindmap'`. Autosave (~:591) zapisywał `preferredTool: activeTool`.
**Dlaczego testy tego nie złapały:** repro wchodziły URL-em ZE slugiem (`/workspace/process-flow`), co ustawia `initialTool` i maskuje błąd.

## 3. ROZWIĄZANIE

1. Kod: fallback przywrócony — commit `632bda738c` na origin/demo (`★ REGRESJA P0-5 (naprawiona 2026-07-24)`).
2. Dane: naprawa dotkniętego rekordu (kontrolowana, jeden UPDATE).
3. Test regresyjny pokrywający ścieżkę „otwarcie z listy bez sluga".

## 4. KRYTERIUM ODBIORU

Piotr przyjmuje, że: (a) uszkodzony rekord ma poprawny typ, (b) istnieje test, który REALNIE łapie tę regresję (dowód: failuje po cofnięciu poprawki).

## 5. DOWODY

**Stan danych (żywa baza demo `trolley`, tylko SELECT + jeden UPDATE):** `my_idea_maps` = 831 rekordów (mindmap 446, whiteboard 196, process_flow 112, table 72, NULL 5). Z 4 przykładów flagowanych w `_HANDOFF_IDEE_2026-07-24.md` — **3 były już poprawne** (w tym „Proces ofertowania" `b9f9ae19` → `process_flow`).

**Naprawiony 1 rekord** (mapa `cf0368a2-8a9f-4e3a-9c10-04e60d63b148`, idea `33e9e68d-845d-4667-82d9-47b7178f5d56` „Portfel inicjatyw AI — priorytetyzacja"), tryb kontrolowany zlecony przez Piotra:
- SELECT przed: `preferred_tool='mindmap'`, `extensions_json` zawiera strukturę tabeli (**18 kolumn**) → potwierdza typ Tabela;
- UPDATE z guardem `WHERE id=… AND preferred_tool='mindmap'` → **1 wiersz** (oczekiwane 1);
- SELECT po: `preferred_tool='table'` ✅;
- kontrola: dokładnie **1 rekord** zmieniony w ostatniej minucie — **żaden inny nie tknięty**.
- Poboczne (NIE naprawiane, poza zakresem): `538da25f…` „M09 Fresh AddNode" — mismatch z 20.06, sprzed incydentu, wygląda na rekord testowy.

**Test regresyjny:** `tests/components/MyWork/IdeaMapWorkspace.preferredTool-regression.test.tsx` — **na demo, SHA `69a743b206`** (merge do przodu, bez rebase/force; punkt cofania `12826509a2`; diff = wyłącznie plik testu, **zero zmian produkcyjnych**).
- Asercja A: Idea `preferredTool='table'`, URL **bez sluga**, **czysty localStorage** → renderuje `tool-table`, nigdy `tool-mindmap`.
- Asercja B: żadne `Api.syncMyIdeaMap` nie niesie `preferredTool:'mindmap'` (realny, niemockowany `queueSync`/`buildPayload`).
- **★ Dowód odwracalności:** po tymczasowym cofnięciu fallbacku w `hydrate()` → **obie asercje FAIL** (w DOM `tool-mindmap`; realny autosave odebrał skorumpowany payload `{preferredTool:'mindmap'}`); po przywróceniu → **PASS 2/2**. Test używa prawdziwego `hydrate()` i prawdziwego kanału autosave (mockowane tylko ciężkie silniki narzędzi).
- Master zweryfikował osobiście: **2/2 zielone** przed i po scaleniu na demo.

## 6. DZIENNIK

**2026-07-24** — incydent zbadany na zlecenie Piotra (temat z obszaru IDEE, spoza sesji Agent+Vault). Ustalono mechanizm, stan danych z żywej bazy, brak testu. Naprawiono 1 rekord w trybie kontrolowanym (SELECT→UPDATE→SELECT→kontrola), dodano test regresyjny z dowodem odwracalności i scalono na demo (`69a743b206`). **Incydent ZAMKNIĘTY.**
**★ Dług do rozważenia:** poprawka kodu (`632bda738c`) żyje na `origin/demo`, ale gałąź `oxford/oc2-merge` jej NIE MA — przy forward-porcie do Londynu/oxford trzeba ją przenieść, inaczej regresja wróci na tamtej linii.
