# Owner review — 12_AUDITS i 13_CHAT — 2026-08-29

## Wynik najpierw

**PARTIAL / NOT READY FOR OWNER.** Mechanika G09 została potwierdzona na markerze `f5c0a53d2d`, przez realny Gateway, podpisany JWT i lokalny PostgreSQL. Materiał wizualny nie spełnia jednak nienaruszalnego warunku kompletności: nie ma dla każdego ekranu obu motywów i obu stanów, a część obrazów zawiera angielską treść lub przycięcia. Takie obrazy są materiałem diagnostycznym, nie zaakceptowanym pakietem G08/G10.

Zakres: wyłącznie lokalny worktree `/private/tmp/consultify-review-audits-chat`, lokalny PostgreSQL `cx-review-pg:5949`; bez Railway, stagingu, demo i produkcji. Kod produkcyjny i migracje pozostały bez zmian.

## Faza 3 — lista dla właściciela

Przejrzano wzrokowo 24 zachowane obrazy PNG jednym ciągiem (17 AUDITS, 7 CHAT; diagnostyczny duplikat `library-full-light.png` pominięto).

| Kontrola | Wynik | Obrazy / obserwacja |
|---|---:|---|
| Angielska treść | 24/24 | AUDITS ma m.in. `Audits`, angielskie nazwy danych i zawartość podglądu; CHAT ma m.in. `AI Chat`, `Approve`, `Reject`, `Open capability`, angielskie dane i treści. |
| Ucięty tekst lub nachodzące elementy | 7/24 | `sesje-full-{light,dark}`: surowy identyfikator i overflow chipów; `raporty-full-{light,dark}`: skrócone audience; `library-preview-{light,dark}` i `program-card-dark`: panel/kafel ucięty przy prawej krawędzi. |
| Pusty stan wygląda jak awaria | 0/4 pustych stanów | `wyniki` komunikuje brak Outputów; pusta rozmowa i pusty feed sygnałów wyjaśniają stan. Feed sygnałów pozostaje świadomą decyzją produktową, nie nowym defektem. |

## 12_AUDITS — G07, G08/G10, G09

- G07: **PASS** — polska karta przeglądu: `modules/12_AUDITS/G07_KARTA_PRZEGLADU.md`.
- G08/G10: **PARTIAL** — zebrano realne stany i oba motywy dla wielu powierzchni, lecz brak pełnej macierzy ekran × pusty/pełny × jasny/ciemny; wadliwe obrazy nie są dowodem odbioru.
- G09: **PASS** — 3 pliki / 10 testów, `--retry=0`, `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false`; realny Gateway/JWT/PG. Potwierdzono pionową ścieżkę Library → Session → Output → Report → Initiative, cold reopen oraz report chain/export.

### Materiał wizualny AUDITS

Wszystkie ścieżki są poza repo, w `/private/tmp/consultify-review-audits-chat-artefakty/12_AUDITS/`.

| Ekran / stan | Motyw | Plik | SHA-256 | Ocena |
|---|---|---|---|---|
| Biblioteka pełna | ciemny / jasny | `biblioteka-full-dark.png` / `biblioteka-full-light.png` | `b6f508ef49ae…` / `18e6e2fd4c0e…` | diagnostyczny: EN |
| Inicjatywy pełne | ciemny / jasny | `inicjatywy-full-dark.png` / `inicjatywy-full-light.png` | `522b5806c11b…` / `dc61fffb7774…` | diagnostyczny: EN |
| Kebab biblioteki | ciemny / jasny | `library-kebab-dark.png` / `library-kebab-light.png` | `5cf1179b8dec…` / `9385441d471d…` | diagnostyczny: EN |
| Podgląd biblioteki | ciemny / jasny | `library-preview-dark.png` / `library-preview-light.png` | `512ee5cea00e…` / `5de452dacf48…` | defekt: EN i przycięcie |
| Karta programu | ciemny | `program-card-dark.png` | `b11aa2219d03…` | defekt: brak jasnego, EN, przycięcie |
| Raporty pełne | ciemny / jasny | `raporty-full-dark.png` / `raporty-full-light.png` | `0d359f490ab3…` / `b401a372b5b5…` | defekt: EN i skrócenie |
| Sesje pełne | ciemny / jasny | `sesje-full-dark.png` / `sesje-full-light.png` | `e46504eda49d…` / `5d9a418a97a5…` | defekt: EN, surowe ID, overflow |
| Ustalenia pełne | ciemny / jasny | `ustalenia-full-dark.png` / `ustalenia-full-light.png` | `77ce338f8af8…` / `af5e583ee210…` | diagnostyczny: EN |
| Wyniki puste | ciemny / jasny | `wyniki-full-dark.png` / `wyniki-full-light.png` | `52da00488664…` / `4426b94ceeff…` | diagnostyczny: EN; empty czytelny |

