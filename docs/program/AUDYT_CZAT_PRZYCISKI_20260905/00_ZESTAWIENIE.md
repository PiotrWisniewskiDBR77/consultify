# Audyt przycisków ekranu „Czat AI" — zestawienie (2026-09-05)

Kod: linia m03 `4332ade1c6` (= staging `b852ade6` + scalenia z 05.09). Trasy mierzone curlem na `staging.consultify.ai`.
Metoda: 7 agentów Sonnet po jednej powierzchni ekranu (pliki A1–F), potem 2 sceptyków (V1, V2) obalających
każdy defekt P1 i sprawdzających losową próbkę 16 wierszy „OK". Faza 3 (fizyczne przeklikanie na ekranie) — osobny plik `G_przeklikanie.md`, gdy powstanie.

## Liczby

| Powierzchnia | Plik | Elementów | OK (tunel do serwera) | OK-lokalny | Urwany/martwy | Za flagą | Niepewny |
|---|---|---|---|---|---|---|---|
| Górny pasek kanwy | A1 | 40 | 24 | 16 | 0 | 1 | 0 |
| Kebab kanwy (⋮) | A2 | 92 | 44 | 41 | 0 | 14* | 3 |
| Edytor tekstu + menu pływające | B | 41 | 21 | 20 | 0 | 0 | 0 |
| Nagłówek rozmowy + historia | C | 47 | 34 | 12 | 1 | 3 | 0 |
| Pole wpisywania + 3 menu | D | 60 | 34 | 22 | 2 | 0 | 1 |
| Wiadomości + pusty stan | E | 105 | 27 | 47 | 4 | 17 | 8 |
| Rama ekranu (góra, prawy pasek, pomoc) | F | 64 | 33 | 27 | 2 | 1 | 0 |
| **Razem** | | **449** | **217** | **185** | **9** | **36** | **12** |

\* 14 pozycji diagnostycznych za `VITE_DEV_DIAGNOSTICS` (OFF) — nakładają się z OK.
Tras HTTP zmierzonych curlem: ~100, wszystkie 401 (istnieją, chronione). Zero 404, zero 501, zero 200 bez logowania.
Próbka kontrolna sceptyka: 16/16 wierszy „OK" potwierdzonych niezależnie (handler, montaż trasy, kontroler, curl).

## Defekty potwierdzone przez sceptyka (P1 — widoczna funkcja nie robi tego, co obiecuje)

| # | Gdzie | Co użytkownik zobaczy | Dowód | Werdykt sceptyka |
|---|---|---|---|---|
| K1 | Kebab kanwy → „AI na zaznaczeniu", „Dodaj element" | Etykiety obiecują AI, a tekst jest podmieniany deterministycznie na serwerze — żaden model nie jest wołany. Prawdziwe AI jest tylko w menu pływającym edytora (zaznacz tekst → Rozwiń/Skróć). | `server/src/routes/work-canvas.routes.ts:1710-1763` (zero importu AI); `A2` D-1 | POTWIERDZONY |
| K2 | Nagłówek rozmowy → „Akcje biznesowe" | Przycisk nigdy się nie pojawia — żadne z 10 miejsc montowania panelu w aplikacji nie przekazuje mu callbacka. | `UnifiedChatPanel.tsx:6786`; `AppRoutes.tsx:1778`; `V1` pkt 3 | POTWIERDZONY (gorszy niż zgłoszono) |
| K3 | „+" → „Zarządzaj źródłami w chmurze" (Drive/OneDrive/Dropbox) | „Połączenie" powstaje bez logowania do dostawcy; plik nigdy nie zostanie pobrany. Silnik OAuth istnieje (`integrationOAuthEngine.ts`, tabela `integration_oauth_tokens`), ale serwis chmury go nie czyta — zbudowane, niepodłączone. | `server/src/routes/cloud.routes.ts:82-113`; `V1` pkt 4 | POTWIERDZONY |
| K4 | Wiadomość → „Konwertuj na inicjatywę" | Zapisuje DECYZJĘ (`ai_decision_outcomes`), nigdy inicjatywę — po obu stronach. | `server/src/routes/deep-thinking.routes.ts:62-141`; `E` D-1 | POTWIERDZONY |
| K5 | Karta potwierdzenia sprawy (`CaseIntakeConfirmCard`) | Nigdy się nie renderuje — nic w czacie nie produkuje `case_intake_proposal`; backend istnieje. | `grep case_intake_proposal` = 2 trafienia; `V2` pkt 3 | POTWIERDZONY |
| K6 | Pomoc (prawy pasek „?") → „Zapytaj AI teraz" | Na `/chat` wiadomość ginie: trasa nie przekazuje `kickoffMessage`, a panel czyta go tylko z propa. | `HelpSidePanel.tsx:307-337`; `AppRoutes.tsx:1772-1782`; `V2` pkt 4 | POTWIERDZONY |
| K7 | Edytor → menu pływające (Rozwiń/Skróć/Ton/Akcje) | Przy błędzie (sieć, limit 8000 znaków, brak dostawcy) nic się nie dzieje i nic nie mówi. Wyjątek: „Wyjaśnij" pokazuje błąd. | `CanvasRichEditor.tsx:282-285, 337-340`; `V1` pkt 2 | OSŁABIONY (wyjątek „Wyjaśnij"), reszta prawdziwa |

