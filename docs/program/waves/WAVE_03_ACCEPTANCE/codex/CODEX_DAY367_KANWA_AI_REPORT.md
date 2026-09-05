# CODEX DAY 367 — KANWA AI

Data: 2026-09-05  
Gałąź: `codex/day367-kanwa-ai-20260905`  
Baza: marker `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`

## Wejście

Dokument przeczytałem w całości (1138 linii) z `github-backup/grafika/m03-20260902`. Stan dokumentu: `WYDANY`. Dysk: 69 GiB wolne; porty 6438/5578, kontener i gałąź były wolne.

Wynik markera i sanity, dosłownie:

```text
MARKER OK
9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c
```

Tip gałęzi bazowej uciekł do przodu; lista commitów i plików jest w `/private/tmp/cx-day367-kanwa-ai-artefakty/wejscie-14-tez.txt`. Zgodnie z instrukcją pracowałem dokładnie z markera, bez rebase.

Przeczytałem R0(1): przy dostępnym dostawcy kebab ma zwracać treść modelu, nie szablon. Przeczytałem R0(2): deterministyczny fallback jest dopuszczalny wyłącznie z widocznym komunikatem. Przeczytałem R0(3): menu korzysta ze wspólnego mechanizmu błędu, a panel manualny zachowuje literalną podmianę bez AI.

## R1 — K1

Pomiar rodziny na markerze:

| Wejście | Pomiar |
|---|---:|
| `applySelectionMenuAction` prefill | 6 wywołań |
| `previewSelectionMenuPrompt` submit | 1 |
| `insertQuickAddElement` submit | 1 |
| manualny `previewSelectionEdit` | 1, osobna uczciwa ścieżka |
| importy AI w `work-canvas.routes.ts` | 0 |
| dispatch `canvas-stream-request` | 1, poza kebabem |

Wybrałem drogę C: eksportowana `requestCanvasQuickAI` jest jedynym miejscem budującym kontrakt `/api/ai/chat/quick`; używają jej menu pływające, submit zaznaczenia i „Dodaj element”. Droga A oznaczałaby drugi skopiowany fetch. Droga B zapisuje bezpośrednio do TipTap i narusza istniejący preview/accept przed zastosowaniem.

Sukces AI staje się `replacementMd` lub treścią nowego elementu. Non-2xx/sieć/pusta odpowiedź uruchamia dotychczasowy szablon i widoczny komunikat PL/EN, że to szablon, nie odpowiedź AI. `previewSelectionEdit()` bez `aiPrompt` pozostało literalne.

Dowody zachowania:

- klik kebaba wysyła `/api/ai/chat/quick`, `message` z promptem i `context.selectedText=Selected canvas text`;
- „Dodaj element” wysyła ten sam endpoint i prompt użytkownika;
- awaria dostawcy pozostawia preview i pokazuje `role=alert` z informacją o szablonie;
- panel manualny tworzy preview literalnej podmiany i wykonuje zero fetchy AI.

Mutacja R1: zastąpienie requestu stałym błędem dało RED: `expected vi.fn() to be called 1 times, but got 0`; po przywróceniu `restore-diff=0` i GREEN. Artefakty: `r1-mutacja-{red,green}.txt`.

Commit: `39c10a82f0`. `git show --stat`: 6 plików, 274 insertions, 68 deletions.

## R2 — K7

`requestCanvasQuickAI` używa istniejącego `getAiErrorLine`, mapuje odpowiedź serwera, pustą odpowiedź i błąd sieci. `CanvasRichEditor` przekazuje jedną linię błędu do `CanvasAIFloatingMenu`. `handleQuickAction` i `handleCustomPrompt` sprawdzają wynik `onAIRequest`; wspólny stan pokazuje jeden `role=alert` dla wszystkich presetów, skrótów, tonów i custom promptu.

Finalny `message` jest liczony przed fetch. Limit `8000` zwierciedla `ChatQuickRequestSchema.message.max(8000)`; po przekroczeniu komunikat PL/EN pojawia się bez wywołania fetch. „Wyjaśnij” nadal pokazuje istniejący `canvas.aiMenu.explainError`.