### Przejście G09 AUDITS

| Krok | Operacja użytkownika / HTTP | Wynik HTTP | Co widzi użytkownik | Niezależny SELECT |
|---|---|---:|---|---|
| 1 | Otworzenie paczki i uruchomienie sesji | 2xx | paczka oraz aktywna sesja | rekord paczki i sesji istnieje w lokalnym PG |
| 2 | Zapis dowodu, ustalenia i akcji | 2xx | elementy robocze sesji | rekordy evidence/finding/action istnieją i są związane z sesją |
| 3 | Utworzenie Outputu i raportu | 2xx | Output i raport z łańcuchem źródeł | rekord output/report ma poprawne powiązania |
| 4 | Utworzenie propozycji inicjatywy | 2xx | propozycja inicjatywy | proposal istnieje i wskazuje raport |
| 5 | Ponowne otwarcie i eksport raportu | 200 | zachowany stan i eksport | te same identyfikatory po cold reopen |

Pełny zapis testów i kontraktów znajduje się w `modules/12_AUDITS/MODULE_ACCEPTANCE.md`; manifest fixture: `/private/tmp/consultify-review-audits-chat-artefakty/12_AUDITS/fixture-manifest.json`.

## 13_CHAT — G07, G08/G10, G09

- G07: **PASS** — polska karta przeglądu: `modules/13_CHAT/G07_KARTA_PRZEGLADU.md`.
- G08/G10: **PARTIAL** — realna rozmowa pełna/pusta i feed sygnałów w obu motywach, ale brak pełnej macierzy wszystkich powierzchni oraz kebaba w ciemnym motywie; obrazy zawierają EN.
- G09: **PASS** — realny backend na `:4001`, podpisany JWT, lokalny PG. Odczyt rozmowy, listy propozycji i szczegółu propozycji zwrócił `200`.

### Materiał wizualny CHAT

Wszystkie ścieżki są poza repo, w `/private/tmp/consultify-review-audits-chat-artefakty/13_CHAT/`.

| Ekran / stan | Motyw | Plik | SHA-256 | Ocena |
|---|---|---|---|---|
| Rozmowa pusta | ciemny / jasny | `conversation-empty-dark.png` / `conversation-empty-light.png` | `d48957a3ce22…` / `f28f48c167fa…` | diagnostyczny: EN; empty czytelny |
| Rozmowa pełna | ciemny / jasny | `conversation-full-dark.png` / `conversation-full-light.png` | `1cea47dbe4aa…` / `6c54a7003a19…` | diagnostyczny: EN |
| Kebab rozmowy | jasny | `conversation-kebab-light.png` | `f89e9d1d7bb3…` | defekt kompletności: brak dark; EN |
| Feed sygnałów pusty | ciemny / jasny | `signals-empty-dark.png` / `signals-empty-light.png` | `28ed76c80c57…` / `c18b339618be…` | diagnostyczny: EN; empty czytelny |

### Przejście G09 CHAT

