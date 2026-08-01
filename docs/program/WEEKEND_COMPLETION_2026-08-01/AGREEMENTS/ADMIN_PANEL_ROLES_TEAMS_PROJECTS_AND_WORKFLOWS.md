---
doc_kind: DOMAIN_AND_UX_CONTRACT
status: DRAFT_FOR_OWNER_REVIEW
owner: Piotr Wisniewski
last_updated: 2026-07-31
module: Admin Panel
---

# Admin — ludzie, role, zespoły, projekty i workflow

## 1. Trzy niezależne warstwy dostępu

Nie wolno sprowadzać dostępu do jednej kolumny `role`.

1. **Rola aplikacyjna** określa bazowe uczestnictwo: `Owner`, `Admin`, `Member`, `Consultant`, `Guest`.
2. **Kompetencja administracyjna** deleguje konkretną domenę: People Admin, Project Admin, AI Admin, Integration Admin, Security Admin, Billing Admin, Auditor. Kompetencja ma zakres organizacja/zespół/projekt i może być czasowa.
3. **Rola projektowa** opisuje odpowiedzialność w pracy: Sponsor, Project Owner, Project Manager, Workstream Lead, Contributor, Reviewer/Approver, Viewer; zestaw można konfigurować szablonem projektu.

Uprawnienie efektywne wynika z: `podmiot + kompetencja + zakres + polityka + wyjątek + czas`. System pokazuje to wyliczenie w jednym miejscu.

## 2. People & Access

Lista pokazuje imię, email, typ użytkownika, status, rolę bazową, grupy, ostatnią aktywność, źródło provisioningu i ryzyka. Akcje: zaproś, wyślij ponownie, zawieś, reaktywuj, zakończ wszystkie sesje, zmień rolę, deleguj kompetencję, przenieś własność i usuń zgodnie z retencją.

Zaproszenie ma rolę startową, grupę/projekt opcjonalny, datę wygaśnięcia, domenę i właściciela. Gość nie dostaje dostępu przez samo członkostwo w organizacji; wymaga jawnego zakresu. Operacje masowe zawsze pokazują liczbę i listę dotkniętych osób.

Transfer Ownera wymaga reautoryzacji, akceptacji nowego właściciela, zachowania co najmniej jednego aktywnego Ownera i zdarzenia audytowego.

## 3. Teams & Projects

Administrator tworzy:

- zespoły organizacyjne odwzorowujące strukturę lub wspólnotę kompetencji;
- zespoły projektowe powiązane z konkretnym projektem;
- projekt `General` jako kontrolowany fallback, nie śmietnik bez właściciela;
- szablon zespołu projektu z rolami, minimalną obsadą, domyślną widocznością i ścieżką zatwierdzeń.

Nowa osoba w projekcie otrzymuje najniższą bezpieczną rolę domyślną. Upgrade jest jawny i audytowany. Projekt nie może wejść w realizację bez Project Ownera, odpowiedzialności za decyzje i wymaganych approverów. Macierz odpowiedzialności może być projekcją RACI/DACI, ale dane przechowujemy jako relacje do konkretnych decyzji, inicjatyw i rezultatów.

## 4. Manager — dostęp i zakres widoczności

Widoczność funkcji Manager wymaga jednocześnie:

- capability `manager.view` albo roli, która ją zawiera;
- `ManagerScope`: direct reports, wybrana jednostka, zespół, projekt lub jawna lista osób.

Admin ustala zakres i datę obowiązywania. Manager widzi tylko pracę uzasadnioną operacyjnie: przypisania, obciążenie, blokery, zaległe akceptacje i ryzyka. Nie widzi prywatnych notatek, rozmów ani treści spoza zakresu i nie służy do ukrytego rankingu produktywności.

## 5. Domyślny lifecycle inicjatywy

Prosty wariant domyślny:

`Candidate Draft → AI completeness check → Owner review → Portfolio approval (go/no-go) → scheduling/resource confirmation → Ready for Execution → Execution → Results/KPI supervision → Closed`.

Admin ustala role zatwierdzające i progi; projekt może odziedziczyć politykę lub mieć jawny wyjątek. Teresa może zaproponować zmianę workflow, ale nie wdraża jej sama. Nie wolno skonfigurować cyklu zatwierdzeń, braku approvera ani ścieżki pozwalającej autorowi samodzielnie zatwierdzić działanie wymagające separacji obowiązków.

## 6. Workflow builder

Builder obsługuje zdarzenie wejściowe, warunki, krok, odpowiedzialną rolę, SLA, zastępstwo, eskalację, wynik, retry i ścieżkę błędu. Zmiana publikowana ma wersję. Uruchomione procesy kończą się na wersji, na której wystartowały, chyba że administrator wykona kontrolowaną migrację.

Przed publikacją dostępne są: walidator, symulacja na przykładowych danych, lista dotkniętych projektów, porównanie wersji i tryb draft. Dla krytycznej polityki obowiązuje four-eyes approval.

## 7. Teresa i jakość

Teresa wykrywa brakujące role, osierocone projekty, nadmiarowe uprawnienia, konflikt interesów, brak zastępstwa, zbyt długie SLA i niewykonalny workflow. Każde zalecenie zawiera dowód, ryzyko, proponowany diff i możliwość odrzucenia. Nie ocenia pracownika na podstawie liczby kliknięć ani czasu online.

## 8. Kryteria odbioru

- można prześledzić efektywny dostęp dowolnej osoby;
- usunięcie z grupy/projektu odbiera odziedziczony dostęp po read-back;
- Manager nie widzi osoby poza zakresem;
- projekt bez wymaganej roli nie przechodzi gate'u;
- zmiana workflow jest wersjonowana, symulowana i audytowana;
- gość nie uzyskuje danych przez niejawne dziedziczenie.