Dowody: HTTP 500 → wspólny komunikat widoczny; tekst >8000 → komunikat widoczny i fetch=0; Explain przy błędzie → dotychczasowy komunikat widoczny. Mutacja usuwająca `setRequestErrorVisible(!replacement)` dała RED przez brak `role=alert`; po przywróceniu `restore-diff=0` i GREEN. Artefakty: `r2-mutacja-{red,green}.txt`.

Commit: `337749516b`. `git show --stat`: 2 pliki, 110 insertions, 3 deletions.

## R3 — regresja i przemiar

Wybrany pakiet jsdom uruchomiono jako `RUN_DB_TESTS=0 MOCK_DB=true ... --retry=0 --reporter=json`: **13/13 PASS, 0 failed, 0 pending**. To testy komponentowe z mockowanym fetch; bramki DB/auth/V8/results beta nie leżą na ich ścieżce. Nie są dowodem realnego dostawcy ani produkcyjnego HTTP.

Pełne nazwy: PRZED 6, PO 13; dodano 7 nazw day367, nie zniknęła żadna. Listy i diff: `/private/tmp/cx-day367-kanwa-ai-artefakty/{przed-nazwy,po-nazwy,nazwy-diff}.txt`.

| Pomiar | PRZED | PO |
|---|---:|---:|
| słownik PL | 35200 | 35203 |
| słownik EN | 33067 | 33070 |
| focus/list/artefakt | 0/0/0 | 0/0/0 |
| reachability | exit 1, 1 plik | exit 1, ten sam 1 plik |

Pełna lista reachability PRZED i PO: `src/components/Initiatives/__tests__/initiativeKartaRealnyRekord.test.ts`. Delta jest pusta, bo nowe testy są pod `tests/**`, nie pod `src/**/__tests__`.

Esbuild `--bundle --format=esm --outfile=/dev/null` zakończył się poprawnie osobno dla trzech zmienionych plików produktu. Commit dowodu: `822fbb8ebb`; 1 plik, 13 insertions.

## Korekty wobec instrukcji

- Słowniki na markerze: `35200/33067`, nie `35204/33071`.
- `readFileSync` w zastanym teście: 2 trafienia, nie 1.
- Reachability na markerze: 1 plik test-only, nie 3.
- Komenda instrukcji dla wariantów B/C `vitest` zawiera w środku wklejony opis i nie jest paste-ready; zastosowałem semantycznie wskazany wariant C z konkretnymi plikami.
- W lokalnym złożeniu diffu `test ${PIPESTATUS[0]} -le 1` było niepoprawną składnią zsh; sam diff został poprawnie zapisany, a skład nazw zweryfikowano z JSON.

## Bezpieczeństwo

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Nie uruchomiono bazy, migracji ani realnego modelu, bo rdzeń ma licencję na testy jsdom z mockowanym fetch. Nie wykonano połączeń Railway/demo/staging/produkcja.

## PYTANIA DO WŁAŚCICIELA

1. Czy jawny fallback deterministyczny ma zostać na stałe także jako wybieralna opcja „szybki szablon bez AI”, czy ma pozostać wyłącznie automatycznym trybem awaryjnym?
2. Czy `ensureAiProviderAndAccess` zwracający 403 na stanowisku bez klucza dostawcy jest zamierzony, czy powinien być osobnym defektem wobec oczekiwanego 503?

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano realnego kodu 403/503 na lokalnym ApiGateway ani odpowiedzi prawdziwego dostawcy; testy pokrywają behawioralnie oba kształty przez kontrolowane błędy, ale nie dowodzą bieżącej konfiguracji serwera.
- Nie zweryfikowano produkcyjnego renderu ani urządzeń; zakres dowodu to jsdom i esbuild.
- Nie twierdzę, że gałąź jest gotowa do scalenia z uciekającym tipem; integrację i rozstrzygnięcie ewentualnych konfliktów wykonuje nadzorca.

## Commity i artefakty

Commity: `39c10a82f0`, `337749516b`, `822fbb8ebb`. Wszystkie zostały wypchnięte po pozycji na `github-backup/codex/day367-kanwa-ai-20260905`.

SHA-256: `przed.json` `91705e2a...fee7`; `po.json` `81e770ac...e15`; R1 RED `bfbe88ca...4073`; R1 GREEN `749d0ffa...6fb9`; R2 RED `cf3aa280...1654`; R2 GREEN `1bcddd78...a96`; esbuild `b5e34f4d...e0f8`.

