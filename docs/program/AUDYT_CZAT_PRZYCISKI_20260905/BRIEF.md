# AUDYT PRZYCISKÓW EKRANU „CZAT AI" — wspólny brief dla agentów (2026-09-05)

## Kontekst
Ekran: `/chat` w aplikacji Consultify (lewa połowa: panel kanwy dokumentu `WorkCanvasDocumentPanel`,
prawa: rozmowa z Teresą `UnifiedChatPanel` + `EnhancedChatInput`). To główny panel pracy właściciela.
Cel: KAŻDY klikalny element (przycisk, zakładka, pozycja menu, podmenu, przełącznik, ikona, chip, skrót)
ma udokumentowany „tunel": handler → skąd przychodzi callback (props/hook/context) → serwis/hook →
wywołanie HTTP (metoda + URL) → trasa serwera (plik:linia + montaż w `server/src/Gateway.ts` lub
`server/src/index.ts`) → kontroler/serwis → repozytorium/baza lub usługa zewnętrzna.
Dla akcji czysto klienckich (formatowanie, przełączanie widoku): do komendy edytora/stanu i dowód, że coś zmienia.

## Katalog roboczy
`/private/tmp/m03` (gałąź `codex/m03-admin-20260824`, HEAD `4332ade1c6`). TYLKO ODCZYT.
Zakazy: żadnych edycji plików, żadnych `git checkout/stash/commit/reset`, żadnego pełnego `tsc`/`vitest`,
żadnego `pkill`/`kill`, nie dotykaj serwera na :3000. Wolno: grep/sed/cat/find, `npx esbuild` na pojedynczym pliku, curl.
Pułapka zsh: `grep -r --include='*.tsx'` — wzorzec w CUDZYSŁOWIE, inaczej zsh zwraca pustkę zamiast wyników.
Frontend woła API przez proxy Vite; w kodzie szukaj `fetch(`, `api.get/post`, `apiClient`, `ApiGateway`, `axios`, hooków `use*`.
Flagi: `import.meta.env.VITE_*` + helpery w `src/utils/*Flag*.ts` i `src/config/`. UWAGA: helper może mieć
wczesny `return true` po zmiennej środowiskowej — czytaj implementację helpera, nie tylko nazwę flagi.
Wartości flag na stanowisku lokalnym/stagingu: `/private/tmp/m03/.env.local` (30 flag `=true`).

## Klasyfikacja (jedna na element)
- `OK` — pełny łańcuch zweryfikowany do serwera (trasa istnieje, zamontowana, kontroler robi to, co etykieta obiecuje).
- `OK-LOKALNY` — akcja z założenia kliencka, działa (zmienia stan/edytor), bez HTTP.
- `MARTWY` — handler pusty / TODO / tylko `console.*` / tylko toast „wkrótce" / `disabled` na stałe / atrapa.
- `URWANY` — łańcuch się rwie: prop nigdy nie przekazany, callback `undefined` na ścieżce renderu, trasa
  nieistniejąca lub niezamontowana, zła ścieżka/metoda, zły kształt payloadu, serwer zwraca 501, kontroler-stub.
- `ZA FLAGĄ` — element/akcja bramkowana flagą; podaj nazwę, domyślną wartość W KODZIE i wartość z `.env.local`.
- `NIEWIDOCZNY` — istnieje w kodzie, ale na realnej ścieżce renderu z `/chat` nigdy się nie renderuje
  (sprawdź, kto importuje i czy komponent jest osiągalny z `UnifiedChatPanel`/`MainLayout`).
- `NIEPEWNY` — nie umiesz rozstrzygnąć; napisz dokładnie, czego brakuje.

## Pomiar trasy (mechaniczny, obowiązkowy dla każdego URL)
`curl -s -o /dev/null -w '%{http_code}' -X <METODA> 'https://staging.consultify.ai<ścieżka>'`
bez uwierzytelnienia, bez ciała, identyfikatory zastąp `test-id`, JEDNO wywołanie na trasę.
Interpretacja: 401/403 = trasa istnieje za uwierzytelnieniem; 404 = brak trasy (lub złapane przez catch-all — sprawdź
czy 404 ma JSON z `error`); 405 = zła metoda; 500 = zapisz; 200 na trasie, która powinna być chroniona = DEFEKT bezpieczeństwa.
ZAKAZ: jakichkolwiek wywołań do `https://consultify.ai` / `app.consultify.ai` (produkcja, dane klientów).
ZAKAZ: wysyłania ciała żądania; nie logujesz się nigdzie.

## Reguły przeciw fałszywemu „gotowe" (z historii projektu)
1. „Wołacz istnieje ≠ renderuje się": grep znajduje handler, ale komponent może nie być zamontowany. Zawsze idź od korzenia renderu.
2. „Flaga OFF w kodzie ≠ wyłączona" i odwrotnie — czytaj helper flagi i `.env.local`.
3. „Klucz i18n istnieje ≠ przetłumaczony": jeśli etykieta PL trzyma angielskie słowo, zapisz jako uwagę P2.
4. Nie ufaj dokumentom ani komentarzom — tylko kod i pomiar curl.
5. Handler, który tylko ustawia stan otwierający inny panel: idź DALEJ, do przycisków tego panelu (podmenu też są w zakresie).
6. Każde twierdzenie z `plik:linia`. Bez linii = nie policzone.
7. Jeśli element ma kilka wariantów (np. inny handler w trybie „Dokument" niż „Edytor"), policz każdy wariant osobno.

## Format wyniku — plik `<TWÓJ_PLIK>.md` w katalogu `/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/31514c23-710c-4185-9a65-43bd25b234d4/scratchpad/audyt-czat/`
1. `## Inwentarz` — tabela: `# | Etykieta PL na ekranie | klucz i18n | element plik:linia | handler | łańcuch (props→hook→serwis) | HTTP metoda+URL | trasa serwera plik:linia (+montaż) | kontroler/serwis | flaga | curl | KLASA | uwagi`
2. `## Defekty` — lista: `D-n | P0/P1/P2 | element | co jest nie tak | dowód plik:linia | jak odtworzyć w 1 zdaniu`
   (P0 = blokuje główny przepływ pisania/czatu/zapisu; P1 = widoczna funkcja martwa/urwana; P2 = drobne: etykieta, i18n, kosmetyka)
3. `## Niezweryfikowane` — czego nie dało się rozstrzygnąć i dlaczego.
4. `## Liczby` — ile elementów, ile w każdej klasie.
W odpowiedzi końcowej do nadzorcy: 10 linii max — liczby + najważniejsze defekty + ścieżka pliku.
Zweryfikuj sam liczbę elementów podaną przez nadzorcę w zleceniu — nadzorca bywa niedokładny; jeśli znajdziesz więcej/mniej, napisz.
