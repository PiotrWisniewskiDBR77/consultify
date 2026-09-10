# Karta na drogę — 11.09.2026, rano (przed wylotem do USA)

Piotrze, w nocy zrobiłem to, co dało się zrobić bez ruszania pokazu w Tokio. Poniżej: co jest na
stagingu i demo, co czeka na wdrożenie po Tokio, pięć decyzji do jednego słowa i wklejka dla Codexa nr 2.

---

## 1. Staging (z niego pokazuje zespół w Tokio) — ZAMROŻONY

Kod `e25b7cd5d0` = wczorajszy stan wieczorny + **jedna nocna poprawka utraty danych**: zapis z karty
zadania (np. sama zmiana tytułu) **nie odpina już osoby od zadania**. Wcześniej po takim zapisie
zadanie znikało z „Moich zadań" i wracało błędem „nie znaleziono". Sprawdziłem to na żywo skryptem,
nie oczami robotnika: zadanie po zapisie tytułu ma nadal przypisaną osobę, wszystkie zapisy w aplikacji
działają, zero błędów serwera. Sonda po teście usunięta.

Twoje konto piotr.wisniewski@dbr77.com w DBR77: dane bez zmian od wczoraj (skrzynka, czat, inicjatywy,
zadania, decyzje, spotkania). Od 23:15 nic więcej na staging nie wchodzi do końca pokazu.

Punkt cofnięcia: tag `staging-safe-20260910-2258` (stan sprzed poprawki) + zrzut bazy z 20:40.

## 2. Demo

Demo dostało **ten sam kod co staging** (było trzy paczki w tyle). Baza demo osobna, nietknięta.
Punkt cofnięcia: zrzut bazy demo z 23:00 + tag `demo-safe-20260910-2300`. Danych pokazowych na demo
nikt jeszcze nie obejrzał — to zadanie przed pilotażem.

## 3. Co czeka na wdrożenie po Tokio (gotowe lub prawie gotowe, na linii integracyjnej)

- Panel Teresy nie wraca sam po odświeżeniu strony; megatrendy liczone wg branży organizacji,
  a nie zawsze „automotive" (F3 — gotowe).
- Ocena: „Otwórz zadanie" z karty inicjatywy nie daje „nie znaleziono"; przycisk „dodaj powiązanie"
  jest osiągalny (F4 — gotowe, scalone).
- Karty N od Codexa (Wniosek, Decyzja, Powiadomienie, Sesja wywiadu, Wzorzec, Karta działania)
  z poprawkami po odbiorze (N1 i N2 scalone). Kod Codexa wniósł 8 polskich napisów wbrew zasadzie
  „wszystko po angielsku" — usunięte przy poprawkach N2. W karcie działania naprawiony błąd, który
  wywracał kartę przy każdym otwarciu.
- Historia zadania: brakująca tabela w bazie dodana (F5 — gotowe).
- Blok Codexa nr 1 „jeden magazyn inicjatyw" — za wyłączoną flagą (nic nie widać, nic nie ryzykuje).
- Blok Codexa nr 3 „Finanse minimum": dostarczył 4 z 6 paczek (testy, zatwierdzanie pakietu,
  zbiorczy rodowód, trzy tabele sprawozdania). Nie zrobił czystki koloru i seedu danych. **Odbiór
  zrobiony w nocy:** dwie paczki do scalenia od razu, dwie po pięciu drobnych poprawkach (w toku).
  Na ekranie nic się nie zmienia (front za wyłączoną flagą). **Odbiór wykrył poważną rzecz:** dziś
  żadna rola w aplikacji nie może zatwierdzić sprawozdania finansowego przez API (blokada bety i
  mapowanie ról nie mają części wspólnej). Póki Finanse są zamknięte w menu, nikt tego nie widzi —
  dlatego w decyzji 2 rekomenduję A.

Wdrożenie tego wszystkiego = jedna paczka po zielonej bramce, po zakończeniu pokazu w Tokio.

## 4. Pięć decyzji — odpowiedz literą

1. **Inicjatywa bez projektu.** 105 starych inicjatyw nie ma projektu ani właściciela biznesowego,
   więc nie da się ich przenieść do nowego magazynu. **A** zostawić (czytnik i tak łączy oba magazyny;
   rekomendacja na MVP) · **B** dopuścić „inicjatywa bez projektu" jako stan legalny (zmiana produktu,
   fala 2).
2. **Finanse w menu.** Dziś pozycja zamknięta (poza MVP). **A** zostaje zamknięta (rekomendacja:
   Codex 3 dał tylko tył, na ekranie nie ma jeszcze nic do pokazania) · **B** pokazać „wkrótce" ·
   **C** otworzyć wszystkim.
