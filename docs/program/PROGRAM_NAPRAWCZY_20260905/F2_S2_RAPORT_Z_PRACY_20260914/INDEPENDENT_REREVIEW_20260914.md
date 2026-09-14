# Independent skeptical re-review — S2 / P1 Raport z pracy

**Werdykt: REQUEST_CHANGES.** Exact freeze `44ddaa57bbe7c8f33b6b92c0012bdc2a23e38796` na bazie `88f1a1994dffa8b1f3b706476078844cbb43441f` naprawia wcześniejszy błąd publikowania przed zakończeniem SMTP, lecz nadal nie zapewnia bezpiecznego retry dla ręcznej wysyłki ani odzyskania odbiorcy po przerwaniu procesu.

## Blokery

1. **P1 — retry ręcznej wysyłki tworzy nowy receipt i może wysłać duplikat do odbiorcy już obsłużonego.** UI generuje nowe `crypto.randomUUID()` przy każdym kliknięciu Send (`InitiativeWorkReportView.tsx:327-334`). Serwer rozpoznaje i wznawia próbę wyłącznie po identycznym `receiptId`; dla nowego identyfikatora zakłada nowy `BEGIN_DELIVERY` ze wszystkimi odbiorcami (`initiativesExecutionRuntime.routes.ts:8927-8958`). Po częściowej porażce następne kliknięcie ponownie wyśle także do odbiorcy o statusie `DELIVERED` w poprzednim receipt. Test pozytywny nie wykrywa problemu, ponieważ runner okresowy świadomie używa jednego deterministycznego receipt. Naprawa musi utrwalić/reużyć receipt istniejącej nieukończonej próby albo wyznaczać go deterministycznie po stronie serwera; wymagany test ścieżki HTTP/UI: sukces A + porażka B, retry, A nadal dokładnie 1 wysyłka, B dokładnie 2.

2. **P1 — awaria po `CLAIM_RECIPIENT` zostawia odbiorcę trwale w `SENDING`.** Domena zabrania ponownego claimu statusu `SENDING` (`reportRun.ts:294-306`), a delivery loop zawsze pomija `SENDING` (`initiativesExecutionRuntime.routes.ts:8967-8969`). Jeżeli proces padnie po zapisie claimu i przed SMTP albo przed `RECORD_RECIPIENT`, każde następne uruchomienie zwraca `DELIVERY_IN_PROGRESS` bez mechanizmu lease/timeout/reclaim. Potrzebna jest jawna polityka odzyskania z dowodem restartu; nie wolno automatycznie uznać nieznanego wyniku SMTP za `DELIVERED`.

3. **P1 — kreator pozwala wybrać zatwierdzającego, który nie może wykonać zatwierdzenia.** Lista zatwierdzających bierze wszystkich członków organizacji poza autorem i usuwa informację o roli (`InitiativeWorkReportView.tsx:102-147`), podczas gdy publikacja definicji, zatwierdzenie przebiegu i wysyłka są chronione `requireOrgRole('admin')`. Wybranie zwykłego MEMBER tworzy definicję/przebieg bez możliwej ścieżki domknięcia. UI powinno pokazywać wyłącznie osoby z rzeczywistym uprawnieniem lub serwer powinien egzekwować odpowiednią zdolność domenową; potrzebny test MEMBER wybrany jako approver → blokada przed utworzeniem z czytelnym komunikatem albo udowodniona autoryzowana ścieżka.

## Luka dowodowa i dokumentacja

- **P2 — pełny runner nie ma jednego dowodu integracyjnego PDF → EmailService/SMTP → trwały dashboard.** `scheduledInitiativeWorkReport.test.ts` uruchamia prawdziwy runner, lecz używa pamięciowego UoW i mocka `sendEmail` (`:164-224`). `initiativeWorkReportEmail.realSmtp.test.ts` łączy się z lokalnym SMTP, lecz wywołuje `nodemailer` bezpośrednio i używa bufora `%PDF-test` (`:65-90`), omijając runner, `EmailService` i trwały report run. RealPG test sprawdza jedynie odczyt źródeł. Są trzy poprawne dowody cząstkowe, ale żaden nie potwierdza żądanego pełnego połączenia. Wymagany jest focused test z realnym PostgreSQL i lokalnym SMTP, który uruchamia produkcyjny runner/`EmailService`, odczytuje po nim `PUBLISHED`, receipt i statusy odbiorców oraz potwierdza prawdziwy załącznik `%PDF`.
- README nadal twierdzi, że harmonogram „publikuje receipt przed SMTP” (`README.md:15`), czyli opisuje dokładnie usunięty błąd i przeczy kodowi oraz sekcji `Re-review delivery state` w `TESTY.md`. Należy poprawić opis przed kolejnym freeze.

## Dowody, które przeszły

- clean exact freeze przed review; merge-base = zadeklarowana baza;
- manifest: 26/26 hashy zgodnych z candidate `6b36aa939e40648603f8aecbe72a7333f5e7fe71`, bez self-hashu;
- evidence: 54 031 B, poniżej limitu 2 MB;
- i18n: EN +45 / PL +45, zero usuniętych i zero zmienionych istniejących wartości;
- focused Vitest: 6 plików / 20 testów PASS; osobno RealPG 1/1 PASS na `cx-s2-work-report-pg:6459`;
- server type-check PASS; esbuild `InitiativeWorkReportView.tsx` PASS (24.3 kB); `git diff --check` PASS;
- flaga UI `VITE_INITIATIVES_WORK_REPORT` jest domyślnie OFF i test broni zakładki oraz deeplinku OFF; tabela używa `StandardTable`; trasy zapisu mają bramkę roli i tenant-scoped readback.

Live staging SMTP nie był używany. Nie wykonywano deployu ani migracji.
