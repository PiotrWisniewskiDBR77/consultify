# Ideas — nowy podział audytowy na 5 części (2026-06-11)

**Decyzja właścicielska (2026-06-11):** dotychczasowy Moduł 02 „Moja Praca" traktował Ideas jako jeden podpunkt. Od teraz **Ideas dzieli się na 5 osobnych pozycji audytowych — każda z własną kartą i własnym planem rozwoju**, bo każde z narzędzi jest samodzielnym, potężnym produktem:

| # | Pozycja | Karta | Wynik | Tier | Werdykt jednym zdaniem |
|---|---------|-------|:----:|------|------------------------|
| 02A | **Zarządzanie ideami** (lista, workspace-host, sync, konwersje, AI) | `MODULE_02A_ideas-zarzadzanie.md` | **68** | Beta (closed) | Realny CRUD + dojrzała persystencja, ale konflikt 409 kłamie (silent overwrite), snapshoty martwe (brak migracji), współpraca niemożliwa przez mapy per-user |
| 02B | **Mind Map** | `MODULE_02B_mind-map.md` | **72** | Beta+ | Rdzeń (canvas, persystencja, collab WS, 64 testy) realny; „AI overlays" to pseudo-AI fabrykujące semantykę klientem; brak align/snap klasy Miro |
| 02C | **Process Flow** | `MODULE_02C_process-flow.md` | **48** | Beta (UI) / Alpha (backend) | Bogaty edytor + realne AI, ale cała warstwa V8 (18 endpointów) martwa lub produkuje śmieci przez 3 defekty kontraktu; rysowanie połączeń myszą wyłączone w kodzie |
| 02D | **Table** | `MODULE_02D_table.md` | **60** | Beta+ | Solidny rdzeń (25 typów kolumn, 7 widoków, realne AI, 137 testów), ale ~40% UI uśpione za flagą OFF, a 4 widoczne funkcje zawsze kończą się błędem |
| 02E | **Whiteboard** | `MODULE_02E_whiteboard.md` | **58** | Beta | Kompletny single-player z AI; facilitation/multiplayer okablowany E2E, ale strukturalnie niemożliwy — dokument tablicy jest per-user |

**Średnia Ideas: ~61/100** (vs 57/100 dla całego Modułu 02 w audycie 2026-06-02 — realny postęp, ale rozkład nierówny).

## Relacja do podziału 19-modułowego (audyt 2026-06-02)

Moduł 02 „Moja Praca" pozostaje w podziale głównym dla powierzchni nie-Ideas (Home/Radar, Notebook, Tasks, Calendar, Inbox, Decisions, hub). Pozycje 02A–02E zastępują dotychczasową sekcję „Sub-tool breakdown" z `docs/audit/2026-06-02/MODULE_02_moja-praca.md`. Łączny podział systemu: **19 modułów + eksplozja Ideas na 5 pozycji = 23 karty audytowe**.

## Wątki wspólne dla wszystkich 5 części (do naprawy raz, systemowo)

1. **P0 — Model danych per-user (`my_idea_maps` unique index user+idea)** blokuje JAKĄKOLWIEK współpracę: facilitation, presence, follow-me, głosowanie zespołowe i realtime są dziś teatrem jednoosobowym. To pierwsza decyzja do podjęcia, bo warunkuje plany rozwoju wszystkich narzędzi (02A §4, 02E §4.1).
2. **P0 — Cykl konfliktu 409 kłamie**: toast „odświeżam" bez refresh + podbicie wersji → następny zapis po cichu nadpisuje dane serwera (02A §4). Pogarszane przez wielu równoległych writerów (każde narzędzie ma własną instancję `useIdeaMapSync` z własnym licznikiem wersji; tylko mindmap dostaje współdzielony runtime).
3. **P1 — Brak flusha przy odmontowaniu/przełączeniu narzędzia** + flush beforeunload bez `keepalive`/`sendBeacon` — okno utraty danych (02A, 02B, 02E).
4. **Beta zamknięta** (`MYWORK_IDEAS: 'closed'`, admini też wycięci) — plany rozwoju mogą iść agresywnie bez ryzyka regresji u klientów; gate jest tylko frontendowy (API dostępne mimo bety).
5. **Wzorzec „real call, fake feature"** — generyczny endpoint AI suggestions, z którego panele dorabiają semantykę po stronie klienta (sentyment po indeksie, klastry po substringach). Potrzebne dedykowane endpointy per funkcja.

## Kolejność rekomendowana (cross-tool)

1. **Fundament współdzielenia** (wątek 1+2+3 powyżej) — bez tego „Miro-grade" nie istnieje w żadnym narzędziu.
2. **Quick wins per narzędzie** — Process Flow: włączyć rysowanie połączeń (1 linia); Table: naprawić/ukryć 4 zepsute przyciski; Mind Map: naprawa korupcji codemodu „rose".
3. **Plany rozwoju per narzędzie** — sekcja „Plan rozwoju" w każdej karcie 02A–02E.
