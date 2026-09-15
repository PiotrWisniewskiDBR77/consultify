# K2 SuperAdmin i18n — independent review

**Werdykt: HOLD.** Kandydat dokładnie redukuje mierzony dług K2 do `K4en 1 / K7 0` i przechodzi bramki techniczne, ale polski zasób zawiera błędne znaczeniowo tłumaczenia, a dostarczony zrzut PL nadal pokazuje większość sprawdzanego ekranu po angielsku. Nie ma też trwałego dowodu konsoli/sieci dla sesji zrzutowej.

## Tożsamość i zakres

- Kandydat: `40b6c0792acfa1ce50e12b7dda48af749cdd39be` z `origin/backup/codex/b-k2-superadmin-i18n-20260915`.
- Baza: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`.
- Dozwolony zakres produktu został zachowany: `src/views/superadmin/**`, `src/components/SuperAdmin/**`, locale EN/PL, test, dokumenty i evidence K2. `bad_scope=0`.
- Diff nie dodaje `as any`.
- Review nie zmienia kodu produktu.

## Blokery

### P1 — polski zasób zmienia znaczenie tekstu produktu

Reprezentatywna próbka 539 nowych kluczy potwierdziła kompletność techniczną, ale wykazała tłumaczenia, których nie można uznać za „PL realny”:

- `public/locales/pl/translation.json:1739`: uprawnieniowy **grant** oddano jako „dotację” (`Create / Update Grant` → `Utwórz / zaktualizuj dotację`). W tym ekranie chodzi o nadanie uprawnienia.
- `public/locales/pl/translation.json:1768`: `reveal panel` oddano jako „Panel ościeżnicy”. To znaczeniowo niezwiązane tłumaczenie.
- `public/locales/pl/translation.json:1696`: `target the right audience` oddano jako „kieruj reklamy do właściwych odbiorców”, choć ekran publikuje komunikat aktualizacji, nie reklamę.
- `public/locales/pl/translation.json:1972`: przykład formuły `SUM(revenue) / COUNT(users)` został zmieniony na `SUM(przychody) / COUNT(użytkownicy)`. Lokalizacja identyfikatorów pól psuje przykład składni używany w `src/views/superadmin/analytics/BusinessMetricsView.tsx:711`.
- `public/locales/pl/translation.json:1769`: `Rotation` sekretu oddano jako „Obrót”, zamiast technicznej „rotacji”.
- `public/locales/pl/translation.json:1467`, `1479`, `1729`, `1907`, `2056`: stan `Failed` oddano jako „Przegrany”, choć jest to stan niepowodzenia operacji.

Wymagane: przegląd semantyczny całych 539 nowych wartości PL, poprawa terminologii domenowej oraz test regresyjny dla co najmniej uprawnienia, sekretu i przykładu formuły. Obecny test sprawdza jedynie obecność i nierówność EN/PL, więc wszystkie powyższe błędy przechodzą na zielono.

### P1 — dowód PL nie pokazuje polskiego ekranu

`evidence/k2-superadmin-i18n-20260915/organizations-pl-light.png` po obejrzeniu nadal pokazuje po angielsku m.in. `Organizations`, `Help`, `Refresh`, `All Organizations`, `Pending Requests`, `Access Codes`, `Search organizations`, komunikat retencji, wszystkie nagłówki tabeli i status `active`. Zmienione są tylko podtytuł i format dat.

Zrzut EN jest czytelny, a oba pliki mają 2880×1800 px (logiczne 1440×900 przy skali Retina), lecz para EN/PL nie dowodzi lokalizacji widocznej powierzchni. Wymagane: zrzut PL powierzchni, na której teksty objęte K2 są rzeczywiście przetłumaczone, oraz uczciwy opis pozostałego długu widocznego na ekranie.

### P2 — brak trwałego dowodu konsoli i sieci

W katalogu evidence są tylko dwa PNG, `POMIAR_PO.txt` i `pomiar-po.log`. Nie ma logu konsoli ani listy odpowiedzi sieciowych/4xx/5xx, mimo że freeze deklaruje ich brak. Wymagane: powtarzalny artefakt z sesji zrzutowej albo jawne oznaczenie tej części jako `NOT_PROVEN`.

### P2 — brak manifestu przebiegu importerów/delty

Freeze podaje `175/176`, ale paczka nie zawiera listy uruchomionych plików ani logu tego przebiegu. Przy 180 zmienionych plikach TSX reviewer nie może odtworzyć dokładnie zadeklarowanego mianownika z repozytorium. Niezależnie uruchomiony znany czerwony test daje `78/79`; jego plik i źródło asercji są byte-identyczne z bazą, więc ten konkretny RED jest zastany. Wymagane: jawny manifest testów delty/importerów z wynikiem per plik lub zapis pełnej komendy i logu.

## Pomiary niezależne

- Przyrząd językowy na kandydacie: w dozwolonych ścieżkach dokładnie `K4en 1 / K7 0`; jedyny K4en to fałszywie dodatnie pole `pending:` w `InvoiceCenterView.tsx:383`.
- `npm run check:jezyk:ci`: GREEN, delta repo `K4en -600`, `K7 -168`.
- Test K2 `superadminI18nDebt.w73.test.ts`: `2/2` GREEN.
- 539 nowych kluczy `superadmin.*`: `0` rozbieżnych zestawów placeholderów i `0` wartości PL równych EN. To dowodzi parytetu mechanicznego, nie jakości semantycznej.
- Front TSC: RC 1, dokładnie `177` błędów, `7425` plików w `--listFiles`, `0` błędów w ścieżkach K2.
- Server TSC: RC 0.
- `check-list-canon`: `349` (baseline `349`).
- `check-artefakt`: `8 / 0 / 117` (bez wzrostu).
- Test `settings-admin-superadmin.p31-33.test.ts`: `78/79`, jeden RED na tekstowym oczekiwaniu `c('platform-operations'`. Plik testu i `src/components/Admin/adminNavigation.ts` mają identyczne blob SHA na bazie i kandydacie (`adb180d1…` oraz `fdaced1f…`), więc RED jest zastany i identyczny względem exact base.
- `NODE_OPTIONS=--max-old-space-size=8192 npm run build`: RC 0, Vite zbudował paczkę w 34,46 s. Pierwsza próba bez podniesionego limitu pamięci zbiegła się z innym buildem i zakończyła się `Abort trap`; czysty ponowny przebieg jest GREEN.

## Warunek ponownego odbioru

Nowy freeze powinien zawierać poprawione tłumaczenia, test semantyczny, zrzut PL pokazujący rzeczywistą lokalizację oraz trwały dowód konsoli/sieci. Wszystkie obecne pomiary długu i bramki techniczne należy zachować bez regresji.
