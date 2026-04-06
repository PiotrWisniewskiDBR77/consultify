# Wann man ein Digital-Twin-Modell nach betrieblicher Aenderung aktualisiert

Target persona: Digital-Twin-Owner / Industrieingenieur-Leitung fuer Modellaktualitaet  
Funnel stage: Consideration  
Core problem: Modelle driften nach Go-Live leise, waehrend Teams noch alte Szenario-Outputs zitieren und so falsches Vertrauen in Planungsmeetings erzeugen  
Main promise: eine Trigger-Liste und ein schlanker Refresh-Ablauf, damit der Twin als vertrauenswuerdiges Entscheidungssystem bleibt, wenn sich das Werk weiterentwickelt

**Direkte Antwort:** aktualisieren Sie ein Digital-Twin-Modell nach betrieblicher Aenderung, wenn physischer Fluss, Engpassort, Routing-Regeln, Personalmodell oder Lieferantenrealitaet so weit auseinanderlaufen, dass Rangfolgen aus der alten Struktur Entscheidungen irrefuehren koennten. Nutzen Sie eine Trigger-Checkliste, fahren Sie einen Delta-Szenario-Durchlauf gegen eingefrorene Leitplanken und setzen Sie Annahmen mit Ownern neu, bevor das naechste Freigabegespraech kommt.

Ein veralteter Twin ist nicht neutral.

Er wird zur ueberzeugenden Fiktion.

## Warum Modelle schneller driften als Governance es merkt

Drift-Quellen sind unter anderem:

- kleine Routing-Aenderungen, die Warteschlangen verschieben  
- Anlagenwechsel mit anderen Zyklusverteilungen  
- Aenderungen indirekter Arbeit, die effektive Kapazitaet verschieben  
- Lieferanten-Footprint-Wechsel ohne Abbild im Zulauf  

Digital Twin soll ein Szenariotestumfeld bleiben.

Aktualitaet ist Teil des Produkts, keine Nebenarbeit.

## Trigger-Checkliste: Refresh, wenn ein Kasten kippt

- [ ] der dokumentierte Engpass wanderte oder teilte sich auf Stationen  
- [ ] mittlere und Spitzen-WIP-Muster verschoben sich zwei Review-Zyklen hintereinander  
- [ ] ein Kapitalprojekt aenderte Wege, Lager oder Uebergaben  
- [ ] Planung oder Einkauf aenderte Vorlauf oder Losverhalten im Modell  
- [ ] Schicht- oder Personalmodell passt nicht mehr zur Bodenrealitaet  
- [ ] Qualitaets- oder Nacharbeitstreiber aenderten den effektiven Durchsatz genug  

Sie brauchen nicht jeden Kasten.

Ein materieller Kasten reicht, um einen Refresh zu planen.

## Schrittfolge: disziplinierter Modell-Refresh

1. **Letzte bekannte gute Outputs einfrieren** mit Datum und Entscheidungskontext.  
2. **Strukturelle Deltas seitdem listen** mit Ownern pro Aenderung.  
3. **Eingaben mit Evidenz-Baendern aktualisieren**, nicht mit Wunsch-Defaults.  
4. **Basis und Standard-Stress-Set** aus frueheren Freigaben erneut fahren.  
5. **Delta-Memo veroeffentlichen:** was sich bewegte, was stabil blieb, welche Entscheidungen wieder oeffnen.

## Vergleich: kosmetischer Tweak versus struktureller Refresh

| Aenderungstyp | typische Aktion |
|---|---|
| nur Label- oder Reportingwechsel | dokumentieren, kein struktureller Refresh |
| einzelner Parameter im vereinbarten Band | Sensitivitaetsnotiz, optional Teil-Neu-Lauf |
| Routing- oder Ressourcenlogikwechsel | struktureller Refresh mit neuer Basis |
| Footprintwechsel nach CAPEX | voller Refresh vor der naechsten grossen Entscheidung |

## Was Digital Twin hier aendert

Digital Twin ist ein Entscheidungssystem, um Layout, Fluss und CAPEX zu entriskieren, bevor die Realitaet wechselt.

Es ist keine 3D-Show.

Refresh-Disziplin haelt es mit dem Boden aligned, den Sie wirklich fahren.

## Was DBR77 Digital Twin ergaenzt

DBR77 Digital Twin unterstuetzt praktischen Szenariovergleich mit Weg von manuellen Eingaben zu tieferer Integration.

Fuer Modell-Owner hilft es Teams:

- Refresh-Ereignisse nachvollziehbar neben Projekthistorie zu halten  
- Standard-Stress-Sets wiederzuverwenden, damit Vorher-Nachher etwas bedeutet  
- die Luecke zwischen physischer Aenderung und vertrauenswuerdigen Szenarien zu verkuerzen  

## Bottom line

Behandeln Sie Refresh als Governance, nicht als Hausputz.

Hat sich das Werk bewegt und der Twin nicht, hoeren Sie auf, die Sicherheit des letzten Quartals zu zitieren.
