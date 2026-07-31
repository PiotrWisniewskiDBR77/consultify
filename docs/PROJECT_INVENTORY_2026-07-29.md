# Inwentaryzacja projektu Consultinity

Data audytu: 2026-07-29
Katalog: iCloud Drive / `Documents/Antygracity/DRD/consultify`

## 1. Podsumowanie

Consultinity jest dużą, dojrzałą platformą doradczą wspierającą transformację cyfrową organizacji. Repozytorium obejmuje aplikację webową, backend API, rozbudowany system AI, narzędzia analityczne, dokumentację enterprise, testy, migracje baz danych oraz materiały wiedzy.

Skala na dzień audytu:

| Obszar | Stan |
| --- | ---: |
| Pliki śledzone przez Git | 20 091 |
| Pliki TypeScript / TSX | 9 760 |
| Pliki testowe `test` / `spec` | 3 656 |
| Komponenty React w `src/components` | 2 090 |
| Pliki migracji w backendzie | 1 972 |
| Pliki powiązane z trasami backendu | 853 |
| Aktywne worktree po porządkach | 11 |
| Rozmiar całego katalogu | ok. 34 GB |
| Rozmiar `.git` | ok. 19 GB |

## 2. Architektura techniczna

### Frontend

- React 19.2
- TypeScript 5.8
- Vite 6.4
- Tailwind CSS 3.4
- rozbudowana architektura komponentowa w `src/components`
- główne domeny UI obejmują m.in. AI Chat, administrację, audyty, finanse, inicjatywy, wywiady, wiedzę, spotkania, organizację, prezentacje, raporty, strategię i workspace

### Backend

- Node.js i Express 5.2
- backend rozwijany w `server`
- migracja z CommonJS/JavaScript do TypeScript/ESM jest zaawansowana, ale według README nadal trwa w usługach i zadaniach cyklicznych
- PostgreSQL jest docelową bazą produkcyjną
- repo zawiera migracje, skrypty integralności, backupy, narzędzia inwentaryzacji i audytu danych

### Monorepo

Workspaces:

- `packages/*`
- `apps/*/frontend`
- `apps/*/backend`

Współdzielony kod znajduje się m.in. w `packages/shared`.

### Testy i jakość

- Vitest 4.1
- Playwright 1.57
- testy jednostkowe, komponentowe, integracyjne, kontraktowe, wydajnościowe, bezpieczeństwa i E2E
- osobne poziomy L1–L5 oraz bramki jakości, bezpieczeństwa, danych i wdrożeń
- testy i artefakty testowe zajmują ok. 1,4 GB

### Operacje i wdrożenia

- Docker oraz Docker Compose
- konfiguracja Railway i osobne tryby staging/production
- GitHub Actions, Dependabot, Codecov, Lighthouse, Percy, Snyk i Trivy
- polityki bezpieczeństwa, zgodności i dokumentacja due diligence

## 3. Główne zasoby repozytorium

| Katalog | Liczba plików | Rozmiar orientacyjny | Rola |
| --- | ---: | ---: | --- |
| `src` | 3 630 | 56 MB | frontend aplikacji |
| `server` | 6 773 | 876 MB | API, logika biznesowa, dane i skrypty |
| `tests` | 5 366 | 1,4 GB | automatyzacja jakości i E2E |
| `docs` | 4 254 | 298 MB | dokumentacja techniczna i produktowa |
| `knowledge` | 561 | 879 MB | baza wiedzy i materiały źródłowe |
| `Harvard` | 845 | 61 MB | audyty, plany, odbiory i dokumentacja modułów |
| `rejestr` | 105 | 5,2 MB | rejestr prac i odbiorów |
| `public` | 177 | 61 MB | publiczne zasoby aplikacji |
| `scripts` | 281 | 5,7 MB | automatyzacja dev, QA, security i operacji |
| `packages` | 34 | 3,7 MB | pakiety współdzielone |

## 4. Stan Git podczas audytu

- gałąź robocza: `chore/porzadki-2026-07-27`
- punkt odniesienia: `origin/demo`
- gałąź lokalna była 334 commity za `origin/demo`
- przed porządkami istniały już zmodyfikowane, dodane, usunięte i nieśledzone pliki
- istniejących zmian użytkownika nie resetowano, nie stashowano i nie synchronizowano
- nie zmieniano historii Git

## 5. Wykonane bezpieczne porządki

- usunięto 22 pliki `.DS_Store` spoza aktywnych worktree
- oczyszczono 56 martwych wpisów Git worktree, których katalogi już nie istniały
- zachowano 11 aktywnych worktree
- 566 plików rozpoznanych jako kopie iCloud przeniesiono do:
  `_quarantine/icloud-duplicates-2026-07-29T04-37-47-585Z`
- kwarantanna jest odwracalna; pliki nie zostały skasowane
- nie usuwano baz danych, backupów, materiałów wiedzy, sekretów lokalnych ani aktywnych artefaktów pracy

## 6. Ryzyka i dług techniczno-organizacyjny

### Wysoki priorytet

1. Repozytorium ma ok. 34 GB, z czego `.git` zajmuje ok. 19 GB. Pakiety Git obejmują ok. 18,5 GB.
2. Git zgłaszał ok. 206 MB osieroconych danych binarnych w katalogu obiektów. Nie były automatycznie usuwane.
3. Lokalna gałąź jest znacznie za `origin/demo`; synchronizacja wymaga najpierw zabezpieczenia bieżących zmian i oceny konfliktów.
4. W repo działa wiele równoległych worktree i gałęzi. Przed usuwaniem aktywnych worktree trzeba potwierdzić właściciela i status każdej pracy.

### Średni priorytet

1. Katalogi z testami, dokumentacją i wiedzą są bardzo duże; warto ustalić politykę retencji artefaktów.
2. W katalogach danych znajdują się lokalne bazy, kopie i backupy. Potrzebna jest jawna mapa: aktywne dane, fixture, archiwum, materiał do usunięcia.
3. Dokumentacja zawiera liczne raporty okresowe i handoffy; potrzebny jest indeks dokumentów kanonicznych oraz archiwum historyczne.
4. README deklaruje wskaźniki zgodności z terminami z początku 2026 roku; warto zweryfikować ich aktualność.

## 7. Rekomendowana kolejna fala

1. Zabezpieczyć bieżący stan w osobnym commicie lub kopii roboczej, bez łączenia go z porządkami.
2. Przejrzeć zawartość `_quarantine` i po akceptacji usunąć ją albo zarchiwizować poza repo.
3. Sporządzić tabelę aktywnych worktree i gałęzi: właściciel, cel, ostatni commit, status integracji.
4. Zidentyfikować największe obiekty w historii Git i zaplanować ewentualną migrację binariów do Git LFS lub magazynu artefaktów.
5. Ustalić kanoniczne dokumenty w `docs`, `Harvard` i `rejestr`, a materiały historyczne przenieść do wersjonowanego archiwum.
6. Dopiero po zabezpieczeniu zmian zsynchronizować gałąź z aktualnym `origin/demo`.

## 8. Wynik kontroli

- `git diff --check`: bez błędów formatowania różnic
- `git fsck --connectivity-only --no-dangling`: integralność połączeń obiektów Git poprawna
- kwarantanna: 566 plików
- `.DS_Store` poza aktywnymi worktree: 0
