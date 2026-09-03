# CODEX DAY 294 — Czat: trzy defekty

## Werdykt

`PARTIAL / DWA TWIERDZENIA OBALONE / JEDEN STOP MERYTORYCZNY`.

- `CHAT-OWN-002`: trwałość rozmowy działa przez serwer, a nagłówek na 1440 px ma stałe 42 px. Nie zmieniono produktu.
- `CHAT-OWN-003`: gałęzie są podłączone i działają przez realny Gateway/PostgreSQL. UI pozostaje.
- `CHAT-OWN-015`: kontrakt nie jest wspólny dla całej aplikacji. Czat ma wspólny provider, lecz trzy miejsca Mojej Pracy tworzą własny `SpeechRecognition`. Brak licencji uniemożliwia bezpieczną zmianę.

## Baza i marker — wynik dosłowny

```text
58ef0771d7 Merge agent/chat-blad-dostawcy-20260903: bezpieczne komunikaty bledu dostawcy AI (...)
MARKER OK
```

```text
58ef0771d746124c42361d0a37c653790b7c4cfa
```

`git status --short | head -3` nie wypisał nic. Tip bazowy uciekł do `984d3658fd`; pracę wykonano zgodnie z instrukcją dokładnie z markera.

## R1 — pomiar PRZED

Uwagi właściciela:

- `CHAT-OWN-002`: „Proszę doprowadzić do tego, aby te wysokości były równe.”
- `CHAT-OWN-003`: „Proszę tylko zwrócić uwagę, czy jest to podłączone prawidłowo.”
- `CHAT-OWN-015`: „trzeba uwzględnić, że istnieją dwie formuły mówienia” oraz „Trzeba sprawdzić, czy jest podłączony i czy działa.”

Pomiar `git grep -n localStorage -- src/components/AIChat | wc -l` dał **76**, nie „kilkanaście”. Żadne trafienie nie jest magazynem wiadomości rozmowy. Kategorie: token auth/API; preferencje języka i geometrii; cache historii/ostatnich załączników; zakładki; canvas/provenance/artefakty; testy i komentarze. Wiadomości przechodzą przez `useConversationStore.addMessage` → `Api.addConversationMessage` → `POST /api/conversations/:id/messages`.

Nagłówek w pełnym runtime, light, 1440 px: 0 ms `42`, 500 ms `42`, 1500 ms `42`, 3000 ms `42`, po zimnym otwarciu zapisanej wiadomości `42` px. Kod rezerwuje `h-[42px]`; wariant poniżej 520 px ma świadome `h-auto/min-h-[42px]` i nie był kwalifikowany jako stałe 42 px.

Głos ma znacznie większy mianownik niż ok. 6 plików. Po odrzuceniu tekstów, konfiguracji i testów wykonawcze ścieżki to wspólny `src/hooks/useTeresaVoice.ts`/`src/contexts/TeresaVoiceContext.tsx`, Czat (`EnhancedChatInput`, `VoiceConversationOverlay`, `TeresaTTSPlayer`) oraz trzy niezależne wejścia Web Speech w Mojej Pracy (`VoiceToNode`, `AIChatInlinePanel`, `VoiceImageInput`).

## R2 — nagłówek

Nie wykonano zmiany: mierzona wysokość była już stała. Zmiana tylko po to, by powstał diff, naruszałaby zasadę „mierz zamiast zgadywać”.

## R3 — zapis rozmowy: realny łańcuch

Kanoniczny runtime: server 5266, client 5267, build/HEAD `58ef0771d746`, ready 200, pełne 886 migracji, `E2E_MODE=false`, `ENABLE_TEST_AUTH_BYPASS=false`, `DOTENV_DISABLED=1`.

```text
conversation_id=9ade32f8-4fb7-4105-aa45-2e15f82dcb96
create_http=201
message_http=201
owner_cold_http=200
foreign_http=404
owner_message_matches=1
9ade32f8-4fb7-4105-aa45-2e15f82dcb96|DAY294_COLD_PERSISTENCE_PROOF|day294-cold-proof-1
```

Nowa karta przeglądarki otworzyła deep link i pokazała dokładnie jedną wiadomość `DAY294_COLD_PERSISTENCE_PROOF`. To obala tezę, że rozmowa żyje tylko w `localStorage`.

## R4 — gałęzie

Marker zawiera produkcyjne POST/GET, tabelę `conversation_branches`, metody klienta i aktywny `BranchSelector` w `UnifiedChatPanel`.

```text
branch_id=55296152-d5f9-469c-92a9-f0c84a294063
branch_http=201
list_http=200
foreign_list_http=404
SQL: 55296152-d5f9-469c-92a9-f0c84a294063|9ade32f8-4fb7-4105-aa45-2e15f82dcb96|86571990-bf81-4d4a-b000-7adaa9599c67|Day294 verified branch
```

Zimny UI pokazał `Current branch: Main (1)` i `Day294 verified branch`. Pole `branches[].id` jest identyfikatorem rozmowy gałęzi; `branches[].conversationId` wskazuje rozmowę źródłową. Pierwotny automatyczny warunek porównujący te dwa pola był błędny (`listed_matches=0`), a bezpośredni payload i SQL rozstrzygnęły kontrakt.

## R5 — głos: STOP

### STOP — wspólny kontrakt głosu cross-app