3. **Poczta.** Konto SMTP w Hostingerze jest wyłączone („Outbound sending is disabled"). Bez tego nie
   działają zaproszenia, resety haseł i alerty o błędach. **A** sprawdzisz w panelu Hostingera ·
   **B** zmieniamy dostawcę poczty (rekomendacja, jeśli A nie da się załatwić w 10 minut).
4. **Pilotaż (Tomek, Kasia, Irina, Justyna).** **A** na demo (ten sam kod, osobna baza, dzień na
   przygotowanie i obejrzenie danych — rekomendacja) · **B** na stagingu (Twoje dane, ryzyko
   mieszania z pokazem).
5. **Dwa Postgresy na stagingu.** Serwis „Postgres" jest martwy, aplikacja używa „pgvector", a część
   zmiennych wskazuje na martwy. **A** usunąć martwy serwis i zmienne (rekomendacja) · **B** zostawić.

## 5. Wklejka dla Codexa nr 2 (skopiuj w całości)

```
NOWY BLOK — CODEX2 — „JEDEN MAGAZYN, CZĘŚĆ 2: reszta projekcji + część zapisowa inicjatyw"

★ PIERWSZA KOMENDA — instrukcja z vaulta, NIE z katalogu roboczego:
V=/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
git -C "$V" fetch origin --prune && git -C "$V" show \
 origin/integracja/20260911:docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX2_JEDEN_MAGAZYN_2/01_INSTRUKCJA.md
Przeczytaj wynik w CAŁOŚCI, dopiero potem cokolwiek uruchamiaj.

★ KATALOG ROBOCZY TWORZYSZ SAM — dokładnie tak (NIE w /private/tmp):
WT=/Users/piotrwisniewski/Developer/codex-wt/codex2-jeden-magazyn-2
MARKER=19440011e9
df -h /
git -C "$V" merge-base --is-ancestor "$MARKER" origin/integracja/20260911 \
  && echo "MARKER OK" || echo "MARKER BRAK"
mkdir -p /Users/piotrwisniewski/Developer/codex-wt
git -C "$V" worktree add "$WT" -b codex/jeden-magazyn-czesc-2-20260911 "$MARKER"
printf '[core]\n\tbare = false\n' > "$V/worktrees/codex2-jeden-magazyn-2/config.worktree"
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"
git -C "$WT" rev-parse HEAD
Gałąź bazowa: origin/integracja/20260911 (NIE origin/staging — tam nie ma C1-FIX/C2-FIX).
Zasoby wyłączne: baza 6452, harness 5592, kontener cx-codex2-pg, migracje 20262140-20262149, flaga ENABLE_INITIATIVE_UNIFIED_WRITE (default OFF).
NIETYKALNE cudze: cx-codex1-inicjatywy-pg (6451), ~/Developer/codex-wt/codex1-*, consultify-pg18 (54418) — z tego ostatniego WOLNO wyłącznie pg_dump i SELECT.

★ ZAKAZY (pełna lista Z1-Z46 w instrukcji):
 - NIE pushujesz nic i nigdzie. Push robi nadzorca.
 - NIE dotykasz /Users/piotrwisniewski/Developer/Consultify (katalog właściciela); jedyny wyjątek to symlink node_modules do odczytu, komenda wyżej.
 - ZERO połączeń do Railway, demo, stagingu i produkcji — w każdą stronę.
 - NIE robisz `source ~/Developer/consultify-secrets/server.env` — niesie ŻYWE SMTP.
 - NIE kasujesz żadnej tabeli zastanej; migracje addytywne, z manifestem i rollbackiem.
 - ZERO zmian wyglądu — front tylko tam, gdzie przepinasz wołacza.
 - Nazwa bazy PARAMETREM, nie stałą (Z41). Manifest tylko przy apply (Z42).
 - Test NIE przybija stanu zastanego: arrayContaining, nie toEqual([]) (Z43).
 - Klucze i18n PL+EN realnie przetłumaczone (Z46). Kod i napisy w kodzie: EN (DEC-461).
 - Każdy commit MUSI nieść CZTERY znaczniki, inaczej hook commit-msg go odrzuci:
   [ODMROZENIE 05_INITIATIVES DEC-453] [ODMROZENIE 06_EXECUTION DEC-453] [ODMROZENIE 04_ASSESSMENT DEC-453] [ODMROZENIE WSPOLNE DEC-453]

★ RAPORT (jedyny nowy dokument w repo, układ 14 sekcji, etap E9):
 docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX2_JEDEN_MAGAZYN_2/98_RAPORT.md
 Zrzuty, logi i manifesty POZA repo: ~/Developer/codex-wt/codex2-artefakty
Jeżeli cokolwiek tu różni się od instrukcji — WIĄŻĄCA JEST INSTRUKCJA.
```

Uwaga: katalog `~/Developer/codex-wt/codex2-jeden-magazyn-2` już istnieje (worktree na markerze) —
jeśli Codex zgłosi, że istnieje, ma w nim pracować, nie tworzyć drugiego.

---

Szczegóły i dowody: `PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md` (wiersze od „SPROSTOWANIE
ZEGARA + PRZEJĘCIE SESJI", 10.09 22:50) oraz `PRZEKAZANIE_20260910_KONIEC_DNIA.md` §10–§11.
