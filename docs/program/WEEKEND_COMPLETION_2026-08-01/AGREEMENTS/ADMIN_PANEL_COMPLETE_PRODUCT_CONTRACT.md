---
doc_kind: PRODUCT_CONTRACT
status: DRAFT_FOR_OWNER_REVIEW
owner: Piotr Wisniewski
last_updated: 2026-07-31
module: Admin Panel
---

# Admin Panel — kompletny kontrakt produktu

## 1. Decyzja produktowa

Admin Panel jest centrum sterowania **jedną organizacją-klientem**. Nie jest rozszerzonym profilem użytkownika, ekranem technicznym ani Superadminem Consultify. Ma pozwolić uprawnionym osobom bezpiecznie ustawić ludzi, zespoły, projekty, role, procesy zatwierdzania, zasady AI, integracje, bezpieczeństwo, dane i koszty organizacji.

Każda zmiana administracyjna odpowiada na pięć pytań: **co**, **kto**, **dla jakiego zakresu**, **od kiedy** i **z jakim skutkiem**. System pokazuje podgląd wpływu przed zapisem, stan efektywny po zapisie, autora zmiany, ślad audytowy i — gdy technicznie możliwe — cofnięcie.

## 2. Użytkownicy i rezultat

Główni użytkownicy:

- właściciel organizacji — własność, plan, krytyczne polityki i delegowanie administracji;
- administrator organizacji — bieżąca administracja zgodnie z nadanymi kompetencjami;
- administrator ludzi, projektów, AI, integracji, bezpieczeństwa albo rozliczeń — tylko własna domena;
- audytor — odczyt polityk, zmian i dowodów bez prawa mutacji;
- kierownik projektu lub zespołu — administracja delegowana tylko we własnym zakresie.

Rezultat: właściwi ludzie mają właściwy dostęp do właściwych danych i funkcji, a Teresa działa w granicach zaakceptowanej polityki organizacji.

## 3. Docelowa architektura informacji

1. **Overview** — stan organizacji, wymagające uwagi ryzyka, koszty, licencje, integracje i ostatnie zmiany; bez duplikowania ekranów szczegółowych.
2. **People & Access** — użytkownicy, zaproszenia, goście, role aplikacyjne, delegowane role administracyjne, grupy i cykl życia kont.
3. **Teams & Projects** — zespoły organizacyjne i projektowe, członkostwo, role projektowe, szablony ról oraz zakres widoczności Managera.
4. **Workflows & Governance** — domyślne ścieżki zatwierdzania inicjatyw, decyzji, publikacji i działań AI; wyjątki per projekt.
5. **AI & Teresa** — modele, routing, limity, pamięć, autonomia, narzędzia, polityka danych, jakość i koszty.
6. **Connections** — katalog połączeń, dopuszczone źródła, uprawnienia, kondycja, właściciel i logi synchronizacji.
7. **Security & Data** — logowanie, SSO/SCIM/MFA, sesje, urządzenia, dostęp warunkowy, retencja, eksport, DLP i rezydencja.
8. **Billing & Usage** — plan, miejsca, wykorzystanie, budżety, faktury, alerty i prognoza.
9. **Audit & Compliance** — niezmienny dziennik zdarzeń, incydenty, eksport dowodów i historia polityk.
10. **System Health** — diagnostyka organizacyjnych przepływów i integracji dostępna technicznym administratorom.

Obecne sekcje `people`, `billing`, `ai`, `security`, `audit`, `command`, `health` pozostają punktem wyjścia, ale nie wyczerpują docelowej domeny. `Command Center` powinien stać się syntetycznym Overview/Trust Center, a nie drugim miejscem edycji tych samych zasad.

## 4. Wspólny standard każdej sekcji

Każda sekcja ma:

- nagłówek z opisem zakresu i informacją „kto może zarządzać”;
- tabelę/listę z filtrowaniem, zapisanymi widokami i eksportem, jeśli dane są audytowe;
- panel szczegółu bez utraty kontekstu listy;
- stany loading, empty, error, partial/degraded, success i no-access;
- `effective policy`: wartość, źródło dziedziczenia i wyjątek;
- dla zapisu: zmiany przed/po, zasięg, skutki, wymagane zatwierdzenie i ponowne uwierzytelnienie;
- potwierdzenie read-back z serwera; komunikat sukcesu nie może opierać się tylko na stanie lokalnym;
- deep link do konkretnego obiektu lub polityki;
- pełną obsługę klawiatury, czytelny focus, nazwy dostępności i responsywność zgodną z kanonem UI 2026.

## 5. Najważniejsze obiekty domenowe

`Organization`, `User`, `Membership`, `Group`, `Team`, `Project`, `AppRole`, `AdminCapability`, `ProjectRole`, `ManagerScope`, `ApprovalPolicy`, `EffectivePolicy`, `AIPolicy`, `ConnectorPolicy`, `SecurityPolicy`, `DataPolicy`, `Plan`, `Budget`, `License`, `AuditEvent`, `Incident`.

Każdy obiekt ma identyfikator organizacji. Każda relacja dostępu ma: podmiot, kompetencję, zakres, źródło nadania, okres obowiązywania i autora.

## 6. Granice

Admin zarządza wyłącznie własną organizacją. Superadmin zarządza platformą, tenantami, globalnymi dostawcami i modelami, infrastrukturą, nadużyciami oraz wsparciem cross-tenant. Settings przechowuje preferencje osobiste. Organization prezentuje i wykorzystuje strukturę firmy; Admin ją konfiguruje. Sekretów nie pokazujemy po zapisie.

## 7. Rola Teresy

Teresa może diagnozować konfigurację, wyjaśniać skutki, przygotować projekt polityki, porównać warianty, wykryć konflikt i poprowadzić administratora przez konfigurację. Nie nadaje sobie uprawnień, nie omija separacji obowiązków i nie wykonuje krytycznych zmian bez jawnego potwierdzenia człowieka. Wszystkie jej propozycje mają uzasadnienie, źródła danych, zakres i diff.

## 8. Standard jakości

Panel jest gotowy dopiero, gdy administrator potrafi odtworzyć odpowiedź: „dlaczego ta osoba ma ten dostęp?”, „która polityka obowiązuje?”, „kto ją zmienił?”, „co dokładnie zrobiła Teresa?” oraz „jak bezpiecznie wrócić do poprzedniego stanu?”. Samo istnienie formularza lub endpointu nie oznacza gotowości.

## 9. Pytania do wspólnego zamknięcia

1. Czy nazwa widoczna w menu pozostaje `Admin Panel`, czy przechodzimy na `Organization Admin`?
2. Czy billing w pierwszym MVP obsługuje realne płatności, czy tylko plan, wykorzystanie i faktury?
3. Które delegowane role administracyjne wchodzą do MVP poza Owner/Admin/Auditor?