## Zgłoszone jako P1, po weryfikacji P2

| # | Gdzie | Stan po weryfikacji |
|---|---|---|
| K8 | Wiadomość → „Zapisz jako pomysł" | Rekord POWSTAJE, ale dopiero po nawigacji do Mojej Pracy (`IdeaMapWorkspace.hydrate()` woła `createMyIdea`). Zły wzorzec (zapis zależny od ekranu docelowego), nie brak zapisu. `V2` pkt 1 |
| K9 | Karta propozycji tabeli (`ChatTableProposalCard`) | Po odświeżeniu UI pokazuje stary stan, ale serwer odrzuca powtórkę (`ChatToSchemaService.ts:480-482`) — druga próba kończy się brzydkim 500, nie duplikatem. `V2` pkt 2 |

## P2 — rodziny (szczegóły w plikach A1–F)

1. **Angielski w polskim UI (największa rodzina, ~40 miejsc)**: 12+ ikon paska kanwy z tooltipem na sztywno bez `t()` (`canvasActionAvailability.ts:27-47`); brak kluczy `canvas.aiMenu.quickAction.*` i `tone.*` (12 pozycji menu Akcje/Ton); `aiChat.workPanel.title/resizeDivider`; `canvas.versionHistory.confirm*`; 7 kluczy historii rozmów w tym `window.confirm` przy usuwaniu (zawsze po angielsku, `ChatHistorySidebar.tsx:641`); `system.dataAccess`; przycisk „Reset" w stylu odpowiedzi (`ToolsMenu.tsx:625`); etykiety datasetu i workflow-ledger w kebabie.
2. **Duplikaty i mylące etykiety**: panel „Dataset ready" renderowany dwa razy naraz (A2 D-2); karta „Dodaj element" w Najczęstszych nie rozwija sekcji, do której prowadzi (A2 D-3); „Create new task" w dzwonku zadań tylko nawiguje (F D-2); „Skrzynka" i „Centrum" w powiadomieniach = ten sam handler (F D-5); etykieta „Otwórz panel roboczy" nie zmienia się po otwarciu (C D-4).
3. **Martwe pliki w katalogu czatu (mylą audyty, nic nie psują)**: `ChatExportModal`, `ImageAttachment`, `InputHintStrip`, `ChatLanguageSelector`, `SmartSuggestions` (żywy: `Chat/ChatSmartSuggestions`), `ResponseActions`, `ResponseQualityIndicator`, `DiagramArtifact`, `ChatToggleButton`+`ChatOverlay`, `DemoTopbarStatus`, `ui/HelpButton`+`layout/HelpPanel`, `ActiveModeStrip`, `OrganizationMemoryPanel`, `PendingActionsIndicator`, `ActionCenter`, `WorkCanvasShell`. Cały `Artifacts/**` osiągalny tylko przez `SplitLayout`, którego `/chat` nie używa.

## Korekty mojego briefu (nadzorca się mylił)
- Szacunki liczebności były 2× za niskie na każdej powierzchni (449 vs ~200).
- Druga ikona prawego paska to **Opinie** (`FeedbackToggleButton`), nie czat. Ikona iskier ✦ w nagłówku to panel **Ważne sygnały**, nie AI.
- Wskazałem agentom 7 plików, które są martwe (patrz rodzina 3) — realne komponenty: `Help/HelpToggleButton`, `Feedback/FeedbackToggleButton`, `documents/DocumentToggleButton`, `SystemHealth`, `LLMSelector`, `TaskDropdown`.
- Pasek kanwy dla prezentacji (deck) to inny komponent z innymi przyciskami — nie był w briefie.

## Niezweryfikowane (uczciwie)
- Faza 3 — fizyczne kliknięcie każdego elementu na zalogowanym ekranie — NIE wykonana w chwili pisania (panel przeglądarki bez sesji; nadzorca nie wpisuje haseł).
- Bramka dostępu AI (`ensureAiProviderAndAccess`) — warunki 403 dla zalogowanego użytkownika nieznane.
- Gałąź V8 w nagłówku (12 akcji) — za backendową flagą `v8.chat` OFF, opisana zbiorczo.
- 12 pozycji NIEPEWNY (lista w plikach A2, D, E) — głównie fragmenty audytu agentów i przyciski w blokach za flagą.
