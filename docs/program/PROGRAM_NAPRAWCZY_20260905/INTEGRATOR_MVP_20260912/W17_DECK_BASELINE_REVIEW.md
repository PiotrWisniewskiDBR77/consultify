# W17 Deck baseline review — 2026-09-12

**Klasyfikacja: rzeczywista regresja integracji komponentu, nie wyłącznie artefakt fixture.** Dowód jest component-level (jsdom + mocked transport), nie real API/JWT/PG/browser. Root uruchomił testy; recenzent tylko odczytał źródła, diff i logi, bez edycji produktu ani wykonania testów/DB.

## Wynik i wiarygodność testu

`W17_DECK_REOPEN_ISOLATED.log`: jedna izolowana próba reopen FAIL, rzeczywisty efekt DeckBuilder wysłał1PUT `/autosave` z X-Deck-Version7, bez user-edit. Fake server zwiększa swój licznik7→8; to nie zmierzony zapis PostgreSQL. `W17_DECK_CURRENT_BRIDGE.log`:5/5FAIL, zakończone10.95s. Restore i edit-after-restore zatrzymują się na nadmiarowymPUT; agent accept także; in-flight undo wykazuje2PUT zanim pierwszy zakończył się (expected1).

Diff testu jest poprawną adaptacją wejścia: initReactI18next mock usuwa import-time brak zależności; setChatModuleIntent przechwytuje handler rejestrowany przez realny DeckBuilder1303–1316 i wywołuje go w act. Usunięty teresa-prompt należał do wycofanego osadzonego panelu. Test nie powinien przywracać starego UnifiedChatPanel. Reopen nie wywołuje żadnego handleraAI, więc jego izolowanyFAIL nie wynika z nowego mostu. Asercji0PUT/versionunchanged nie poluzowano; dodatkowyJSON komunikatu ujawnia payload.

Renderowane są prawdziwe DeckBuilder/useDeckState/useVersionHistory. Leaf mocks nie wywołują edycji przy montowaniu. Routing ma stały deckId, loader dostaje prawidłowe dla swojej implementacji opakowanie data.data i deck_json z cards. HasLoadedInitial oraz autosave nie są mockowane. Testowy komentarz, że używa real useDeckAutosave, jest **nieaktualny**: aktualny builder nie wywołuje tego hooka. To właśnie istotny rozjazd integracyjny, nie podstawa unieważnienia testu.

## Przyczyna w aktualnym produkcie

1. `DeckBuilder.tsx:684–836`: loader ustawia deck z kanonicznego GET (także unified fallback/empty shell), po czym hasLoadedInitialRef=true. Nie ustanawia baseline pisarza.
2. `DeckBuilder.tsx:838–937`: wbudowany autosave effect po każdym niepustym deckForAutosave, loaded i braku conflict uzbraja800msPUT. Nie ma porównania z persisted payload, markPersisted ani blokady jednego requestu in flight. Stąd sam odczyt jest traktowany jako edycja. Dodanie source_refs/updated_at podczas normalizacji nie usprawiedliwia zapisu przy read-only reopen; effect wysłałbyPUT także dla już kompletnego decka.
3. `DeckBuilder.tsx:1138–1153`: handleRestoreVersion ignoruje `restored.source` i tylko setDeck. `useVersionHistory.ts:310–393` poprawnie odróżnia server/session, po serverrestore aktualizuje token z canonicalGET i własną baseline. Ten stan hooka nie blokuje oddzielnego wbudowanego pisarza; dlatego dodatkowyPUT po restore.
4. `DeckBuilder.tsx:1155–1175`: agent accept ustawia persisted deck, ale nie przejmuje payload.version i nie oznacza payloadu jako persisted dla pisarza. Następny autosave może użyć pre-acceptCAS. Obecny test kończy się już na0PUTFAIL, więc staleCAS poaccept jest SOURCE_FINDING, nie osobno zakończony runtimeFAIL.
5. `useVersionHistory.ts:412–452` ma markSaved i baseline/unsaved tracking, lecz builder nie pobiera markSaved. Podłączenie noteSaveStarted/Success/Failed (builder504–520) naprawia wskaźnik zapisu, ale nie zapobiega samemu niepotrzebnemu write.
6. Istniejący `useDeckAutosave.ts:~130–330` ma markPersisted, persisted/inflight payload, baseline epoch, serializację write, kolejkę aktualnego stanu po zakończeniu i pause na409. Nie jest używany przez DeckBuilder. Komentarz builder509+ jawnie dokumentuje ten odłączony hook. Nie potrzeba nowego ekranu ani nowego mechanizmu zapisu.

Backendsource potwierdza praktyczną wagę0PUT: `server/src/routes/presentations.routes.ts:4110–4180` udany autosave dodaje snapshot, zwiększa version i updated_at, wykonuje CAS. Nie ma no-op compare deck_json. Fixture bezwarunkowo zwraca200 nie odtwarza pełnej autoryzacji/CAS, ale nie tworzy samego żądania — żądanie powstaje w komponencie. Realny poziom ryzyka: możliwy niepotrzebny bump historii/czasu, a przy staleCAS409; rzeczywisty efektDB pozostaje do odbioru przyszłego fixu.

## Minimalny packet przyszłego fixu

- Jeden istniejący writer: przywrócić właściwe użycie useDeckAutosave albo równoważnie wykorzystać jego kontrakt; usunąć duplikację wbudowanego effectu, nie uruchamiać obu. Utrzymać callbacks do useVersionHistory, jawne409/non2xx/network error i współdzielony versionRef.
- Każda adopcja kanonicznego stanu (loader wszystkich gałęzi, persisted restore, agentaccept, conflict Reloadlatest) ustanawia identyczną baseline dla pisarza i historii przed setDeck. Session snapshot pozostaje prawdziwą lokalną zmianą do autosave; nie zamienić tego w globalny skip-next-render.
- Accept bierze kanoniczny version; queued edits/undo podczas write zachowane, bez2równoległychPUT i bez nadpisania nowej baseline przez staryACK. Nie odtwarzać osadzonego czatu.
- Zachować5asercji i poprawny aktualny chatbridge. RED→GREEN component wraz z istniejącymi useDeckAutosave/useVersionHistory tests. Warto dołożyć kontrolę no-op rerender oraz sessionrestore i conflictReload, jeśli nie są już pokryte hookiem.
- Lokalny real API/JWT/PG/browser: jeden deck, przed/po GET/reopen porównaćversion/updated_at/deck_json/liczbęhistorii;0PUT. Następnie serverrestore→canonicalreadback→0dodatkowychPUT→jednaedycja→1PUT z nowymCAS; agentaccept analogicznie. Inflightedit→undo z jawnie kontrolowaną odpowiedzią: brak równoległego writer i końcowy serwer zgodny z UI. Żadne lokalne wyniki nie upoważniają live.

Raport jest klasyfikacją baseline do planu W17. Nie wskazuje, który historyczny commit wprowadził regresję (nie wykonano bisect), nie dowodzi całego modułu i nie stanowi final ACCEPT.