Rodzaj: MERYTORYCZNY  
Powód: wymagane miejsca Mojej Pracy nie konsumują wspólnego kontraktu, a wydana instrukcja nie zawiera tabeli licencji, która miałaby zezwolić na ich zmianę.  
Licencja, którą sprawdziłem: dokument odwołuje się do „tabeli licencji” i §0.3, ale plik kończy się na 689 liniach i nie zawiera ani §0.3, ani tabeli. Zgodnie z tabelą działań zastępczych plik bez licencji jest tylko do odczytu.  
Dowód: `rg -n "SpeechRecognition|webkitSpeechRecognition"` pokazuje niezależne konstruktory w `EnhancedChatInput.tsx`, `VoiceToNode.tsx`, `AIChatInlinePanel.tsx`, `VoiceImageInput.tsx`; tylko `UnifiedChatPanel`/`VoiceConversationOverlay` konsumują `useTeresaVoiceContext`.  
Co dostarczyłem ZAMIAST zmiany: tabela miejsce × tryb, czerwony kontrakt jednego automatu stanów i brief migracji.  
Co zrobiłbym, gdyby zapadła decyzja X: dodałbym wspólny adapter dyktowania o stanach `unavailable | ready | recording | error`, przepiął trzy miejsca Mojej Pracy i zachował różne callbacki domenowe. Osobno pozostawiłbym Gemini Live conversation i TTS jako tryby tego samego facade, bez wymagania realnego audio w teście.  
Rekomendacja dla nadzorcy: wydać imienną licencję na `src/hooks/useTeresaVoice.ts`, nowy adapter/facade, trzy wskazane pliki Mojej Pracy i nowe testy kontraktu; promień rażenia: Czat, mapa myśli, notebook i tabela.  
Stan: NIE ZACOMMITOWANO kodu produktu.  
Czy kontynuowałem pozostałe pozycje: TAK — R2/R3/R4/R6 zmierzone.

## Testy i pułapki

Bazowy pakiet jednostkowy: 33 pełne nazwy, 33 PASS. Użyto `RUN_DB_TESTS=0 MOCK_DB=true` wyłącznie dla testów komponentów/store; nie jest to dowód DB. `react-i18next` i globalny fetch mogą być mockowane, dlatego twierdzenia o i18n/sieci nie opierają się na tym pakiecie. Dowód zapisu/izolacji wykonano przez pełny runtime, prawdziwe logowanie, Gateway i osobny `psql`, nie przez test z gołym `express()` ani `E2E_MODE`.

Pliki nazw: `/private/tmp/cx-day294-czat-trzy-artefakty/przed-nazwy.txt` oraz po końcowym przebiegu `po-nazwy.txt`. Każdy przebieg ma `--retry=0`.

## Z30

`BRAK ZMIENNYCH POCZTY`; tabela `settings` ma 0 wierszy `smtp%`; `Gateway.ts` nie montuje drenów. Runtime wystartował wyłącznie przez kanoniczny skrypt, z `DOTENV_DISABLED=1` i bez zabronionych kluczy w procesach.

„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.”

## Artefakty poza repo

- `/private/tmp/cx-day294-czat-trzy-artefakty/chat-przed-light.png`
- `/private/tmp/cx-day294-czat-trzy-artefakty/chat-zimny-odczyt-light.png`
- `/private/tmp/cx-day294-czat-trzy-artefakty/chat-zimny-odczyt-dark.png`
- `/private/tmp/cx-day294-czat-trzy-artefakty/chat-galaz-po-odczycie-light.png`
- logi migracji, fixture i runtime w tym samym katalogu.

## Korekty wobec instrukcji

1. §0.1 mówi, że weryfikacja wejściowa ma poprzedzać pracę, a Z20 mówi „pełne migracje, DOPIERO potem jakikolwiek pomiar”. Wybrano bezpiecznie: kontrola portów/dysku przed kontenerem, pełne migracje przed testami i zapisami produktu.
2. Dokument odwołuje się do §0.3 i tabeli licencji, których nie zawiera. Zastosowano bezpieczniejszą regułę: nieimiennie licencjonowane pliki tylko do odczytu.
3. §0.2b wymaga dowodów poczty „ZANIM cokolwiek zapisującego”, ale zapytanie do `settings` jest możliwe dopiero po migracjach. Dowody wykonano bezpośrednio po migracjach i przed zapisem fixture/HTTP; migracje nie uruchamiają serwera ani drenów.
4. Teza „kilkanaście” trafień `localStorage` jest błędna: wynik 76.
5. Teza „około 6” plików głosu jest błędna: surowy mianownik jest znacznie większy; wykonawcze ścieżki opisano w R1.
6. Teza o braku serwerowej mechaniki gałęzi jest błędna: realny Gateway, PostgreSQL i UI potwierdziły mechanikę.

## Zdania dla nadzorcy

- `CHAT-OWN-002`: `VERIFIED na markerze` dla 1440 px i trwałości — 42 px w pięciu punktach; zapis/cold read/foreign deny/SQL udowodnione.
- `CHAT-OWN-003`: `VERIFIED na markerze` — branch POST/GET/UI/SQL i izolacja tenantowa udowodnione; nie usuwać UI.
- `CHAT-OWN-015`: `PARTIAL / STOP MERYTORYCZNY` — Czat ma wspólny kontrakt, trzy wejścia Mojej Pracy nie; potrzebna imienna licencja na refaktor cross-app.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano realnego nagrania ani syntezy audio; Web Speech/Gemini Live wymagają uprawnień i dostawcy, a instrukcja wyłącza je z warunku dowodu.
- Nie zmierzono stałych 42 px poniżej breakpointu 520 px; kod jawnie dopuszcza wtedy wzrost dla zawijania kontrolek.
- Nie wykonano mutacji RED→GREEN, ponieważ R2/R3/R4 były już sprawne na markerze, a R5 nie miał licencji do modyfikacji.
