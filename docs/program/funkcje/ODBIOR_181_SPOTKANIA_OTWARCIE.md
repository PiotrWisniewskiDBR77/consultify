---
doc_id: funkcje-odbior-181
status: canonical
truth_type: acceptance
established: 2026-08-31
---

# ODBIÓR 181 — otwarcie Spotkań · SCALONO PO FIX-181

★ FIX-181 wykonany (`4a6f6487b8`): `/meetings` w `PILOT_ALLOWED_ROUTE_PREFIXES`
(mutacja routera: bez prefiksu → realny navigate('/interview'); z → render) —
**D-1 spełnione end-to-end**. Karta 08_MEETINGS sprostowana erratą (przekreślenia,
nic nie skasowane; 12/21 spinnerów nazwane per plik). Diagnoza spinnera: hipoteza
membership-403 OBALONA na fixture właściciela (persony ACTIVE, spotkania dostępne)
— przyczyna głębsza, opisana plik:linia w CODEX_FIX181_REPORT →
**dyżur 194 (181-bis): strona obiektu spotkania**. Do tego czasu: lista+kalendarz
działają, obiekt NIE — zapisane w karcie, żeby nikt nie pokazał właścicielowi
„gotowego" obiektu.

Flip bety realny (mutacja odbioru: closed→3 FAIL, open→8/8; mirror identyczny),
4 zastane testy potraktowane wzorowo (podmiana przykładu w finance-teście zamiast
ślepego odwrócenia; GF-06 uczciwie zostawiony czerwony z przyczyną). Oceny:
flip **A** · R3 **D** · zrzuty **D** · STOP-korekta **B+**.

## Dwa blokery
1. **D-1 niespełnione end-to-end:** MEMBER nadal przekierowywany — nie przez betę,
   tylko przez bramkę pilota (`pilotAccess.ts` `PILOT_ALLOWED_ROUTE_PREFIXES` bez
   `/meetings` + `RouterSync.tsx:316-325`). Instrukcja tego nie przewidziała —
   błąd autorski nadzorcy; wykonawca poprawnie obalił i udokumentował.
2. ★ **Karta MODULE_ACCEPTANCE twierdzi „approved renders" wbrew WŁASNEMU zrzutowi**
   (spinner). **12/21 PNG to puste spinnery** — cała strona obiektu spotkania nie
   ładuje się (podejrzenie: `requireActiveMeetingMembership` — ta sama przyczyna
   co czerwony GF-06). Cytaty MTG-PF-003/004 wskazują zrzuty, które niczego nie
   pokazują. Do sprostowania w karcie, nie do zamiecenia.

## FIX-181 (wewnętrzny): (1) `/meetings` w prefiksach pilota + test end-to-end
renderu dla MEMBER; (2) sprostowanie fałszywych twierdzeń karty; (3) diagnoza
spinnera obiektu (membership?) — fix jeśli płytki, raport jeśli głęboki.

## Dla toru grafiki / rejestru
Interfejs Meetings niemal w całości po angielsku (pierwszy kontakt właściciela!);
„Could not load the operator brief" na podglądzie; surowe sluggi uczestników;
`owner-empty-...-light.png` renderuje ciemny motyw (wadliwe przechwycenie);
crimson „Log Out" w menu profilu (chrome globalny — do oceny grafiki).