| Krok | HTTP | Kod | Co widzi użytkownik | Niezależny SELECT |
|---|---|---:|---|---|
| 1 | `GET /api/conversations/13000000-0000-4000-8000-000000000001` | 200 | rozmowa z jedną wiadomością | conversation istnieje; liczba messages = 1 |
| 2 | `GET /api/v8/chat/conversations/…/handoff-proposals` | 200 | lista propozycji przekazania | propozycja `469d3f99-ce9e-432f-b581-833901b33040` istnieje |
| 3 | `GET /api/v8/chat/handoff-proposals/469d3f99-ce9e-432f-b581-833901b33040` | 200 | szczegół propozycji | `pending|chat|document|1` w `artifact_handoff_proposals` |

Manifest fixture: `/private/tmp/consultify-review-audits-chat-artefakty/13_CHAT/fixture-manifest.json`.

## Znaleziska z odniesieniami do kodu

| ID | Moduł | Znalezisko | Plik:linia |
|---|---|---|---|
| `AUD-OR-20260829-001` | AUDITS | Angielska treść fixture trafia do UI | `scripts/dev/seed-wave3-audits-owner-review.mjs:47`, `:153`, `:155` |
| `AUD-OR-20260829-002` | AUDITS | Surowe ID audytora jest widoczne i przycinane | `scripts/dev/seed-wave3-audits-owner-review.mjs:162` |
| `AUD-OR-20260829-003` | AUDITS | Brak dowodu pełnej macierzy stanów | `scripts/dev/seed-wave3-audits-owner-review.mjs:139` |
| `CHAT-OR-20260829-002` | CHAT | Angielskie kontrolki i treści | `src/components/AIChat/UnifiedChatPanel.tsx:6989`; `src/components/AIChat/VoiceModeLegend.tsx:249`; `src/components/AIChat/EnhancedChatInput.tsx:1317` |
| `CHAT-OR-20260829-003` | CHAT | Producent sygnałów: świadoma decyzja, nie nowy defekt | `src/components/AIChat/signalsFeed/ChatSignalsFeed.tsx:266` |

Źródłem prawdy dla statusów i pełnych wpisów pozostają oba pliki `MODULE_ACCEPTANCE.md`; kodu nie naprawiano.

## Kryteria końcowe K1–K5

| Kryterium | Status | Uzasadnienie |
|---|---|---|
| K1 | **PARTIAL** | G07 i G09 są gotowe; G08/G10 nie mają pełnej macierzy wymaganych stanów dla każdego ekranu. |
| K2 | **PARTIAL** | 24/24 zachowanych PNG obejrzano; obrazy z EN/przycięciami zaklasyfikowano jako diagnostyczne, nie jako gotowy pakiet. |
| K3 | **PASS** | Kontrola zakresu po raporcie ma obejmować wyłącznie trzy dozwolone drzewa Z7; wynik zapisany w końcowym commicie. |
| K4 | **PASS** | Każde nowe znalezisko ma wskazanie `plik:linia`; szczegóły w MODULE_ACCEPTANCE. |
| K5 | **PASS** | Poniższa sekcja jest niepusta. |

## Twierdzenia niezweryfikowane

- Nie zweryfikowano produkcji, stagingu, demo ani Railway — było to zabronione.
- Nie udowodniono pełnej macierzy ekran × pusty/pełny × jasny/ciemny dla żadnego z dwóch modułów.
- Nie udowodniono, że treści i przycięcia wskazane w Fazie 3 są zaakceptowane przez właściciela.
- Nie udowodniono zachowania wielu tenantów ani izolacji tenantowej w przeglądzie wizualnym.
- Nie udowodniono ścieżek zapisu/akceptacji/odrzucenia CHAT; G09 obejmował odczyt rozmowy i propozycji.
- Nie udowodniono kompletności feedu sygnałów CHAT; pusty stan jest zgodny ze świadomą decyzją, ale nie dowodzi działającego producenta.

## Decyzja bezpieczeństwa

Zgodnie z zasadą „STOP zamiast zgadywania” nie oznaczono G08/G10 jako PASS. Materiał pozwala właścicielowi zobaczyć stan i defekty, lecz nie spełnia kontraktu kompletnego odbioru. Dalsze zamknięcie wymaga zmian/fixture'ów poza dozwolonym zakresem tego zadania albo jawnej decyzji właściciela; żadnej z tych rzeczy nie założono.
