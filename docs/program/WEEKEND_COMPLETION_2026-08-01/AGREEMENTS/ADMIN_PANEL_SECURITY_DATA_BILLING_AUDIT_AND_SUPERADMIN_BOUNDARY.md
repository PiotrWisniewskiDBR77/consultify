---
doc_kind: SECURITY_AND_BOUNDARY_CONTRACT
status: DRAFT_FOR_OWNER_REVIEW
owner: Piotr Wisniewski
last_updated: 2026-07-31
module: Admin Panel
---

# Admin — bezpieczeństwo, dane, rozliczenia, audyt i granica Superadmina

## 1. Security & Identity

Zakres: MFA, SSO/SAML/OIDC, SCIM, polityka hasła tam, gdzie występuje, sesje i urządzenia, dozwolone domeny, goście, udostępnianie zewnętrzne, API keys/service accounts, dostęp warunkowy i procedura awaryjna.

Zmiany krytyczne wymagają reautoryzacji oraz — zależnie od polityki — drugiego approvera. Nie można jedną błędną zmianą usunąć ostatniego Ownera ani zablokować wszystkich kont awaryjnych. Tryb report-only i policy simulator poprzedzają egzekwowanie dostępu warunkowego.

## 2. Data governance

Administrator ustala klasyfikację, rezydencję, retencję per typ danych, kosz, trwałe usunięcie, eksport, legal hold, DLP i zasady wykorzystania przez AI. System pokazuje konflikt między retencją a legal hold. Eksport ma zakres, format, manifest, checksum, termin ważności linku i audyt pobrania.

Usunięcie użytkownika nie oznacza automatycznego zniszczenia obiektów firmowych; wymagany jest transfer własności. Treści prywatne podlegają osobnej polityce i podstawie dostępu.

## 3. Billing & Usage

Zakres: plan, miejsca, aktywne/przydzielone licencje, storage, AI usage, budżety i alerty, faktury, metody płatności, dane podatkowe i prognoza. Role rozliczeniowe widzą kwoty i agregaty, nie treść pracy. Zmiana planu lub metody płatności wymaga właściwej kompetencji i audytu; pełny numer instrumentu płatniczego nigdy nie trafia do Consultify UI.

## 4. Audit & Compliance

Audit event zawiera: czas, aktora, rolę efektywną, organizację i zakres, akcję, obiekt, wynik, ryzyko, kanał UI/API/Teresa/SCIM, request/correlation ID oraz zredagowany diff. Dziennik jest odporny na modyfikację przez tenant-admina, filtrowalny, eksportowalny i objęty polityką retencji.

Incydent łączy zdarzenia, właściciela, status, działania, dowody i decyzję zamknięcia. Alert nie jest incydentem, dopóki nie zostanie zakwalifikowany. Audit Log nie jest miejscem ręcznego poprawiania historii.

## 5. Precyzyjna granica Admin / Superadmin

| Obszar | Admin organizacji | Superadmin platformy |
| --- | --- | --- |
| ludzie | członkowie własnej organizacji | pomoc awaryjna według kontrolowanej procedury |
| role | tenant i projekt | definicje/platform ceiling i operatorzy platformy |
| AI | dopuszczone modele, routing i budżet tenant | globalni providerzy, katalog modeli, bezpieczeństwo platformy |
| integracje | enablement, consent i scopes tenant | connector runtime i sekrety platformowe |
| dane | retencja, eksport i DLP tenant | regiony, infrastruktura, backup platformy |
| billing | subskrypcja i faktury tenant | katalog ofert, rozliczenia platformowe i korekty operatorskie |
| zdrowie | przepływy własnej organizacji | infrastruktura i wszystkie tenanty |
| audyt | zdarzenia własnej organizacji | operator audit i kontrolowany cross-tenant access |

Support impersonation jest wyjątkową operacją Superadmina: wymaga powodu/ticketu, czasu wygaśnięcia, widocznego bannera, ograniczonego zakresu, pełnego audytu i zakazu cichych mutacji.

## 6. Privacy i etyka

Nie budujemy rankingu pracowników z liczby kliknięć, czasu online, liczby promptów ani aktywności pozbawionej kontekstu. Manager i Admin otrzymują dane potrzebne do zarządzania pracą i ryzykiem, z minimalizacją danych oraz jawnym celem.

## 7. Kryteria odbioru

- kontrola tenant scope działa na API, nie tylko w nawigacji;
- krytyczna zmiana ma reauth, diff i audit event;
- nie da się ujawnić sekretu po zapisie;
- billing admin nie widzi treści pracy;
- legal hold blokuje sprzeczne usunięcie;
- tenant Admin nie wywołuje funkcji Superadmina nawet przez bezpośredni endpoint;
- eksport i support access pozostawiają kompletny dowód.
